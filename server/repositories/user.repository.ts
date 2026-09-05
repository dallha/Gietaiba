import { pool } from '../db/neon.js';
import { UserSession, User } from '../../src/types.js';

export class UserRepository {
  public async getUsers(): Promise<UserSession[]> {
    const res = await pool.query(
      `SELECT id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids
       FROM users
       ORDER BY created_at ASC`
    );
    return res.rows.map(this.mapRowToSession);
  }

  public async getUserById(id: string): Promise<UserSession | null> {
    const res = await pool.query(
      `SELECT id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids
       FROM users
       WHERE id = $1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToSession(res.rows[0]);
  }

  public async getUserByClientId(clientId: string): Promise<UserSession | null> {
    const res = await pool.query(
      `SELECT id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids
       FROM users
       WHERE client_id = $1
       LIMIT 1`,
      [clientId]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToSession(res.rows[0]);
  }

  public async authenticate(emailOrPhone: string, password: string): Promise<UserSession | null> {
    const cleanQuery = emailOrPhone.trim().toLowerCase();
    const cleanPhone = cleanQuery.replace(/[\s+-]/g, '');

    const res = await pool.query(
      `SELECT id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids, password_hash
       FROM users
       WHERE (LOWER(email) = $1 OR regexp_replace(phone, '[\\s+-]', '', 'g') = $2)
         AND active = TRUE
         AND status = 'ACTIF'`,
      [cleanQuery, cleanPhone]
    );

    if (res.rows.length === 0) return null;

    const userRow = res.rows[0];
    if (userRow.password_hash !== password) {
      return null;
    }

    // Update last_login_at
    await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userRow.id]);

    return this.mapRowToSession(userRow);
  }

  public async authenticatePilgrim(identifier: string): Promise<{ user: UserSession; client: any } | null> {
    const clean = identifier.trim().toLowerCase().replace(/[\s+-]/g, '');

    // Search client first
    const clientRes = await pool.query(
      `SELECT * FROM clients
       WHERE LOWER(code) = $1
          OR regexp_replace(phone, '[\\s+-]', '', 'g') = $1
          OR LOWER(email) = $2
       LIMIT 1`,
      [clean, identifier.trim().toLowerCase()]
    );

    if (clientRes.rows.length === 0) return null;
    const clientRow = clientRes.rows[0];

    // Find or create associated pilgrim user
    const userRes = await pool.query(
      `SELECT id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids
       FROM users
       WHERE client_id = $1
       LIMIT 1`,
      [clientRow.id]
    );

    let session: UserSession;
    if (userRes.rows.length > 0) {
      session = this.mapRowToSession(userRes.rows[0]);
    } else {
      const userId = `usr-pilgrim-${clientRow.id}`;
      const email = clientRow.email || `${clientRow.code.toLowerCase()}@pelerin.taiba.sn`;
      const displayName = `${clientRow.first_name} ${clientRow.last_name}`;

      const insertRes = await pool.query(
        `INSERT INTO users (
          id, email, display_name, phone, password_hash, role_id, status, active, client_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'pelerin123', 'PELERIN', 'ACTIF', TRUE, $5, NOW(), NOW())
        RETURNING id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids`,
        [userId, email, displayName, clientRow.phone, clientRow.id]
      );
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, 'PELERIN') ON CONFLICT DO NOTHING`,
        [userId]
      );
      session = this.mapRowToSession(insertRes.rows[0]);
    }

    return {
      user: session,
      client: {
        id: clientRow.id,
        code: clientRow.code,
        firstName: clientRow.first_name,
        lastName: clientRow.last_name,
        phone: clientRow.phone,
        email: clientRow.email,
        status: clientRow.status,
      }
    };
  }

  private mapRowToSession(r: any): UserSession {
    return {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      role: r.role_id,
      phone: r.phone || undefined,
      clientId: r.client_id || undefined,
      allowedInscriptionIds: r.allowed_inscription_ids || undefined,
      active: r.active,
    };
  }
}

export const userRepository = new UserRepository();
