import crypto from 'crypto';
import pg from 'pg';
import { pool } from '../db/neon.js';

export interface IdempotencyRecord {
  key: string;
  actorUserId: string;
  resourceType: string;
  resourceId?: string;
  requestFingerprint: string;
  responsePayload: any;
  createdAt: Date;
  expiresAt: Date;
}

export class IdempotencyService {
  /**
   * Computes a deterministic SHA-256 fingerprint for the request parameters.
   */
  public computeFingerprint(payload: any): string {
    const serialized = JSON.stringify(payload, Object.keys(payload || {}).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Checks if an idempotency record exists for this key and actor.
   * - If found with SAME fingerprint: returns the cached response payload.
   * - If found with DIFFERENT fingerprint: throws IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST.
   * - If not found or expired: returns null (proceed with execution).
   */
  public async getExistingResponse(
    key: string,
    actorUserId: string,
    currentFingerprint: string,
    client?: pg.PoolClient
  ): Promise<any | null> {
    const runner = client || pool;
    const res = await runner.query<{
      key: string;
      actor_user_id: string;
      request_fingerprint: string;
      response_payload: any;
      expires_at: Date;
    }>(
      `SELECT key, actor_user_id, request_fingerprint, response_payload, expires_at
       FROM idempotency_keys
       WHERE key = $1 AND actor_user_id = $2`,
      [key, actorUserId]
    );

    if (res.rows.length === 0) {
      return null;
    }

    const record = res.rows[0];

    // Verify if expired
    if (new Date(record.expires_at) < new Date()) {
      return null;
    }

    // Verify fingerprint
    if (record.request_fingerprint !== currentFingerprint) {
      throw new Error(
        'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST: Cette clé d\'idempotence a déjà été utilisée avec des paramètres de requête différents.'
      );
    }

    return record.response_payload;
  }

  /**
   * Stores the response payload associated with the idempotency key within a transaction.
   */
  public async storeResponse(
    data: {
      key: string;
      actorUserId: string;
      resourceType: string;
      resourceId?: string;
      requestFingerprint: string;
      responsePayload: any;
    },
    client?: pg.PoolClient
  ): Promise<void> {
    const runner = client || pool;
    await runner.query(
      `INSERT INTO idempotency_keys (
        key, actor_user_id, resource_type, resource_id, request_fingerprint, response_payload, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW() + INTERVAL '24 hours')
      ON CONFLICT (key, actor_user_id) DO UPDATE SET
        resource_id = EXCLUDED.resource_id,
        request_fingerprint = EXCLUDED.request_fingerprint,
        response_payload = EXCLUDED.response_payload,
        expires_at = NOW() + INTERVAL '24 hours'`,
      [
        data.key,
        data.actorUserId,
        data.resourceType,
        data.resourceId || null,
        data.requestFingerprint,
        JSON.stringify(data.responsePayload),
      ]
    );
  }
}

export const idempotencyService = new IdempotencyService();
