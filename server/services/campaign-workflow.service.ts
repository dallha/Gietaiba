import pg from 'pg';
import crypto from 'crypto';
import { pool, withTransaction } from '../db/neon.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { Campaign, UserSession } from '../../src/types.js';

export interface CampaignFinancialBalance {
  campaignId: string;
  campaignName: string;
  status: string;
  totalInscriptions: number;
  confirmedInscriptions: number;
  totalRevenueExpected: number;
  totalRevenueCollected: number;
  totalOutstandingBalance: number;
  totalExpenses: number;
  netOperatingResult: number;
}

export class CampaignWorkflowService {
  /**
   * Asserts whether a campaign allows modifications or mutations (e.g. inscriptions, payments, logistics).
   * If the campaign is CLOTUREE:
   * - Blocks standard operations.
   * - Allows exception ONLY for high-privilege roles (SUPER_ADMIN, DIRECTION) with an explicit override reason.
   */
  public async assertCampaignAllowsMutation(
    campaignId: string,
    action: string,
    actor: UserSession,
    override?: { allowOverride?: boolean; reason?: string },
    client?: pg.PoolClient
  ): Promise<void> {
    const runner = client || pool;
    const res = await runner.query<{ id: string; title: string; status: string }>(
      `SELECT id, title, status FROM campaigns WHERE id = $1`,
      [campaignId]
    );

    if (res.rows.length === 0) {
      throw new Error(`Campagne ${campaignId} introuvable.`);
    }

    const campaign = res.rows[0];

    if (campaign.status === 'CLOTUREE') {
      const isPrivileged =
        actor.role === 'SUPER_ADMIN' ||
        actor.role === 'ADMIN' ||
        actor.role === 'DIRECTION' ||
        (actor as any).roles?.includes('SUPER_ADMIN') ||
        (actor as any).roles?.includes('DIRECTION');

      if (override?.allowOverride && isPrivileged && override.reason?.trim()) {
        // Exceptionnelle dérogation administrative auditée
        await auditRepository.logAudit({
          actorUserId: actor.id,
          actorUserName: actor.displayName || actor.email,
          action: 'ADMINISTRATIVE_OVERRIDE_ON_CLOSED_CAMPAIGN',
          entityType: 'CAMPAIGN',
          entityId: campaignId,
          reason: override.reason.trim(),
          newValue: {
            attemptedAction: action,
            campaignStatus: campaign.status,
            overrideGranted: true,
          },
        });
        return;
      }

      throw new Error(
        `MUTATION_FORBIDDEN_ON_CLOSED_CAMPAIGN: La campagne "${campaign.title}" est CLOTUREE. Aucune mutation métier (${action}) n'est autorisée sans dérogation administrative spéciale justifiée.`
      );
    }
  }

