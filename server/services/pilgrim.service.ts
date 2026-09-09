import { pool } from '../db/neon.js';
import { clientRepository } from '../repositories/client.repository.js';
import { inscriptionRepository } from '../repositories/inscription.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { documentRepository } from '../repositories/document.repository.js';
import { visaRepository } from '../repositories/visa.repository.js';
import { logisticsRepository } from '../repositories/logistics.repository.js';
import { userRepository } from '../repositories/user.repository.js';
import { UserSession } from '../../src/types.js';

export class PilgrimService {
  /**
   * Retreives the full Dossier for a Pilgrim with strict data boundary isolation (Rule 10 & 5D Multi-Client)
   */
  public async getPilgrimDossier(clientId: string, caller: UserSession) {
    // 1. Isolation PELERIN stricte multi-clients
    if (caller.role === 'PELERIN') {
      const hasAccess = await userRepository.hasAccessToClient(caller.id, clientId, 'canView');
      if (!hasAccess) {
        throw new Error('ACCES_REFUSE_PELERIN_ISOLATION');
      }
    }

    // 2. Récupérer le client
    const client = await clientRepository.getClientById(clientId);
    if (!client) {
      throw new Error('Client introuvable.');
    }

    // 3. Masquer les notes internes et métadonnées réservées au staff si l'appelant est le pèlerin
    const sanitizedClient = {
      ...client,
      internalNotes: caller.role === 'PELERIN' ? undefined : client.internalNotes,
    };

    // 4. Inscriptions du pèlerin
    const inscriptions = await inscriptionRepository.getInscriptions({ clientId });
    const primaryInscription = inscriptions[0] || null;

    // 5. Paiements du pèlerin (uniquement paiements validés pour le pèlerin)
    const allPayments = await paymentRepository.getPayments({ clientId });
    const payments = caller.role === 'PELERIN'
      ? allPayments.filter((p) => p.status === 'VALIDE')
      : allPayments;

    // 6. Documents visibles par le client
    const allDocs = await documentRepository.getDocuments({ clientId });
    const documents = caller.role === 'PELERIN'
      ? allDocs.filter((d) => d.isClientVisible)
      : allDocs;

    // 7. Visas du pèlerin
    const allVisas = await visaRepository.getVisas();
    const visa = allVisas.find((v) => v.clientId === clientId) || null;

    // 8. Vols et Billets
    const tickets = await logisticsRepository.getTickets({ clientId });
    const allFlights = await logisticsRepository.getFlights();
    const flights = tickets
      .map((t) => allFlights.find((f) => f.id === t.flightId))
      .filter(Boolean);

    // 9. Hébergements & Chambres affectées
    const roomRes = await pool.query(
      `SELECT ra.assigned_at, r.room_number, r.room_type, r.building, r.floor, h.name as hotel_name, h.city, h.address
       FROM room_assignments ra
       JOIN rooms r ON ra.room_id = r.id
       JOIN hotels h ON ra.hotel_id = h.id
       WHERE ra.client_id = $1`,
      [clientId]
    );
    const roomAssignments = roomRes.rows.map((r) => ({
      hotelName: r.hotel_name,
      city: r.city,
      address: r.address,
      roomNumber: r.room_number,
      roomType: r.room_type,
      building: r.building || undefined,
      floor: r.floor || undefined,
      assignedAt: new Date(r.assigned_at).toISOString(),
    }));

    // 10. Groupe et Guide
    const grpRes = await pool.query(
      `SELECT g.name as group_name, g.guide_name, g.bus_number
       FROM group_members gm
       JOIN groups g ON gm.group_id = g.id
       WHERE gm.client_id = $1
       LIMIT 1`,
      [clientId]
    );
    const groupInfo = grpRes.rows.length > 0 ? {
      groupName: grpRes.rows[0].group_name,
      guideName: grpRes.rows[0].guide_name || undefined,
      busNumber: grpRes.rows[0].bus_number || undefined,
    } : null;

    return {
      client: sanitizedClient,
      inscription: primaryInscription,
      inscriptions,
      payments,
      documents,
      visa,
      tickets,
      flights,
      roomAssignments,
      group: groupInfo,
    };
  }

  /**
   * Retourne tous les bénéficiaires / pèlerins sous tutelle accessibles par l'utilisateur
   */
  public async getAccessiblePilgrims(caller: UserSession) {
    if (caller.role === 'PELERIN') {
      return await userRepository.getUserAccessibleClients(caller.id);
    }
    return [];
  }

  /**
   * Ajout d'un membre de la famille / bénéficiaire sous tutelle (Jalon 5D-5)
   */
  public async addBeneficiary(
    caller: UserSession,
    beneficiaryData: {
      firstName: string;
      lastName: string;
      gender: 'M' | 'F';
      phone: string;
      birthDate?: string;
      passportNumber?: string;
      relationshipType?: 'TUTEUR_FAMILLE' | 'PAYEUR_TIERS' | 'TITULAIRE' | 'GESTIONNAIRE';
      campaignId?: string;
      packageId?: string;
    }
  ) {
    // 1. Création de la fiche client
    const client = await clientRepository.createClient({
      firstName: beneficiaryData.firstName.trim().toUpperCase(),
      lastName: beneficiaryData.lastName.trim().toUpperCase(),
      gender: beneficiaryData.gender,
      nationality: 'Sénégalaise',
      status: 'ACTIF',
      phone: beneficiaryData.phone.trim(),
      birthDate: beneficiaryData.birthDate,
      passportNumber: beneficiaryData.passportNumber?.trim() || undefined,
      contactPerson: caller.displayName || caller.email,
      contactPhone: caller.phone || '',
    });

    // 2. Rattachement atomique dans user_client_access
    await userRepository.grantClientAccess({
      userId: caller.id,
      clientId: client.id,
      relationshipType: beneficiaryData.relationshipType || 'TUTEUR_FAMILLE',
      canView: true,
      canPay: true,
      canUploadDocs: true,
    });

    // 3. Optionnel : Inscription automatique si campaignId et packageId fournis
    let inscription = null;
    if (beneficiaryData.campaignId && beneficiaryData.packageId) {
      inscription = await inscriptionRepository.createInscription({
        clientId: client.id,
        campaignId: beneficiaryData.campaignId,
        packageId: beneficiaryData.packageId,
        status: 'CONFIRMEE',
        agentName: caller.displayName || caller.email,
      });
    }

    return {
      client,
      inscription,
      relationshipType: beneficiaryData.relationshipType || 'TUTEUR_FAMILLE',
    };
  }
}

export const pilgrimService = new PilgrimService();
