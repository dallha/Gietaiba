import { pool } from '../db/neon.js';
import { clientRepository } from '../repositories/client.repository.js';
import { inscriptionRepository } from '../repositories/inscription.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { documentRepository } from '../repositories/document.repository.js';
import { visaRepository } from '../repositories/visa.repository.js';
import { logisticsRepository } from '../repositories/logistics.repository.js';
import { UserSession } from '../../src/types.js';

export class PilgrimService {
  /**
   * Retreives the full Dossier for a Pilgrim with strict data boundary isolation (Rule 10)
   */
  public async getPilgrimDossier(clientId: string, caller: UserSession) {
    // 1. Isolation PELERIN stricte
    if (caller.role === 'PELERIN') {
      if (!caller.clientId || caller.clientId !== clientId) {
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
}

export const pilgrimService = new PilgrimService();
