import { pool } from '../db/neon.js';
import { Expense } from '../../src/types.js';

export class ExpenseRepository {
  public async getExpenses(campaignId?: string): Promise<Expense[]> {
    let sql = `SELECT * FROM expenses`;
    const params: any[] = [];
    if (campaignId) {
      params.push(campaignId);
      sql += ` WHERE campaign_id = $1`;
    }
    sql += ` ORDER BY date DESC, created_at DESC`;
    const res = await pool.query(sql, params);
    return res.rows.map(this.mapRowToExpense);
  }

  public async getExpenseById(id: string): Promise<Expense | null> {
    const res = await pool.query(`SELECT * FROM expenses WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToExpense(res.rows[0]);
  }

  public async createExpense(
    data: Omit<Expense, 'id' | 'createdAt'>,
    userId?: string,
    userName?: string
  ): Promise<Expense> {
    const id = `exp-${Date.now()}`;
    const res = await pool.query(
      `INSERT INTO expenses (
        id, campaign_id, category, amount, currency, date, supplier, receipt_number,
        comment, created_by, created_by_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *`,
      [
        id,
        data.voyageId,
        data.category,
        data.amount,
        data.currency || 'FCFA',
        new Date(data.date),
        data.supplier || null,
        data.receiptNumber || null,
        data.comment || null,
        userId || null,
        userName || data.createdBy || null,
      ]
    );
    return this.mapRowToExpense(res.rows[0]);
  }

  public async deleteExpense(id: string): Promise<void> {
    await pool.query(`DELETE FROM expenses WHERE id = $1`, [id]);
  }

  private mapRowToExpense(r: any): Expense {
    return {
      id: r.id,
      voyageId: r.campaign_id,
      category: r.category,
      amount: Number(r.amount),
      currency: r.currency || 'FCFA',
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
      supplier: r.supplier || undefined,
      receiptNumber: r.receipt_number || undefined,
      comment: r.comment || undefined,
      createdBy: r.created_by_name || r.created_by || undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const expenseRepository = new ExpenseRepository();
