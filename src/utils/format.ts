export function formatFCFA(amount: number | undefined | null, currency: string = 'FCFA'): string {
  if (amount === undefined || amount === null || isNaN(amount)) return `0 ${currency}`;
  const formatted = new Intl.NumberFormat('fr-FR').format(Math.round(amount));
  return `${formatted} ${currency}`;
}

export function formatDate(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | undefined | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function getPaymentStatusBadge(status?: string) {
  switch (status) {
    case 'SOLDE':
      return { label: 'Soldé (100%)', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    case 'EN_COURS':
      return { label: 'En cours', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
    case 'EN_RETARD':
      return { label: 'En retard', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'IMPAYE':
    default:
      return { label: 'Impayé (0%)', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
  }
}

export function getDocStatusBadge(status?: string) {
  switch (status) {
    case 'VALIDE':
      return { label: 'Validé', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    case 'RECU':
      return { label: 'Reçu', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
    case 'EN_VERIFICATION':
      return { label: 'En vérification', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'EXPIRE':
      return { label: 'Expiré', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
    case 'REFUSE':
      return { label: 'Refusé', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
    case 'MANQUANT':
    default:
      return { label: 'Manquant', bg: 'bg-gray-100 text-gray-700 border-gray-200' };
  }
}

export function getVisaStatusBadge(status?: string) {
  switch (status) {
    case 'APPROUVE':
      return { label: 'Visa Approuvé', bg: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
    case 'DEMANDE':
    case 'EN_TRAITEMENT':
      return { label: 'En traitement Nusuk', bg: 'bg-blue-50 text-blue-800 border-blue-200' };
    case 'DOSSIER_EN_PREPARATION':
      return { label: 'Préparation dossier', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'REFUSE':
      return { label: 'Refusé', bg: 'bg-rose-50 text-rose-800 border-rose-200' };
    case 'EXPIRE':
      return { label: 'Expiré', bg: 'bg-purple-50 text-purple-800 border-purple-200' };
    case 'NON_DEMANDE':
    default:
      return { label: 'Non demandé', bg: 'bg-gray-100 text-gray-600 border-gray-200' };
  }
}
