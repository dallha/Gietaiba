import { expenseRepository } from '../repositories/expense.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { Expense, UserSession } from '../../src/types.js';

export class ExpenseService {
  public async getExpenses(campaignId?: string): Promise<Expense[]> {
    return expenseRepository.getExpenses(campaignId);
  }

  public async createExpense(data: Omit<Expense, 'id' | 'createdAt'>, actor: UserSession): Promise<Expense> {
    const expense = await expenseRepository.createExpense(
      data,
      actor.id,
      actor.displayName || actor.email
    );

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'AJOUT_DEPENSE',
      entityType: 'EXPENSE',
      entityId: expense.id,
      newValue: { category: expense.category, amount: expense.amount, voyageId: expense.voyageId },
    });

    return expense;
  }

  public async deleteExpense(id: string, actor: UserSession): Promise<{ success: boolean }> {
    const old = await expenseRepository.getExpenseById(id);
    if (!old) throw new Error('Dépense introuvable.');

    await expenseRepository.deleteExpense(id);

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'SUPPRESSION_DEPENSE',
      entityType: 'EXPENSE',
      entityId: id,
      oldValue: old,
    });

    return { success: true };
  }
}

export const expenseService = new ExpenseService();
