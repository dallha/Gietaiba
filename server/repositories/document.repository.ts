import { randomUUID } from 'crypto';
import { pool } from '../db/neon.js';
import { PilgrimDocument } from '../../src/types.js';

export class DocumentRepository {
  public async getDocuments(query?: { clientId?: string; inscriptionId?: string }): Promise<PilgrimDocument[]> {
    let sql = `SELECT * FROM documents WHERE 1=1`;
    const params: any[] = [];

    if (query?.clientId) {
      params.push(query.clientId);
      sql += ` AND client_id = $${params.length}`;
    }
    if (query?.inscriptionId) {
      params.push(query.inscriptionId);
      sql += ` AND inscription_id = $${params.length}`;
    }

    sql += ` ORDER BY created_at DESC`;
    const res = await pool.query(sql, params);
    return res.rows.map(this.mapRowToDoc);
  }

  public async getDocumentById(id: string): Promise<PilgrimDocument | null> {
    const res = await pool.query(`SELECT * FROM documents WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToDoc(res.rows[0]);
  }

  public async createDocument(data: Omit<PilgrimDocument, 'id' | 'createdAt'>): Promise<PilgrimDocument> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO documents (
        id, client_id, inscription_id, type, file_name, file_url, received_date,
        expiry_date, status, comment, validated_by, validated_at, is_client_visible, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *`,
      [
        id,
        data.clientId,
        data.inscriptionId || null,
        data.type,
        data.fileName || null,
        data.fileUrl || null,
        data.receivedDate ? new Date(data.receivedDate) : null,
        data.expiryDate ? new Date(data.expiryDate) : null,
        data.status || 'RECU',
        data.comment || null,
        data.validatedBy || null,
        data.validatedAt ? new Date(data.validatedAt) : null,
        data.isClientVisible !== false,
      ]
    );

    return this.mapRowToDoc(res.rows[0]);
  }

  public async updateDocumentStatus(
    id: string,
    status: PilgrimDocument['status'],
    comment?: string,
    validatedBy?: string
  ): Promise<PilgrimDocument> {
    const isValide = status === 'VALIDE';
    const res = await pool.query(
      `UPDATE documents SET
        status = $1,
        comment = COALESCE($2, comment),
        validated_by = CASE WHEN $3 THEN $4 ELSE validated_by END,
        validated_at = CASE WHEN $3 THEN NOW() ELSE validated_at END
       WHERE id = $5
       RETURNING *`,
      [status, comment !== undefined ? comment : null, isValide, validatedBy || null, id]
    );
    if (res.rows.length === 0) throw new Error('Document introuvable.');
    return this.mapRowToDoc(res.rows[0]);
  }

  private mapRowToDoc(r: any): PilgrimDocument {
    return {
      id: r.id,
      clientId: r.client_id,
      inscriptionId: r.inscription_id || '',
      type: r.type,
      fileName: r.file_name || '',
      fileUrl: r.file_url || undefined,
      receivedDate: r.received_date ? new Date(r.received_date).toISOString() : undefined,
      expiryDate: r.expiry_date ? new Date(r.expiry_date).toISOString().split('T')[0] : undefined,
      status: r.status,
      comment: r.comment || undefined,
      validatedBy: r.validated_by || undefined,
      validatedAt: r.validated_at ? new Date(r.validated_at).toISOString() : undefined,
      isClientVisible: r.is_client_visible,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const documentRepository = new DocumentRepository();
