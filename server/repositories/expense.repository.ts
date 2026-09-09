import { randomUUID } from 'crypto';
import { pool, getNextBusinessSequence } from '../db/neon.js';
import { Expense } from '../../src/types.js';
import { formatExpenseCode } from '../utils/business-format.js';

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
    const expenseDate = data.date ? new Date(data.date) : new Date();
    const year = expenseDate.getFullYear();
    const seq = await getNextBusinessSequence('EXPENSE', year);
    const code = formatExpenseCode(year, seq);
    const id = randomUUID();

    const res = await pool.query(
      `INSERT INTO expenses (
        id, code, campaign_id, category, amount, currency, date, supplier, receipt_number,
        comment, status, is_test, created_by, created_by_name, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'VALIDE', $11, $12, $13, NOW())
      RETURNING *`,
      [
        id,
        code,
        data.voyageId,
        data.category,
        data.amount,
        data.currency || 'FCFA',
        expenseDate,
        data.supplier || null,
        data.receiptNumber || null,
        data.comment || null,
        Boolean(data.isTest),
        userId || null,
        userName || data.createdBy || null,
      ]
    );
    return this.mapRowToExpense(res.rows[0]);
  }

  public async updateExpense(
    id: string,
    updates: Partial<Expense>
  ): Promise<Expense> {
    const current = await this.getExpenseById(id);
    if (!current) throw new Error('Dépense introuvable');
    if (current.status === 'ANNULEE') {
      throw new Error('Impossible de modifier une dépense annulée.');
    }

    const merged = { ...current, ...updates };
    const res = await pool.query(
      `UPDATE expenses SET
        category = $1,
        amount = $2,
        currency = $3,
        date = $4,
        supplier = $5,
        receipt_number = $6,
        comment = $7
       WHERE id = $8
       RETURNING *`,
      [
        merged.category,
        merged.amount,
        merged.currency || 'FCFA',
        new Date(merged.date),
        merged.supplier || null,
        merged.receiptNumber || null,
        merged.comment || null,
        id,
      ]
    );
    return this.mapRowToExpense(res.rows[0]);
  }

  public async cancelExpense(
    id: string,
    reason: string,
    userId?: string
  ): Promise<Expense> {
    const current = await this.getExpenseById(id);
    if (!current) throw new Error('Dépense introuvable');
    if (current.status === 'ANNULEE') {
      throw new Error('Cette dépense est déjà annulée.');
    }

    const res = await pool.query(
      `UPDATE expenses SET
        status = 'ANNULEE',
        cancellation_reason = $1,
        cancelled_at = NOW(),
        cancelled_by = $2
       WHERE id = $3
       RETURNING *`,
      [reason, userId || null, id]
    );
    return this.mapRowToExpense(res.rows[0]);
  }

  public async deleteExpense(id: string): Promise<void> {
    const current = await this.getExpenseById(id);
    if (!current) return;
    if (current.status === 'VALIDE' && !current.isTest) {
      throw new Error(
        "SUPPRESSION_REFUSEE_DEPENSE_VALIDE: Une dépense enregistrée ne peut pas être supprimée physiquement. Utilisez l'action 'Annuler la dépense'."
      );
    }
    await pool.query(`DELETE FROM expenses WHERE id = $1`, [id]);
  }

  private mapRowToExpense(r: any): Expense {
    return {
      id: r.id,
      code: r.code || undefined,
      voyageId: r.campaign_id,
      category: r.category,
      amount: Number(r.amount),
      currency: r.currency || 'FCFA',
      date: r.date ? new Date(r.date).toISOString().split('T')[0] : '',
      supplier: r.supplier || undefined,
      receiptNumber: r.receipt_number || undefined,
      comment: r.comment || undefined,
      status: r.status || 'VALIDE',
      cancellationReason: r.cancellation_reason || undefined,
      cancelledAt: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : undefined,
      cancelledBy: r.cancelled_by || undefined,
      isTest: Boolean(r.is_test),
      createdBy: r.created_by_name || r.created_by || undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const expenseRepository = new ExpenseRepository();

