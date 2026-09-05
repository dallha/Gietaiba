import { pool } from '../db/neon.js';
import { AgencySettings } from '../../src/types.js';

export class SettingsRepository {
  public async getSettings(): Promise<AgencySettings> {
    const res = await pool.query(`SELECT * FROM settings LIMIT 1`);
    if (res.rows.length === 0) {
      throw new Error('Aucun paramètre d\'agence configuré.');
    }
    const r = res.rows[0];
    return this.mapRowToSettings(r);
  }

  public async updateSettings(updates: Partial<AgencySettings>): Promise<AgencySettings> {
    const current = await this.getSettings();
    const merged: AgencySettings = { ...current, ...updates };

    const res = await pool.query(
      `UPDATE settings SET
        agency_name = $1,
        subtitle = $2,
        logo_url = $3,
        currency = $4,
        default_currency = $5,
        phone = $6,
        email = $7,
        address = $8,
        city = $9,
        country = $10,
        rc_number = $11,
        license_number = $12,
        tax_id = $13,
        ninea = $14,
        receipt_footer_terms = $15,
        bank_details = $16,
        mobile_money_numbers = $17,
        recovery_urgent_threshold_days = $18,
        recovery_high_balance_amount = $19,
        default_required_document_types = $20,
        payment_methods = $21,
        expense_categories = $22,
        cities = $23,
        updated_at = NOW()
       WHERE id = $24
       RETURNING *`,
      [
        merged.agencyName,
        merged.subtitle || null,
        merged.logoUrl || null,
        merged.currency || 'FCFA',
        merged.defaultCurrency || 'FCFA',
        merged.phone,
        merged.email,
        merged.address,
        merged.city || null,
        merged.country || null,
        merged.rcNumber || null,
        merged.licenseNumber || null,
        merged.taxId || null,
        merged.ninea || null,
        merged.receiptFooterTerms || null,
        JSON.stringify(merged.bankDetails || {}),
        JSON.stringify(merged.mobileMoneyNumbers || {}),
        merged.recoveryUrgentThresholdDays || 15,
        merged.recoveryHighBalanceAmount || 2000000,
        merged.defaultRequiredDocumentTypes || [],
        merged.paymentMethods || [],
        merged.expenseCategories || [],
        merged.cities || [],
        current.id || 'setting-1',
      ]
    );

    return this.mapRowToSettings(res.rows[0]);
  }

  private mapRowToSettings(r: any): AgencySettings {
    return {
      id: r.id,
      agencyName: r.agency_name,
      subtitle: r.subtitle || undefined,
      logoUrl: r.logo_url || undefined,
      currency: r.currency,
      defaultCurrency: r.default_currency,
      phone: r.phone,
      email: r.email,
      address: r.address,
      city: r.city || undefined,
      country: r.country || undefined,
      rcNumber: r.rc_number || undefined,
      licenseNumber: r.license_number || undefined,
      taxId: r.tax_id || undefined,
      ninea: r.ninea || undefined,
      receiptFooterTerms: r.receipt_footer_terms || undefined,
      bankDetails: typeof r.bank_details === 'string' ? JSON.parse(r.bank_details) : r.bank_details || {},
      mobileMoneyNumbers: typeof r.mobile_money_numbers === 'string' ? JSON.parse(r.mobile_money_numbers) : r.mobile_money_numbers || {},
      recoveryUrgentThresholdDays: r.recovery_urgent_threshold_days,
      recoveryHighBalanceAmount: Number(r.recovery_high_balance_amount),
      defaultRequiredDocumentTypes: r.default_required_document_types || [],
      paymentMethods: r.payment_methods || [],
      expenseCategories: r.expense_categories || [],
      cities: r.cities || [],
    };
  }
}

export const settingsRepository = new SettingsRepository();
