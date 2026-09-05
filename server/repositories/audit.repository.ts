import { pool } from '../db/neon.js';
import { AuditLog } from '../../src/types.js';

export class AuditRepository {
  public async getAuditLogs(limit = 200): Promise<AuditLog[]> {
    const res = await pool.query(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return res.rows.map(this.mapRowToAudit);
  }

  public async logAudit(data: {
    actorUserId: string;
    actorUserName: string;
    action: string;
    entityType: string;
    entityId: string;
    oldValue?: any;
    newValue?: any;
    reason?: string;
    metadata?: any;
  }): Promise<AuditLog> {
    const id = `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const res = await pool.query(
      `INSERT INTO audit_logs (
        id, actor_user_id, actor_user_name, action, entity_type, entity_id,
        old_value, new_value, reason, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        id,
        data.actorUserId,
        data.actorUserName,
        data.action,
        data.entityType,
        data.entityId,
        data.oldValue ? (typeof data.oldValue === 'string' ? data.oldValue : JSON.stringify(data.oldValue)) : null,
        data.newValue ? (typeof data.newValue === 'string' ? data.newValue : JSON.stringify(data.newValue)) : null,
        data.reason || null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );

    return this.mapRowToAudit(res.rows[0]);
  }

  private mapRowToAudit(r: any): AuditLog {
    return {
      id: r.id,
      userId: r.actor_user_id,
      userName: r.actor_user_name,
      action: r.action,
      entity: r.entity_type,
      entityId: r.entity_id,
      oldValue: r.old_value || undefined,
      newValue: r.new_value || undefined,
      details: r.reason || undefined,
      timestamp: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const auditRepository = new AuditRepository();
