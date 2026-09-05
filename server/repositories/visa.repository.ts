import { pool } from '../db/neon.js';
import { Visa } from '../../src/types.js';

export class VisaRepository {
  public async getVisas(campaignId?: string): Promise<Visa[]> {
    let sql = `
      SELECT v.*
      FROM visas v
      JOIN inscriptions i ON v.inscription_id = i.id
    `;
    const params: any[] = [];
    if (campaignId) {
      params.push(campaignId);
      sql += ` WHERE i.campaign_id = $1`;
    }
    sql += ` ORDER BY v.updated_at DESC`;

    const res = await pool.query(sql, params);
    return res.rows.map(this.mapRowToVisa);
  }

  public async getVisaById(id: string): Promise<Visa | null> {
    const res = await pool.query(`SELECT * FROM visas WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToVisa(res.rows[0]);
  }

  public async updateVisa(id: string, updates: Partial<Visa>): Promise<Visa> {
    const current = await this.getVisaById(id);
    if (!current) throw new Error('Visa introuvable.');

    const merged = { ...current, ...updates };

    const res = await pool.query(
      `UPDATE visas SET
        status = $1,
        visa_number = $2,
        issue_date = $3,
        expiry_date = $4,
        notes = $5,
        updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        merged.status,
        merged.visaNumber || null,
        merged.issueDate ? new Date(merged.issueDate) : null,
        merged.expiryDate ? new Date(merged.expiryDate) : null,
        merged.notes || null,
        id,
      ]
    );

    return this.mapRowToVisa(res.rows[0]);
  }

  private mapRowToVisa(r: any): Visa {
    return {
      id: r.id,
      clientId: r.client_id,
      inscriptionId: r.inscription_id,
      status: r.status,
      visaNumber: r.visa_number || undefined,
      issueDate: r.issue_date ? new Date(r.issue_date).toISOString().split('T')[0] : undefined,
      expiryDate: r.expiry_date ? new Date(r.expiry_date).toISOString().split('T')[0] : undefined,
      notes: r.notes || undefined,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const visaRepository = new VisaRepository();
