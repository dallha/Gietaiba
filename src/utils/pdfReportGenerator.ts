import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AgencySettings, Client, Inscription, Payment, Room, Hotel, Voyage } from '../types.js';
import { formatFCFA, formatDate, formatDateTime } from './format.js';

export type ReportType = 'financier' | 'pelerins' | 'rooming' | 'recouvrement' | 'dashboard_summary';

export interface GenerateReportOptions {
  reportType: ReportType;
  clients: Client[];
  inscriptions: Inscription[];
  payments: Payment[];
  voyages: Voyage[];
  rooms: (Room & { occupants: Client[] })[];
  hotels: Hotel[];
  settings?: AgencySettings;
  operatorName?: string;
}

/**
 * Loads the official GIE TAIBA VOYAGES logo and rasterizes it to a PNG data URL for jsPDF.
 */
async function getOfficialLogoDataUrl(url: string = '/assets/logo-taiba.svg'): Promise<string | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 240;
        canvas.height = 240;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 240, 240);
          resolve(canvas.toDataURL('image/png'));
          return;
        }
      } catch {
        // ignore
      }
      resolve(null);
    };
    img.onerror = () => {
      if (url !== '/logo-taiba.svg') {
        const fallbackImg = new Image();
        fallbackImg.crossOrigin = 'anonymous';
        fallbackImg.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 240;
            canvas.height = 240;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(fallbackImg, 0, 0, 240, 240);
              resolve(canvas.toDataURL('image/png'));
              return;
            }
          } catch {
            // ignore
          }
          resolve(null);
        };
        fallbackImg.onerror = () => resolve(null);
        fallbackImg.src = '/logo-taiba.svg';
      } else {
        resolve(null);
      }
    };
    img.src = url;
  });
}

function drawFallbackEmblem(doc: jsPDF, logoX: number, logoY: number): void {
  const logoRadius = 11;
  // Outer gold ring
  doc.setFillColor(217, 119, 6); // amber-600
  doc.circle(logoX + logoRadius, logoY + logoRadius, logoRadius, 'F');

  // Inner navy circle
  doc.setFillColor(15, 23, 42); // slate-900
  doc.circle(logoX + logoRadius, logoY + logoRadius, logoRadius - 1.2, 'F');

  // Gold emblem ring
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.4);
  doc.circle(logoX + logoRadius, logoY + logoRadius, logoRadius - 2.5, 'S');

  // Official Agency Text
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('TAIBA', logoX + logoRadius, logoY + logoRadius + 0.5, { align: 'center' });

  doc.setFontSize(4.5);
  doc.setTextColor(255, 255, 255);
  doc.text('VOYAGES', logoX + logoRadius, logoY + logoRadius + 4, { align: 'center' });
}

/**
 * Draws the official agency header, logo crest, and legal credentials on the PDF.
 */
function drawAgencyHeader(
  doc: jsPDF,
  settings: AgencySettings | undefined,
  title: string,
  subtitle: string,
  referenceCode: string,
  logoDataUrl?: string | null
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 14;

  // 1. Top subtle decorative banner bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 4, 'F');
  doc.setFillColor(217, 119, 6); // amber-600 gold
  doc.rect(0, 4, pageWidth, 1.5, 'F');

  currentY += 4;

  // 2. Official Agency Emblem / Logo
  const logoX = 14;
  const logoY = currentY + 3;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', logoX, logoY, 22, 22);
    } catch {
      drawFallbackEmblem(doc, logoX, logoY);
    }
  } else {
    drawFallbackEmblem(doc, logoX, logoY);
  }

  // 3. Official Agency Identification Text
  const agencyName = settings?.agencyName || 'GIE TAIBA VOYAGES';
  const agencySub = settings?.subtitle || 'Agence Agréée Hajj & Oumrah — Sénégal & Arabie Saoudite';
  const ninea = settings?.ninea || '005421882 2V3';
  const rcNumber = settings?.rcNumber || 'SN.DKR.2014.B.1820';
  const license = settings?.licenseNumber || 'HAJJ-SN-2027-042';
  const phone = settings?.phone || '+221 33 824 55 00 / +221 77 638 90 90';
  const email = settings?.email || 'contact@taiba-voyages.sn';
  const address = settings?.address || 'Avenue Cheikh Anta Diop, Immeuble Taiba, Dakar, Sénégal';

  const textStartX = 42;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(agencyName, textStartX, currentY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(agencySub.toUpperCase(), textStartX, currentY + 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(
    `NINEA : ${ninea}   •   RC : ${rcNumber}   •   Agrément État : ${license}`,
    textStartX,
    currentY + 16
  );
  doc.text(
    `${address}   •   Tél : ${phone}   •   Email : ${email}`,
    textStartX,
    currentY + 20
  );

  // 4. Right side: Report Meta & Certification Stamp
  const metaRightX = pageWidth - 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`RÉFÉRENCE : ${referenceCode}`, metaRightX, currentY + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date d'édition : ${formatDate(new Date().toISOString())}`, metaRightX, currentY + 11.5, {
    align: 'right',
  });

  // Official Seal Badge in green
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(5, 150, 105); // emerald-600
  doc.setLineWidth(0.3);
  doc.roundedRect(metaRightX - 44, currentY + 14, 44, 7, 1.5, 1.5, 'FD');

  doc.setTextColor(4, 120, 87);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('DOCUMENT OFFICIEL GIE TAIBA', metaRightX - 22, currentY + 18.5, { align: 'center' });

  currentY += 28;

  // 5. Divider Line
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.5);
  doc.line(14, currentY, pageWidth - 14, currentY);

  currentY += 6;

  // 6. Report Title Banner
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, pageWidth - 28, 14, 2, 2, 'FD');

  // Left accent line
  doc.setFillColor(217, 119, 6);
  doc.rect(14, currentY, 2.5, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(title.toUpperCase(), 20, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle, 20, currentY + 10.5);

  currentY += 19;

  return currentY;
}

