/**
 * MODULE CENTRALISÉ DES FORMATS DE MATRICULES MÉTIER — GIE TAIBA VOYAGES
 * Source unique de vérité pour la nomenclature officielle Jalon 0.
 *
 * Devise : « Nettoyer le faux. Préserver le vrai. Bloquer l'inconnu. Ne jamais inventer. »
 */

/**
 * Valide et formate une année civile sur 2 chiffres (ex: 2027 -> '27', 2026 -> '26').
 * Rejette toute valeur invalide ou hors plage raisonnable [2000, 2099].
 */
export function formatBusinessYear(year: number): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2099) {
    throw new Error(`INVALID_BUSINESS_YEAR: ${year}`);
  }
  return String(year).slice(-2);
}

/**
 * Formate un matricule client : GT-XXXXXX (séquence globale, 6 chiffres)
 */
export function formatClientCode(seq: number): string {
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`INVALID_CLIENT_SEQUENCE: ${seq}`);
  }
  return `GT-${String(seq).padStart(6, '0')}`;
}

/**
 * Formate un numéro de dossier d'inscription :
 * - Hajj  -> GT-HJ<YY>-XXXXXX
 * - Umrah -> GT-UM<YY>-XXXXXX
 *
 * RÈGLE FONDAMENTALE : Bloquer l'inconnu.
 * Tout type de campagne non explicitement reconnu lève une exception bloquante.
 */
export function formatInscriptionCode(
  campaignType: string,
  year: number,
  seq: number
): string {
  if (!campaignType || typeof campaignType !== 'string') {
    throw new Error(`INVALID_CAMPAIGN_TYPE: ${campaignType}`);
  }

  const type = campaignType.trim().toUpperCase();
  let prefix: 'GT-HJ' | 'GT-UM';

  if (type === 'HAJJ') {
    prefix = 'GT-HJ';
  } else if (type === 'UMRAH' || type === 'OUMRAH') {
    prefix = 'GT-UM';
  } else {
    throw new Error(`UNSUPPORTED_CAMPAIGN_TYPE: ${campaignType}`);
  }

  const yy = formatBusinessYear(year);

  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`INVALID_INSCRIPTION_SEQUENCE: ${seq}`);
  }

  return `${prefix}${yy}-${String(seq).padStart(6, '0')}`;
}

/**
 * Formate un numéro de reçu de paiement : GT-PAY<YY>-XXXXXX
 */
export function formatPaymentReceiptNumber(year: number, seq: number): string {
  const yy = formatBusinessYear(year);
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`INVALID_PAYMENT_SEQUENCE: ${seq}`);
  }
  return `GT-PAY${yy}-${String(seq).padStart(6, '0')}`;
}

/**
 * Formate un code dépense : GT-EXP<YY>-XXXXXX (YY = année de la date comptable)
 */
export function formatExpenseCode(year: number, seq: number): string {
  const yy = formatBusinessYear(year);
  if (!Number.isInteger(seq) || seq < 1) {
    throw new Error(`INVALID_EXPENSE_SEQUENCE: ${seq}`);
  }
  return `GT-EXP${yy}-${String(seq).padStart(6, '0')}`;
}