  /**
   * Updates campaign lifecycle status with strict transition validation.
   */
  public async transitionCampaignStatus(
    campaignId: string,
    newStatus: 'PLANIFIEE' | 'OUVERTE' | 'EN_COURS' | 'RETOUR' | 'CLOTUREE' | 'ARCHIVEE',
    actor: UserSession,
    reason?: string
  ): Promise<Campaign> {
    return withTransaction(async (client) => {
      const curRes = await client.query(`SELECT * FROM campaigns WHERE id = $1 FOR UPDATE`, [campaignId]);
      if (curRes.rows.length === 0) throw new Error(`Campagne ${campaignId} introuvable.`);
      const current = curRes.rows[0];

      // Transition rules
      const validTransitions: Record<string, string[]> = {
        PLANIFIEE: ['OUVERTE', 'ARCHIVEE'],
        OUVERTE: ['EN_COURS', 'PLANIFIEE', 'ARCHIVEE'],
        EN_COURS: ['RETOUR', 'CLOTUREE'],
        RETOUR: ['CLOTUREE'],
        CLOTUREE: ['ARCHIVEE', 'OUVERTE'], // réouverture exceptionnelle
        ARCHIVEE: ['PLANIFIEE'],
      };

      const allowed = validTransitions[current.status] || [];
      if (!allowed.includes(newStatus)) {
        throw new Error(
          `TRANSITION_INVALID: Impossible de passer la campagne du statut "${current.status}" au statut "${newStatus}". Transitions possibles: [${allowed.join(', ')}].`
        );
      }

      // If closing campaign, verify financial balance can be generated
      if (newStatus === 'CLOTUREE') {
        const balance = await this.getCampaignFinancialBalance(campaignId, client);
        console.log(`[Campaign Closure] Campagne ${campaignId} clôturée. CA: ${balance.totalRevenueExpected}, Encaissé: ${balance.totalRevenueCollected}, Dépenses: ${balance.totalExpenses}, Résultat: ${balance.netOperatingResult}`);
      }

      const updateRes = await client.query(
        `UPDATE campaigns SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [newStatus, campaignId]
      );

      await auditRepository.logAudit({
        actorUserId: actor.id,
        actorUserName: actor.displayName || actor.email,
        action: 'TRANSITION_STATUT_CAMPAGNE',
        entityType: 'CAMPAIGN',
        entityId: campaignId,
        oldValue: { status: current.status },
        newValue: { status: newStatus, reason: reason || 'Changement normal de phase' },
        reason,
      });

      const row = updateRes.rows[0];
      return {
        id: row.id,
        code: row.code || '',
        title: row.title || row.name || '',
        type: row.type,
        year: row.year,
        departureDate: row.departure_date ? new Date(row.departure_date).toISOString().split('T')[0] : (row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : ''),
        returnDate: row.return_date ? new Date(row.return_date).toISOString().split('T')[0] : (row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : ''),
        capacity: row.capacity || 0,
        status: row.status,
        description: row.description || undefined,
        logisticsNotes: row.logistics_notes || undefined,
        responsable: row.responsable || undefined,
        responsablePhone: row.responsable_phone || undefined,
        volsSummary: row.vols_summary || undefined,
        hotelsSummary: row.hotels_summary || undefined,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      };
    });
  }

  /**
   * Computes comprehensive financial and operational closure balance for a campaign.
   */
  public async getCampaignFinancialBalance(
    campaignId: string,
    client?: pg.PoolClient
  ): Promise<CampaignFinancialBalance> {
    const runner = client || pool;

    const campRes = await runner.query(`SELECT id, title, status FROM campaigns WHERE id = $1`, [campaignId]);
    if (campRes.rows.length === 0) throw new Error(`Campagne ${campaignId} introuvable.`);
    const campaign = campRes.rows[0];

    // Inscriptions and expected revenue
    const insRes = await runner.query<{ total: number; confirmed: number; expected_revenue: string }>(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'CONFIRMEE') as confirmed,
        COALESCE(SUM(applied_price) FILTER (WHERE status != 'ANNULEE'), 0) as expected_revenue
       FROM inscriptions
       WHERE campaign_id = $1`,
      [campaignId]
    );

    // Payments collected (only VALIDE)
    const payRes = await runner.query<{ total_collected: string }>(
      `SELECT COALESCE(SUM(p.amount), 0) as total_collected
       FROM payments p
       JOIN inscriptions i ON p.inscription_id = i.id
       WHERE i.campaign_id = $1
         AND p.status = 'VALIDE'`,
      [campaignId]
    );

    // Expenses
    const expRes = await runner.query<{ total_expenses: string }>(
      `SELECT COALESCE(SUM(amount), 0) as total_expenses
       FROM expenses
       WHERE campaign_id = $1`,
      [campaignId]
    );

    const totalRevenueExpected = Number(insRes.rows[0]?.expected_revenue || 0);
    const totalRevenueCollected = Number(payRes.rows[0]?.total_collected || 0);
    const totalOutstandingBalance = totalRevenueExpected - totalRevenueCollected;
    const totalExpenses = Number(expRes.rows[0]?.total_expenses || 0);
    const netOperatingResult = totalRevenueCollected - totalExpenses;

    return {
      campaignId: campaign.id,
      campaignName: campaign.title,
      status: campaign.status,
      totalInscriptions: Number(insRes.rows[0]?.total || 0),
      confirmedInscriptions: Number(insRes.rows[0]?.confirmed || 0),
      totalRevenueExpected,
      totalRevenueCollected,
      totalOutstandingBalance,
      totalExpenses,
      netOperatingResult,
    };
  }
}

export const campaignWorkflowService = new CampaignWorkflowService();