/**
 * Draws KPI summary metric boxes
 */
function drawKpiBoxes(
  doc: jsPDF,
  startY: number,
  items: { label: string; value: string; color?: [number, number, number] }[]
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - 28;
  const count = items.length;
  const gap = 3;
  const boxWidth = (contentWidth - gap * (count - 1)) / count;
  const boxHeight = 15;

  items.forEach((item, idx) => {
    const x = 14 + idx * (boxWidth + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, startY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(item.label, x + boxWidth / 2, startY + 5, { align: 'center' });

    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const col = item.color || [15, 23, 42];
    doc.setTextColor(col[0], col[1], col[2]);
    doc.text(item.value, x + boxWidth / 2, startY + 11.5, { align: 'center' });
  });

  return startY + boxHeight + 6;
}

/**
 * Draws the official closing signatures, legal footer and page numbers
 */
function applyDocumentFooterAndSignatures(doc: jsPDF, settings?: AgencySettings) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);

    // If it's the last page, draw official signature & stamp block
    if (i === pageCount) {
      const stampBoxY = pageHeight - 40;

      // Bottom legal certification
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `Pour la Direction Générale — ${settings?.agencyName || 'GIE TAIBA VOYAGES'}`,
        14,
        stampBoxY + 4
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Document original certifié exact, valant pièce comptable et légale officielle.',
        14,
        stampBoxY + 8.5
      );
      doc.text(
        `Régie Générale du Pèlerinage • Agrément N° ${settings?.licenseNumber || 'HAJJ-SN-2027-042'}`,
        14,
        stampBoxY + 12.5
      );

      // Official Stamp / Visa Box
      const stampWidth = 46;
      const stampHeight = 18;
      const stampX = pageWidth - 14 - stampWidth;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(217, 119, 6); // amber gold border
      doc.setLineWidth(0.6);
      doc.roundedRect(stampX, stampBoxY, stampWidth, stampHeight, 2, 2, 'FD');

      // Inner faint ring
      doc.setDrawColor(254, 215, 170); // amber-200
      doc.setLineWidth(0.3);
      doc.roundedRect(stampX + 1.5, stampBoxY + 1.5, stampWidth - 3, stampHeight - 3, 1.5, 1.5, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(180, 83, 9);
      doc.text('VISA OFFICIEL & CACHET', stampX + stampWidth / 2, stampBoxY + 4.5, { align: 'center' });

      doc.setFontSize(5);
      doc.setTextColor(100, 116, 139);
      doc.text('DÉLÉGATION GÉNÉRALE', stampX + stampWidth / 2, stampBoxY + 8, { align: 'center' });
      doc.text(`${settings?.agencyName || 'GIE TAIBA VOYAGES'}`, stampX + stampWidth / 2, stampBoxY + 11.5, {
        align: 'center',
      });
      doc.text(`Édité le ${formatDate(new Date().toISOString())}`, stampX + stampWidth / 2, stampBoxY + 15, {
        align: 'center',
      });
    }

    // Bottom single-line footer on every page
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(
      `${settings?.agencyName || 'GIE TAIBA VOYAGES'} • Progiciel ERP Taiba V4 • Confidentiel`,
      14,
      pageHeight - 7
    );

    doc.text(`Page ${i} sur ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }
}

/**
 * Main export function to generate and download the structured PDF report
 */
export async function downloadStructuredPdfReport(options: GenerateReportOptions): Promise<string> {
  const { reportType, clients, inscriptions, payments, voyages, rooms, hotels, settings } = options;

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const refCode = `RPT-${dateStr.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Landscape for Rooming and Manifeste (more columns), Portrait for Financial & Summary
  const isLandscape = reportType === 'rooming' || reportType === 'pelerins';
  const doc = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Calculate high-level financial metrics
  const totalCA = inscriptions.reduce((acc, i) => acc + (i.appliedPrice || 0), 0);
  const totalEncaissé = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
  const totalReste = inscriptions.reduce((acc, i) => acc + (i.balance || 0), 0);
  const tauxRecouvrement = totalCA > 0 ? Math.round((totalEncaissé / totalCA) * 100) : 0;

  const logoDataUrl = await getOfficialLogoDataUrl(
    settings?.logoUrl && settings.logoUrl !== '/logo.png' ? settings.logoUrl : '/assets/logo-taiba.svg'
  );

  let fileName = `Rapport_${reportType}_${dateStr}.pdf`;

  // ==========================================
  // 1. RAPPORT FINANCIER & SITUATION DE CAISSE
  // ==========================================
  if (reportType === 'financier') {
    fileName = `Rapport_Financier_Caisse_${settings?.agencyName ? settings.agencyName.replace(/\s+/g, '_') : 'GIE_TAIBA'}_${dateStr}.pdf`;

    const startY = drawAgencyHeader(
      doc,
      settings,
      'Bilan Financier Général & État de Caisse',
      'Synthèse des engagements pèlerins, encaissements consolidés et créances résiduelles',
      refCode,
      logoDataUrl
    );

    const afterKpis = drawKpiBoxes(doc, startY, [
      { label: 'Total Facturé Contrats', value: formatFCFA(totalCA), color: [15, 23, 42] },
      { label: 'Total Encaissé en Caisse', value: formatFCFA(totalEncaissé), color: [5, 150, 105] },
      { label: 'Créances Résiduelles', value: formatFCFA(totalReste), color: [217, 119, 6] },
      { label: 'Taux de Recouvrement', value: `${tauxRecouvrement}%`, color: [37, 99, 235] },
    ]);

    // Financial Table: Payments Ledger
    const tableData = payments.map((p) => [
      p.receiptNumber || '—',
      formatDate(p.paymentDate),
      p.clientName || 'Pèlerin',
      p.voyageCode || 'Hajj 2027',
      p.paymentMethod || 'Espèces',
      formatFCFA(p.amount),
    ]);

    autoTable(doc, {
      startY: afterKpis,
      head: [['N° Reçu', 'Date Paiement', 'Pèlerin / Bénéficiaire', 'Voyage / Code', 'Mode Règlement', 'Montant Encaissé']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [245, 158, 11],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'left',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 28 },
        1: { cellWidth: 24 },
        2: { cellWidth: 42 },
        3: { cellWidth: 28 },
        4: { cellWidth: 28 },
        5: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
      },
      styles: {
        fontSize: 7,
        cellPadding: 2.2,
      },
      margin: { left: 14, right: 14, bottom: 42 },
    });
  }

  // ==========================================
  // 2. MANIFESTE OFFICIEL DES PÈLERINS
  // ==========================================
  else if (reportType === 'pelerins') {
    fileName = `Manifeste_Officiel_Pelerins_${dateStr}.pdf`;

    const startY = drawAgencyHeader(
      doc,
      settings,
      'Manifeste Officiel des Pèlerins Inscrits',
      'Document officiel d’enregistrement transmis à la Délégation Générale au Pèlerinage',
      refCode,
      logoDataUrl
    );

    const totalPelerins = inscriptions.length;
    const pelerinsSoldes = inscriptions.filter((i) => i.balance === 0).length;

    const afterKpis = drawKpiBoxes(doc, startY, [
      { label: 'Effectif Total Pèlerins', value: `${totalPelerins} Pèlerins`, color: [15, 23, 42] },
      { label: 'Pèlerins Totalement Soldés', value: `${pelerinsSoldes} (${Math.round((pelerinsSoldes / Math.max(1, totalPelerins)) * 100)}%)`, color: [5, 150, 105] },
      { label: 'En Cours de Paiement', value: `${totalPelerins - pelerinsSoldes}`, color: [217, 119, 6] },
      { label: 'Total Facturé Campagne', value: formatFCFA(totalCA), color: [37, 99, 235] },
    ]);

    const tableData = inscriptions.map((ins, index) => [
      String(index + 1),
      ins.code || `INS-${index + 1}`,
      `${ins.client?.civility || ''} ${ins.client?.lastName || ''} ${ins.client?.firstName || ''}`.trim(),
      ins.client?.passportNumber || 'En attente',
      ins.client?.nationality || 'Sénégalaise',
      ins.client?.phone || '—',
      ins.package?.name || 'Standard',
      ins.balance === 0 ? 'SOLDÉ (100%)' : `Reste: ${formatFCFA(ins.balance)}`,
    ]);

    autoTable(doc, {
      startY: afterKpis,
      head: [['N°', 'Code Dossier', 'Nom & Prénoms Pèlerin', 'N° Passeport', 'Nationalité', 'Téléphone', 'Formule Package', 'Statut Solde']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [245, 158, 11],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26, fontStyle: 'bold' },
        2: { cellWidth: 48, fontStyle: 'bold' },
        3: { cellWidth: 30, fontStyle: 'bold' },
        4: { cellWidth: 26 },
        5: { cellWidth: 32 },
        6: { cellWidth: 32 },
        7: { halign: 'right', fontStyle: 'bold' },
      },
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
      margin: { left: 14, right: 14, bottom: 42 },
    });
  }

  // ==========================================
  // 3. ROOMING LIST OFFICIELLE
  // ==========================================
  else if (reportType === 'rooming') {
    fileName = `Rooming_List_Officielle_${dateStr}.pdf`;

    const startY = drawAgencyHeader(
      doc,
      settings,
      'Plan de Répartition des Chambres (Rooming List Officielle)',
      'Attribution des lits et des chambres d’hôtels pour Makkah Al-Mukarramah et Médine',
      refCode,
      logoDataUrl
    );

    const totalRooms = rooms.length;
    const totalBeds = rooms.reduce((sum, r) => sum + r.capacity, 0);
    const totalOccupants = rooms.reduce((sum, r) => sum + (r.occupants?.length || 0), 0);
    const tauxRemplissage = totalBeds > 0 ? Math.round((totalOccupants / totalBeds) * 100) : 0;

    const afterKpis = drawKpiBoxes(doc, startY, [
      { label: 'Chambres Rentrées', value: `${totalRooms} Chambres`, color: [15, 23, 42] },
      { label: 'Capacité Lits Totale', value: `${totalBeds} Lits`, color: [37, 99, 235] },
      { label: 'Pèlerins Logés', value: `${totalOccupants} Pèlerins`, color: [5, 150, 105] },
      { label: "Taux d'Occupation Lits", value: `${tauxRemplissage}%`, color: [217, 119, 6] },
    ]);

    const tableData = rooms.map((room) => {
      const hotel = hotels.find((h) => h.id === room.hotelId);
      const occupantsList =
        room.occupants && room.occupants.length > 0
          ? room.occupants.map((o) => `${o.civility || ''} ${o.lastName || ''} ${o.firstName || ''}`).join(', ')
          : '— Aucune attribution (Chambre disponible)';

      return [
        `Ch. ${room.roomNumber}`,
        `${hotel?.name || 'Hôtel'} (${hotel?.city || 'Arabie Saoudite'})`,
        room.roomType || 'Standard',
        occupantsList,
        `${room.occupants?.length || 0} / ${room.capacity} lits`,
      ];
    });

    autoTable(doc, {
      startY: afterKpis,
      head: [['N° Chambre', 'Hôtel & Ville', 'Type Chambre', 'Pèlerins Occupants Désignés', 'Remplissage']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [245, 158, 11],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 46 },
        2: { cellWidth: 28 },
        3: { cellWidth: 130 },
        4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      },
      styles: {
        fontSize: 7,
        cellPadding: 2.2,
      },
      margin: { left: 14, right: 14, bottom: 42 },
    });
  }

  // ==========================================
  // 4. BORDEREAU DE RECOUVREMENT DES CRÉANCES
  // ==========================================
  else if (reportType === 'recouvrement') {
    fileName = `Bordereau_Recouvrement_Creances_${dateStr}.pdf`;

    const startY = drawAgencyHeader(
      doc,
      settings,
      'Bordereau de Recouvrement des Créances & Débiteurs',
      'Listing prioritaire des soldes résiduels pèlerins à régulariser avant émission des billets',
      refCode,
      logoDataUrl
    );

    const debtors = inscriptions.filter((i) => (i.balance || 0) > 0);
    const debtorsCount = debtors.length;

    const afterKpis = drawKpiBoxes(doc, startY, [
      { label: 'Pèlerins Débiteurs', value: `${debtorsCount} Dossiers`, color: [225, 29, 72] },
      { label: 'Montant Total à Recouvrer', value: formatFCFA(totalReste), color: [180, 83, 9] },
      { label: 'Total Acomptes Reçus', value: formatFCFA(totalEncaissé), color: [5, 150, 105] },
      { label: 'Taux Global de Recouvrement', value: `${tauxRecouvrement}%`, color: [37, 99, 235] },
    ]);

    const tableData = debtors.map((ins) => [
      ins.code || '—',
      `${ins.client?.civility || ''} ${ins.client?.lastName || ''} ${ins.client?.firstName || ''}`.trim(),
      ins.client?.phone || '—',
      ins.package?.name || 'Standard',
      formatFCFA(ins.appliedPrice),
      formatFCFA(ins.totalPaid),
      formatFCFA(ins.balance),
    ]);

    autoTable(doc, {
      startY: afterKpis,
      head: [['Dossier', 'Pèlerin', 'Téléphone', 'Package', 'Prix Total', 'Acomptes Reçus', 'Reste Dû']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [245, 158, 11],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 46, fontStyle: 'bold' },
        2: { cellWidth: 30 },
        3: { cellWidth: 26 },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 26, halign: 'right', textColor: [5, 150, 105] },
        6: { halign: 'right', fontStyle: 'bold', textColor: [225, 29, 72] },
      },
      styles: {
        fontSize: 7,
        cellPadding: 2.2,
      },
      margin: { left: 14, right: 14, bottom: 42 },
    });
  }

  // ==========================================
  // 5. SYNTHÈSE GLOBALE & TABLEAU DE BORD (DASHBOARD SUMMARY)
  // ==========================================
  else {
    fileName = `Synthese_Globale_Dashboard_${dateStr}.pdf`;

    const startY = drawAgencyHeader(
      doc,
      settings,
      'Synthèse Globale & Tableau de Bord Exécutif',
      'Revue consolidée des opérations pèlerinage, trésorerie et logistique',
      refCode,
      logoDataUrl
    );

    const totalPelerins = inscriptions.length;
    const totalHotels = hotels.length;

    const afterKpis = drawKpiBoxes(doc, startY, [
      { label: 'Chiffre d’Affaires Engagé', value: formatFCFA(totalCA), color: [15, 23, 42] },
      { label: 'Encaissements Effectués', value: formatFCFA(totalEncaissé), color: [5, 150, 105] },
      { label: 'Solde Résiduel Global', value: formatFCFA(totalReste), color: [217, 119, 6] },
      { label: 'Pèlerins Inscrits', value: `${totalPelerins}`, color: [37, 99, 235] },
    ]);

    // Summary of Voyages / Campaigns
    const voyagesSummary = voyages.map((v) => {
      const vInscriptions = inscriptions.filter((i) => i.voyageId === v.id);
      const vCA = vInscriptions.reduce((acc, i) => acc + (i.appliedPrice || 0), 0);
      const vPaid = vInscriptions.reduce((acc, i) => acc + (i.totalPaid || 0), 0);

      return [
        v.code || '—',
        v.title,
        v.type,
        formatDate(v.departureDate),
        `${vInscriptions.length} / ${v.capacity || 0}`,
        formatFCFA(vCA),
        formatFCFA(vPaid),
      ];
    });

    autoTable(doc, {
      startY: afterKpis,
      head: [['Code', 'Campagne / Voyage', 'Type', 'Départ', 'Inscriptions', 'CA Total', 'Encaissé']],
      body: voyagesSummary,
      theme: 'striped',
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [245, 158, 11],
        fontSize: 7.5,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 26, fontStyle: 'bold' },
        1: { cellWidth: 48, fontStyle: 'bold' },
        2: { cellWidth: 20 },
        3: { cellWidth: 22 },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 26, halign: 'right' },
        6: { halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] },
      },
      styles: {
        fontSize: 7,
        cellPadding: 2.2,
      },
      margin: { left: 14, right: 14, bottom: 42 },
    });
  }

  // Apply signatures and footers across all pages
  applyDocumentFooterAndSignatures(doc, settings);

  // Trigger browser download
  doc.save(fileName);

  return fileName;
}
