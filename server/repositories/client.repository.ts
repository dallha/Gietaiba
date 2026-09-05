import { randomUUID } from 'crypto';
import { pool, getNextBusinessSequence } from '../db/neon.js';
import { Client } from '../../src/types.js';

export class ClientRepository {
  public async getClients(params?: { search?: string; status?: string }): Promise<Client[]> {
    let sql = `SELECT * FROM clients WHERE 1=1`;
    const values: any[] = [];

    if (params?.status) {
      values.push(params.status);
      sql += ` AND status = $${values.length}`;
    }

    if (params?.search) {
      const q = `%${params.search.toLowerCase()}%`;
      values.push(q);
      sql += ` AND (
        LOWER(first_name) LIKE $${values.length} OR
        LOWER(last_name) LIKE $${values.length} OR
        LOWER(code) LIKE $${values.length} OR
        phone LIKE $${values.length} OR
        LOWER(email) LIKE $${values.length}
      )`;
    }

    sql += ` ORDER BY created_at DESC`;

    const res = await pool.query(sql, values);
    return res.rows.map(this.mapRowToClient);
  }

  public async getClientById(id: string): Promise<Client | null> {
    const res = await pool.query(`SELECT * FROM clients WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToClient(res.rows[0]);
  }

  public async getNextClientCode(): Promise<string> {
    const seq = await getNextBusinessSequence('CLIENT', 0);
    return `CLI-${String(seq).padStart(6, '0')}`;
  }

  public async createClient(
    clientData: Omit<Client, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'address' | 'birthDate' | 'profession' | 'contactPerson' | 'contactPhone'> & {
      address?: string;
      birthDate?: string;
      profession?: string;
      contactPerson?: string;
      contactPhone?: string;
    }
  ): Promise<Client> {
    const code = await this.getNextClientCode();
    const id = randomUUID();

    const res = await pool.query(
      `INSERT INTO clients (
        id, code, civility, first_name, last_name, gender, birth_date, nationality,
        phone, whatsapp, email, address, profession, contact_person, contact_phone,
        internal_notes, passport_number, photo_url, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
      RETURNING *`,
      [
        id,
        code,
        clientData.civility || null,
        clientData.firstName,
        clientData.lastName,
        clientData.gender || null,
        clientData.birthDate ? new Date(clientData.birthDate) : null,
        clientData.nationality || 'Sénégalaise',
        clientData.phone,
        clientData.whatsapp || null,
        clientData.email || null,
        clientData.address || null,
        clientData.profession || null,
        clientData.contactPerson || null,
        clientData.contactPhone || null,
        clientData.internalNotes || null,
        clientData.passportNumber || null,
        clientData.photoUrl || null,
        clientData.status || 'ACTIF',
      ]
    );

    return this.mapRowToClient(res.rows[0]);
  }

  public async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    const current = await this.getClientById(id);
    if (!current) throw new Error('Client introuvable');

    const merged: Client = { ...current, ...updates };

    const res = await pool.query(
      `UPDATE clients SET
        civility = $1,
        first_name = $2,
        last_name = $3,
        gender = $4,
        birth_date = $5,
        nationality = $6,
        phone = $7,
        whatsapp = $8,
        email = $9,
        address = $10,
        profession = $11,
        contact_person = $12,
        contact_phone = $13,
        internal_notes = $14,
        passport_number = $15,
        photo_url = $16,
        status = $17,
        updated_at = NOW()
       WHERE id = $18
       RETURNING *`,
      [
        merged.civility || null,
        merged.firstName,
        merged.lastName,
        merged.gender || null,
        merged.birthDate ? new Date(merged.birthDate) : null,
        merged.nationality || 'Sénégalaise',
        merged.phone,
        merged.whatsapp || null,
        merged.email || null,
        merged.address || null,
        merged.profession || null,
        merged.contactPerson || null,
        merged.contactPhone || null,
        merged.internalNotes || null,
        merged.passportNumber || null,
        merged.photoUrl || null,
        merged.status || 'ACTIF',
        id,
      ]
    );

    return this.mapRowToClient(res.rows[0]);
  }

  public async deleteClient(id: string): Promise<void> {
    // Vérification de sécurité : interdire la suppression si le client a des dossiers ou des paiements
    const insCheck = await pool.query(`SELECT COUNT(*) as count FROM inscriptions WHERE client_id = $1`, [id]);
    if (parseInt(insCheck.rows[0].count, 10) > 0) {
      throw new Error('Impossible de supprimer un pèlerin possédant des dossiers d\'inscription.');
    }

    const payCheck = await pool.query(`SELECT COUNT(*) as count FROM payments WHERE client_id = $1`, [id]);
    if (parseInt(payCheck.rows[0].count, 10) > 0) {
      throw new Error('Impossible de supprimer un pèlerin possédant des paiements enregistrés.');
    }

    await pool.query(`DELETE FROM clients WHERE id = $1`, [id]);
  }

  public async countClients(): Promise<number> {
    const res = await pool.query(`SELECT COUNT(*) as count FROM clients`);
    return parseInt(res.rows[0].count, 10);
  }

  private mapRowToClient(r: any): Client {
    return {
      id: r.id,
      code: r.code,
      civility: r.civility || undefined,
      firstName: r.first_name,
      lastName: r.last_name,
      gender: r.gender,
      birthDate: r.birth_date ? new Date(r.birth_date).toISOString().split('T')[0] : '',
      nationality: r.nationality,
      phone: r.phone,
      whatsapp: r.whatsapp || undefined,
      email: r.email || undefined,
      address: r.address || '',
      profession: r.profession || '',
      contactPerson: r.contact_person || '',
      contactPhone: r.contact_phone || '',
      internalNotes: r.internal_notes || undefined,
      passportNumber: r.passport_number || undefined,
      photoUrl: r.photo_url || undefined,
      status: r.status,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const clientRepository = new ClientRepository();
