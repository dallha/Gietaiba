import crypto from 'crypto';
import pg from 'pg';
import { pool, withTransaction } from '../db/neon.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { RoomAssignment, UserSession } from '../../src/types.js';

export interface AssignRoomInput {
  roomId: string;
  clientId: string;
  inscriptionId: string;
  checkInDate: string;
  checkOutDate: string;
  notes?: string;
}

export class LogisticsWorkflowService {
  /**
   * Attribution de chambre transactionnelle avec verrou pessimiste anti-surbooking (FOR UPDATE).
   * Empêche catégoriquement toute double affectation concurrente excédant la capacité de la chambre.
   */
  public async assignRoomPessimistic(input: AssignRoomInput, actor: UserSession): Promise<RoomAssignment> {
    return withTransaction(async (client) => {
      // 1. Verrouiller la chambre en exclusivité
      const roomRes = await client.query<{
        id: string;
        hotel_id: string;
        room_number: string;
        room_type: string;
        capacity: number;
        current_occupancy: number;
      }>(
        `SELECT id, hotel_id, room_number, room_type, capacity, current_occupancy
         FROM rooms WHERE id = $1 FOR UPDATE`,
        [input.roomId]
      );

      if (roomRes.rows.length === 0) {
        throw new Error(`Chambre ${input.roomId} introuvable.`);
      }

      const room = roomRes.rows[0];

      // 2. Compter le nombre réel d'assignations actives
      const countRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM room_assignments WHERE room_id = $1`,
        [input.roomId]
      );
      const currentOccupants = Number(countRes.rows[0].count);

      if (currentOccupants >= room.capacity) {
        throw new Error(
          `ROOM_FULL_ERROR: La chambre ${room.room_number} (${room.room_type}) est déjà complète. Capacité maximale atteinte: ${room.capacity}/${room.capacity}.`
        );
      }

      // 3. Vérifier que le pèlerin n'est pas déjà assigné dans cette même chambre
      const existRes = await client.query(
        `SELECT id FROM room_assignments WHERE room_id = $1 AND client_id = $2`,
        [input.roomId, input.clientId]
      );
      if (existRes.rows.length > 0) {
        throw new Error(`Le pèlerin est déjà assigné dans la chambre ${room.room_number}.`);
      }

      // 4. Insérer l'assignation
      const assignmentId = crypto.randomUUID();
      const insertRes = await client.query(
        `INSERT INTO room_assignments (
          id, room_id, hotel_id, client_id, inscription_id, assigned_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *`,
        [
          assignmentId,
          input.roomId,
          room.hotel_id,
          input.clientId,
          input.inscriptionId,
        ]
      );

      // 5. Mettre à jour l'occupation dans la table rooms
      const newOccupancy = currentOccupants + 1;
      await client.query(
        `UPDATE rooms SET current_occupancy = $1 WHERE id = $2`,
        [newOccupancy, input.roomId]
      );

      // 6. Audit log
      await auditRepository.logAudit({
        actorUserId: actor.id,
        actorUserName: actor.displayName || actor.email,
        action: 'ATTRIBUTION_CHAMBRE',
        entityType: 'ROOM_ASSIGNMENT',
        entityId: assignmentId,
        newValue: {
          roomId: input.roomId,
          roomNumber: room.room_number,
          clientId: input.clientId,
          inscriptionId: input.inscriptionId,
          newOccupancy,
          capacity: room.capacity,
        },
      }, client);

      const row = insertRes.rows[0];
      return {
        id: row.id,
        roomId: row.room_id,
        hotelId: room.hotel_id,
        clientId: row.client_id,
        inscriptionId: input.inscriptionId,
        assignedAt: new Date().toISOString(),
        checkInDate: row.check_in_date,
        checkOutDate: row.check_out_date,
        notes: row.notes,
        createdAt: row.created_at,
      };
    });
  }
}

export const logisticsWorkflowService = new LogisticsWorkflowService();
