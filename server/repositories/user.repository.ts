import { pool } from '../db/neon.js';
import { UserSession, User, Role } from '../../src/types.js';

export class UserRepository {
  public async getUsers(): Promise<UserSession[]> {
    const res = await pool.query(
      `SELECT id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids
       FROM users
       ORDER BY created_at ASC`
    );
    return res.rows.map(this.mapRowToSession);
  }

  public async getFullUsers(): Promise<User[]> {
    const res = await pool.query(
      `SELECT id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids, created_at, updated_at, last_login_at
       FROM users
       ORDER BY created_at ASC`
    );
    return res.rows.map(this.mapRowToUser);
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

  public async getUserByIdAsUser(id: string): Promise<User | null> {
    const res = await pool.query(
      `SELECT id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids, created_at, updated_at, last_login_at
       FROM users
       WHERE id = $1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0]);
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
    const raw = identifier.trim().toLowerCase();
    const clean = raw.replace(/[\s+-]/g, '');

    // Search client first
    const clientRes = await pool.query(
      `SELECT * FROM clients
       WHERE LOWER(code) = $1
          OR regexp_replace(LOWER(code), '[\\s+-]', '', 'g') = $2
          OR regexp_replace(phone, '[\\s+-]', '', 'g') = $2
          OR LOWER(email) = $1
       LIMIT 1`,
      [raw, clean]
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

  public async createUser(user: Partial<User> & { password?: string }): Promise<User> {
    const id = user.id || `usr-${Date.now()}`;
    const email = (user.email || '').toLowerCase().trim();
    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || email;
    const roleId = user.roleId || 'AGENT';
    const status = user.status || 'ACTIF';
    const active = user.active !== false;
    const passwordHash = user.password || 'taiba123';

    const res = await pool.query(
      `INSERT INTO users (
        id, email, display_name, phone, password_hash, role_id, status, active, client_id, allowed_inscription_ids, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *`,
      [
        id,
        email,
        displayName,
        user.phone || null,
        passwordHash,
        roleId,
        status,
        active,
        user.clientId || null,
        user.allowedInscriptionIds || null,
      ]
    );

    await pool.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, roleId]
    );

    return this.mapRowToUser(res.rows[0]);
  }

  public async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      const displayName = `${updates.firstName || ''} ${updates.lastName || ''}`.trim();
      fields.push(`display_name = $${idx++}`);
      values.push(displayName);
    }
    if (updates.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(updates.email.toLowerCase().trim());
    }
    if (updates.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(updates.phone);
    }
    if (updates.roleId !== undefined) {
      fields.push(`role_id = $${idx++}`);
      values.push(updates.roleId);
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [id, updates.roleId]
      );
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.active !== undefined) {
      fields.push(`active = $${idx++}`);
      values.push(updates.active);
    }
    if (updates.clientId !== undefined) {
      fields.push(`client_id = $${idx++}`);
      values.push(updates.clientId || null);
    }
    if (updates.allowedInscriptionIds !== undefined) {
      fields.push(`allowed_inscription_ids = $${idx++}`);
      values.push(updates.allowedInscriptionIds);
    }

    if (fields.length === 0) {
      return this.getUserByIdAsUser(id);
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
    const res = await pool.query(sql, values);
    if (res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0]);
  }

  public async deleteUser(id: string): Promise<boolean> {
    const res = await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  public async getRoles(): Promise<Role[]> {
    const rolesRes = await pool.query(`SELECT id, name, description, is_system FROM roles ORDER BY id ASC`);
    const permRes = await pool.query(`SELECT role_id, permission_id FROM role_permissions`);
    const permMap: Record<string, string[]> = {};
    for (const p of permRes.rows) {
      if (!permMap[p.role_id]) permMap[p.role_id] = [];
      permMap[p.role_id].push(p.permission_id);
    }
    return rolesRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description || undefined,
      isSystem: r.is_system,
      permissions: permMap[r.id] || (r.id === 'SUPER_ADMIN' || r.id === 'ADMIN' ? ['*'] : []),
    }));
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

  private mapRowToUser(r: any): User {
    const nameParts = (r.display_name || r.email || '').split(' ');
    return {
      id: r.id,
      authUid: r.id,
      firstName: nameParts[0] || 'Utilisateur',
      lastName: nameParts.slice(1).join(' ') || '',
      email: r.email,
      phone: r.phone || undefined,
      roleId: r.role_id,
      status: r.status,
      active: r.active,
      clientId: r.client_id || undefined,
      allowedInscriptionIds: r.allowed_inscription_ids || undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      lastLoginAt: r.last_login_at ? new Date(r.last_login_at).toISOString() : undefined,
    };
  }
}

export const userRepository = new UserRepository();
