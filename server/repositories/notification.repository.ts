import { pool } from '../db/neon.js';

export interface CreateNotificationParams {
  recipientUserId?: string;
  recipientClientId?: string;
  inscriptionId?: string;
  type: string;
  category?: 'SYSTEM' | 'PAYMENT' | 'DOCUMENT' | 'LOGISTICS' | 'GENERAL' | 'INSCRIPTION';
  title: string;
  message: string;
  entityType?: 'payment' | 'document' | 'visa' | 'flight' | 'hotel' | 'inscription' | 'client';
  entityId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  actionUrl?: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export class NotificationRepository {
  public async getNotifications(recipientUserId?: string, recipientClientId?: string): Promise<any[]> {
    let sql = `SELECT * FROM notifications WHERE 1=1`;
    const params: any[] = [];

    if (recipientUserId && recipientClientId) {
      params.push(recipientUserId, recipientClientId);
      sql += ` AND (recipient_user_id = $1 OR recipient_client_id = $2)`;
    } else if (recipientUserId) {
      params.push(recipientUserId);
      sql += ` AND recipient_user_id = $1`;
    } else if (recipientClientId) {
      params.push(recipientClientId);
      sql += ` AND recipient_client_id = $1`;
    }

    sql += ` ORDER BY created_at DESC LIMIT 100`;

    const res = await pool.query(sql, params);
    return res.rows.map(this.mapRowToNotification);
  }

  public async createNotification(data: CreateNotificationParams, client?: import('pg').PoolClient): Promise<string> {
    const runner = client || pool;
    const rawKey = data.idempotencyKey ||
      `${data.recipientUserId || data.recipientClientId || 'global'}_${data.type}_${data.entityType || 'ent'}_${data.entityId || 'none'}`;
    const idempotencyKey = rawKey.replace(/[\/\s]/g, '_').substring(0, 150);

    const checkRes = await runner.query(
      `SELECT id, is_read FROM notifications WHERE idempotency_key = $1`,
      [idempotencyKey]
    );

    if (checkRes.rows.length > 0 && checkRes.rows[0].is_read) {
      return idempotencyKey;
    }

    const id = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await runner.query(
      `INSERT INTO notifications (
        id, idempotency_key, recipient_user_id, recipient_client_id, inscription_id,
        type, category, title, message, entity_type, entity_id, priority, action_url,
        metadata, is_read, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, FALSE, NOW())
      ON CONFLICT (idempotency_key) DO UPDATE SET
        title = EXCLUDED.title,
        message = EXCLUDED.message,
        priority = EXCLUDED.priority,
        action_url = EXCLUDED.action_url,
        metadata = EXCLUDED.metadata,
        created_at = NOW()
      WHERE notifications.is_read = FALSE`,
      [
        id,
        idempotencyKey,
        data.recipientUserId || null,
        data.recipientClientId || null,
        data.inscriptionId || null,
        data.type,
        data.category || 'GENERAL',
        data.title,
        data.message,
        data.entityType || null,
        data.entityId || null,
        data.priority || 'MEDIUM',
        data.actionUrl || null,
        JSON.stringify(data.metadata || {}),
      ]
    );

    return idempotencyKey;
  }

  public async markAsRead(id: string): Promise<void> {
    await pool.query(`UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = $1`, [id]);
  }

  public async markAllAsRead(recipientUserId: string, recipientClientId?: string): Promise<void> {
    if (recipientClientId) {
      await pool.query(
        `UPDATE notifications SET is_read = TRUE, read_at = NOW()
         WHERE (recipient_user_id = $1 OR recipient_client_id = $2) AND is_read = FALSE`,
        [recipientUserId, recipientClientId]
      );
    } else {
      await pool.query(
        `UPDATE notifications SET is_read = TRUE, read_at = NOW()
         WHERE recipient_user_id = $1 AND is_read = FALSE`,
        [recipientUserId]
      );
    }
  }

  private mapRowToNotification(r: any) {
    return {
      id: r.id,
      idempotencyKey: r.idempotency_key,
      recipientUserId: r.recipient_user_id,
      recipientClientId: r.recipient_client_id,
      inscriptionId: r.inscription_id,
      type: r.type,
      category: r.category,
      title: r.title,
      message: r.message,
      entityType: r.entity_type,
      entityId: r.entity_id,
      priority: r.priority,
      actionUrl: r.action_url,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata || {},
      isRead: r.is_read,
      readAt: r.read_at ? new Date(r.read_at).toISOString() : null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const notificationRepository = new NotificationRepository();
