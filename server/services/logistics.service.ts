import { logisticsRepository } from '../repositories/logistics.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { notificationRepository } from '../repositories/notification.repository.js';
import {
  Flight,
  Ticket,
  Hotel,
  Room,
  RoomAssignment,
  Group,
  GroupMember,
  Accompagnateur,
  Client,
  UserSession,
} from '../../src/types.js';

export class LogisticsService {
  // Flights
  public async getFlights(campaignId?: string): Promise<Flight[]> {
    return logisticsRepository.getFlights(campaignId);
  }

  public async createFlight(flightData: Omit<Flight, 'id'>, actor: UserSession): Promise<Flight> {
    const flight = await logisticsRepository.createFlight(flightData);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'CREATION_VOL',
      entityType: 'FLIGHT',
      entityId: flight.id,
      newValue: { flightNumber: flight.flightNumber, airline: flight.airline },
    });
    return flight;
  }

  // Tickets
  public async getTickets(query?: { flightId?: string; clientId?: string }): Promise<Ticket[]> {
    return logisticsRepository.getTickets(query);
  }

  public async createTicket(data: Omit<Ticket, 'id'>, actor: UserSession): Promise<Ticket> {
    const ticket = await logisticsRepository.createTicket(data);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'EMISSION_BILLET',
      entityType: 'TICKET',
      entityId: ticket.id,
      newValue: { ticketNumber: ticket.ticketNumber, pnr: ticket.pnr, clientId: ticket.clientId },
    });

    if (ticket.clientId) {
      await notificationRepository.createNotification({
        recipientClientId: ticket.clientId,
        inscriptionId: ticket.inscriptionId,
        type: 'TICKET_ASSIGNED',
        category: 'LOGISTICS',
        title: 'Billet d\'avion émis',
        message: `Votre billet d'avion (${ticket.ticketNumber || ticket.pnr || 'Confirmé'}) est désormais disponible.`,
        entityType: 'flight',
        entityId: ticket.id,
        priority: 'MEDIUM',
        actionUrl: 'logistique',
      });
    }

    return ticket;
  }

  // Hotels
  public async getHotels(campaignId?: string): Promise<Hotel[]> {
    return logisticsRepository.getHotels(campaignId);
  }

  public async createHotel(data: Omit<Hotel, 'id'>, actor: UserSession): Promise<Hotel> {
    const hotel = await logisticsRepository.createHotel(data);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'CREATION_HOTEL',
      entityType: 'HOTEL',
      entityId: hotel.id,
      newValue: { name: hotel.name, city: hotel.city },
    });
    return hotel;
  }

  // Rooms
  public async getRooms(hotelId?: string): Promise<(Room & { occupants: Client[] })[]> {
    return logisticsRepository.getRooms(hotelId);
  }

  public async createRoom(data: Omit<Room, 'id' | 'currentOccupancy'>, actor: UserSession): Promise<Room> {
    const room = await logisticsRepository.createRoom(data);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'CREATION_CHAMBRE',
      entityType: 'ROOM',
      entityId: room.id,
      newValue: { roomNumber: room.roomNumber, capacity: room.capacity },
    });
    return room;
  }

  // Room Assignment with capacity enforcement
  public async assignClientToRoom(
    roomId: string,
    clientId: string,
    inscriptionId: string | undefined,
    actor: UserSession
  ): Promise<RoomAssignment> {
    const assignment = await logisticsRepository.assignClientToRoom(roomId, clientId, inscriptionId);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'AFFECTATION_CHAMBRE',
      entityType: 'ROOM_ASSIGNMENT',
      entityId: assignment.id,
      newValue: { roomId, clientId },
    });

    if (clientId) {
      await notificationRepository.createNotification({
        recipientClientId: clientId,
        inscriptionId,
        type: 'HOTEL_ASSIGNED',
        category: 'LOGISTICS',
        title: 'Hébergement attribué',
        message: 'Votre chambre d\'hôtel a été attribuée avec succès.',
        entityType: 'hotel',
        entityId: assignment.id,
        priority: 'MEDIUM',
        actionUrl: 'logistique',
      });
    }

    return assignment;
  }

  public async removeClientFromRoom(roomId: string, clientId: string, actor: UserSession): Promise<{ success: boolean }> {
    await logisticsRepository.removeClientFromRoom(roomId, clientId);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'RETRAIT_CHAMBRE',
      entityType: 'ROOM_ASSIGNMENT',
      entityId: roomId,
      newValue: { roomId, clientId },
    });
    return { success: true };
  }

  // Groups
  public async getGroups(campaignId?: string): Promise<(Group & { members: Client[] })[]> {
    return logisticsRepository.getGroups(campaignId);
  }

  public async createGroup(data: Omit<Group, 'id'>, actor: UserSession): Promise<Group> {
    const group = await logisticsRepository.createGroup(data);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'CREATION_GROUPE',
      entityType: 'GROUP',
      entityId: group.id,
      newValue: { name: group.name },
    });
    return group;
  }

  public async addClientToGroup(
    groupId: string,
    clientId: string,
    inscriptionId: string | undefined,
    actor: UserSession
  ): Promise<GroupMember> {
    const member = await logisticsRepository.addClientToGroup(groupId, clientId, inscriptionId);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'AJOUT_MEMBRE_GROUPE',
      entityType: 'GROUP',
      entityId: groupId,
      newValue: { clientId, groupId },
    });
    return member;
  }

  // Accompagnateurs
  public async getAccompagnateurs(campaignId?: string): Promise<Accompagnateur[]> {
    return logisticsRepository.getAccompagnateurs(campaignId);
  }
}

export const logisticsService = new LogisticsService();
