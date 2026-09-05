import { pool } from '../db/neon.js';
import { DashboardStats } from '../../src/types.js';
import { inscriptionRepository } from '../repositories/inscription.repository.js';
import { campaignRepository } from '../repositories/campaign.repository.js';
import { clientRepository } from '../repositories/client.repository.js';
import { expenseRepository } from '../repositories/expense.repository.js';
import { settingsRepository } from '../repositories/settings.repository.js';

export class DashboardService {
  public async getDashboardStats(): Promise<DashboardStats> {
    const [inscriptions, campaigns, clients, expenses, settings] = await Promise.all([
      inscriptionRepository.getInscriptions(),
      campaignRepository.getCampaigns(),
      clientRepository.getClients(),
      expenseRepository.getExpenses(),
      settingsRepository.getSettings(),
    ]);

    const totalPilgrims = clients.length;
    const totalVoyages = campaigns.length;
    const totalHajj = campaigns.filter((v) => v.type === 'HAJJ').length;
    const totalUmrah = campaigns.filter((v) => v.type === 'OUMRAH').length;

    // Répartition pèlerins par campagne
    const pilgrimsByVoyage = campaigns.map((v) => {
      const count = inscriptions.filter((i) => i.voyageId === v.id && i.status !== 'ANNULEE').length;
      return {
        voyageName: v.title,
        voyageCode: v.code,
        count,
        capacity: v.capacity,
      };
    });

    // Départs imminents
    const upcomingDepartures = campaigns
      .filter((v) => v.status === 'OUVERT' || v.status === 'PLANIFIE')
      .map((v) => {
        const dep = new Date(v.departureDate).getTime();
        const diffDays = Math.ceil((dep - Date.now()) / (1000 * 3600 * 24));
        return {
          title: v.title,
          code: v.code,
          departureDate: v.departureDate,
          daysLeft: Math.max(0, diffDays),
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    // Finances calculées à partir des dossiers non annulés
    const activeInscriptions = inscriptions.filter((i) => i.status !== 'ANNULEE');
    const totalRevenueExpected = activeInscriptions.reduce((sum, i) => sum + i.appliedPrice, 0);
    const totalCollected = activeInscriptions.reduce((sum, i) => sum + (i.totalPaid || 0), 0);
    const totalRemaining = Math.max(0, totalRevenueExpected - totalCollected);
    const recoveryRate = totalRevenueExpected > 0 ? Math.round((totalCollected / totalRevenueExpected) * 100) : 0;

    const paidInFullCount = activeInscriptions.filter((i) => (i.balance || 0) <= 0).length;
    const inProgressCount = activeInscriptions.filter((i) => (i.totalPaid || 0) > 0 && (i.balance || 0) > 0).length;
    const overdueCount = activeInscriptions.filter((i) => (i.totalPaid || 0) === 0).length;

    // Documents
    const completeCount = activeInscriptions.filter((i) => (i.documentCompletenessRate || 0) >= 100).length;
    const incompleteCount = activeInscriptions.filter((i) => (i.documentCompletenessRate || 0) < 100).length;

    // Documents spécifiques
    const validPassportRes = await pool.query(
      `SELECT COUNT(DISTINCT client_id) as cnt FROM documents WHERE type = 'Passeport' AND status = 'VALIDE'`
    );
    const validPassports = parseInt(validPassportRes.rows[0].cnt, 10);

    const approvedVisaRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM visas WHERE status IN ('APPROUVE', 'VALIDE', 'EMIS')`
    );
    const approvedVisas = parseInt(approvedVisaRes.rows[0].cnt, 10);

    const issuedTicketRes = await pool.query(
      `SELECT COUNT(*) as cnt FROM tickets WHERE status = 'EMIS'`
    );
    const issuedTickets = parseInt(issuedTicketRes.rows[0].cnt, 10);

    // Recouvrement
    const highBalanceThreshold = settings.recoveryHighBalanceAmount || 2000000;
    const topDebtors = activeInscriptions
      .filter((i) => (i.balance || 0) > 0)
      .map((i) => {
        const client = i.client;
        const remaining = i.balance || 0;
        let priority: 'NORMAL' | 'IMPORTANT' | 'URGENT' = 'NORMAL';
        if (remaining >= highBalanceThreshold) {
          priority = 'URGENT';
        } else if (remaining > 1000000) {
          priority = 'IMPORTANT';
        }
        return {
          clientName: client ? `${client.firstName} ${client.lastName}` : 'Inconnu',
          phone: client?.phone || '',
          voyageCode: i.voyage?.code || '',
          appliedPrice: i.appliedPrice,
          paid: i.totalPaid || 0,
          remaining,
          priority,
        };
      })
      .sort((a, b) => b.remaining - a.remaining);

    // Rentabilité par campagne
    const profitability = campaigns.map((v) => {
      const voyageInscriptions = activeInscriptions.filter((i) => i.voyageId === v.id);
      const voyageRevenue = voyageInscriptions.reduce((sum, i) => sum + i.appliedPrice, 0);
      const voyageExpenses = expenses.filter((e) => e.voyageId === v.id).reduce((sum, e) => sum + e.amount, 0);
      const netResult = voyageRevenue - voyageExpenses;
      const marginRate = voyageRevenue > 0 ? Math.round((netResult / voyageRevenue) * 100) : 0;
      return {
        voyageCode: v.code,
        voyageTitle: v.title,
        revenue: voyageRevenue,
        expenses: voyageExpenses,
        netResult,
        marginRate,
      };
    });

    return {
      activity: {
        totalPilgrims,
        totalVoyages,
        totalHajj,
        totalUmrah,
        pilgrimsByVoyage,
        upcomingDepartures,
      },
      finance: {
        totalRevenueExpected,
        totalCollected,
        totalRemaining,
        recoveryRate,
        paidInFullCount,
        inProgressCount,
        overdueCount,
      },
      documents: {
        completeCount,
        incompleteCount,
        missingPassports: Math.max(0, activeInscriptions.length - validPassports),
        missingVisas: Math.max(0, activeInscriptions.length - approvedVisas),
        missingTickets: Math.max(0, activeInscriptions.length - issuedTickets),
        expiredDocs: 0,
      },
      recouvrement: {
        topDebtors,
        urgentRemindersCount: topDebtors.filter((d) => d.priority === 'URGENT').length,
      },
      profitability,
    };
  }
}

export const dashboardService = new DashboardService();
