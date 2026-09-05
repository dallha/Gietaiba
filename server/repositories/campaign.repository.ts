import { pool } from '../db/neon.js';
import { Voyage } from '../../src/types.js';

export class CampaignRepository {
  public async getCampaigns(): Promise<Voyage[]> {
    const res = await pool.query(`SELECT * FROM campaigns ORDER BY year DESC, departure_date ASC`);
    return res.rows.map(this.mapRowToCampaign);
  }

  public async getCampaignById(id: string): Promise<Voyage | null> {
    const res = await pool.query(`SELECT * FROM campaigns WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToCampaign(res.rows[0]);
  }

  public async createCampaign(data: Omit<Voyage, 'id' | 'createdAt'>): Promise<Voyage> {
    const id = `voy-${Date.now()}`;
    const res = await pool.query(
      `INSERT INTO campaigns (
        id, code, title, type, year, departure_date, return_date, capacity, status,
        description, logistics_notes, responsable, responsable_phone, vols_summary, hotels_summary,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
      RETURNING *`,
      [
        id,
        data.code,
        data.title,
        data.type,
        data.year,
        new Date(data.departureDate),
        new Date(data.returnDate),
        data.capacity,
        data.status || 'OUVERT',
        data.description || null,
        data.logisticsNotes || null,
        data.responsable || null,
        data.responsablePhone || null,
        data.volsSummary || null,
        data.hotelsSummary || null,
      ]
    );

    return this.mapRowToCampaign(res.rows[0]);
  }

  public async updateCampaign(id: string, updates: Partial<Voyage>): Promise<Voyage> {
    const current = await this.getCampaignById(id);
    if (!current) throw new Error('Campagne introuvable');

    const merged = { ...current, ...updates };

    const res = await pool.query(
      `UPDATE campaigns SET
        code = $1,
        title = $2,
        type = $3,
        year = $4,
        departure_date = $5,
        return_date = $6,
        capacity = $7,
        status = $8,
        description = $9,
        logistics_notes = $10,
        responsable = $11,
        responsable_phone = $12,
        vols_summary = $13,
        hotels_summary = $14,
        updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [
        merged.code,
        merged.title,
        merged.type,
        merged.year,
        new Date(merged.departureDate),
        new Date(merged.returnDate),
        merged.capacity,
        merged.status,
        merged.description || null,
        merged.logisticsNotes || null,
        merged.responsable || null,
        merged.responsablePhone || null,
        merged.volsSummary || null,
        merged.hotelsSummary || null,
        id,
      ]
    );

    return this.mapRowToCampaign(res.rows[0]);
  }

  public async deleteCampaign(id: string): Promise<void> {
    const insCheck = await pool.query(`SELECT COUNT(*) as count FROM inscriptions WHERE campaign_id = $1`, [id]);
    if (parseInt(insCheck.rows[0].count, 10) > 0) {
      throw new Error('Impossible de supprimer une campagne possédant des inscriptions actives.');
    }
    await pool.query(`DELETE FROM campaigns WHERE id = $1`, [id]);
  }

  private mapRowToCampaign(r: any): Voyage {
    return {
      id: r.id,
      code: r.code,
      title: r.title,
      type: r.type,
      year: r.year,
      departureDate: r.departure_date ? new Date(r.departure_date).toISOString().split('T')[0] : '',
      returnDate: r.return_date ? new Date(r.return_date).toISOString().split('T')[0] : '',
      capacity: r.capacity,
      status: r.status,
      description: r.description || undefined,
      logisticsNotes: r.logistics_notes || undefined,
      responsable: r.responsable || undefined,
      responsablePhone: r.responsable_phone || undefined,
      volsSummary: r.vols_summary || undefined,
      hotelsSummary: r.hotels_summary || undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const campaignRepository = new CampaignRepository();
