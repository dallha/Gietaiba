import { randomUUID } from 'crypto';
import { pool } from '../db/neon.js';
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
  HotelStay,
  FlightSegment,
} from '../../src/types.js';

export class LogisticsRepository {
  // 1. FLIGHTS
  public async getFlights(campaignId?: string): Promise<Flight[]> {
    let sql = `SELECT * FROM flights`;
    const params: any[] = [];
    if (campaignId) {
      params.push(campaignId);
      sql += ` WHERE campaign_id = $1`;
    }
    sql += ` ORDER BY departure_date ASC`;
    const res = await pool.query(sql, params);
    return res.rows.map(this.mapRowToFlight);
  }

  public async createFlight(flightData: Omit<Flight, 'id'>): Promise<Flight> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO flights (
        id, campaign_id, airline, flight_number, departure_city, arrival_city,
        departure_date, departure_time, arrival_time, terminal, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *`,
      [
        id,
        flightData.voyageId,
        flightData.airline,
        flightData.flightNumber,
        flightData.departureCity,
        flightData.arrivalCity,
        new Date(flightData.departureDate),
        flightData.departureTime,
        flightData.arrivalTime,
        flightData.terminal || null,
        flightData.status || 'PROGRAMME',
      ]
    );
    return this.mapRowToFlight(res.rows[0]);
  }

  // 2. TICKETS
  public async getTickets(query?: { flightId?: string; clientId?: string }): Promise<Ticket[]> {
    let sql = `SELECT * FROM tickets WHERE 1=1`;
    const params: any[] = [];
    if (query?.flightId) {
      params.push(query.flightId);
      sql += ` AND flight_id = $${params.length}`;
    }
    if (query?.clientId) {
      params.push(query.clientId);
      sql += ` AND client_id = $${params.length}`;
    }
    const res = await pool.query(sql, params);
    return res.rows.map(this.mapRowToTicket);
  }

  public async createTicket(data: Omit<Ticket, 'id'>): Promise<Ticket> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO tickets (
        id, flight_id, client_id, inscription_id, ticket_number, pnr, issue_date, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *`,
      [
        id,
        data.flightId,
        data.clientId,
        data.inscriptionId || null,
        data.ticketNumber || null,
        data.pnr || null,
        data.issueDate ? new Date(data.issueDate) : new Date(),
        data.status || 'EMIS',
      ]
    );
    return this.mapRowToTicket(res.rows[0]);
  }

  // 3. HOTELS
  public async getHotels(campaignId?: string): Promise<Hotel[]> {
    let sql = `SELECT * FROM hotels`;
    const params: any[] = [];
    if (campaignId) {
      params.push(campaignId);
      sql += ` WHERE campaign_id = $1`;
    }
    sql += ` ORDER BY check_in_date ASC`;
    const res = await pool.query(sql, params);
    return res.rows.map(this.mapRowToHotel);
  }

  public async createHotel(data: Omit<Hotel, 'id'>): Promise<Hotel> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO hotels (
        id, campaign_id, name, city, address, category, contact_phone, check_in_date, check_out_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        id,
        data.voyageId || (data as any).campaignId,
        data.name,
        data.city,
        data.address || null,
        data.category || 5,
        data.contactPhone || null,
        data.checkInDate ? new Date(data.checkInDate) : new Date('2027-05-20'),
        data.checkOutDate ? new Date(data.checkOutDate) : new Date('2027-06-05'),
      ]
    );
    return this.mapRowToHotel(res.rows[0]);
  }

  // 4. ROOMS & OCCUPANTS
  public async getRooms(hotelId?: string): Promise<(Room & { occupants: Client[] })[]> {
    let sql = `
      SELECT r.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'code', c.code,
              'firstName', c.first_name,
              'lastName', c.last_name,
              'phone', c.phone,
              'gender', c.gender
            )
          ) FILTER (WHERE c.id IS NOT NULL), '[]'
        ) as occupants
      FROM rooms r
      LEFT JOIN room_assignments ra ON ra.room_id = r.id
      LEFT JOIN clients c ON ra.client_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (hotelId) {
      params.push(hotelId);
      sql += ` AND r.hotel_id = $1`;
    }
    sql += ` GROUP BY r.id ORDER BY r.room_number ASC`;

    const res = await pool.query(sql, params);
    return res.rows.map((r: any) => {
      const occupants = typeof r.occupants === 'string' ? JSON.parse(r.occupants) : r.occupants || [];
      return {
        id: r.id,
        hotelId: r.hotel_id,
        voyageId: r.campaign_id,
        building: r.building || undefined,
        floor: r.floor || undefined,
        roomNumber: r.room_number,
        roomType: r.room_type,
        capacity: r.capacity,
        currentOccupancy: occupants.length,
        notes: r.notes || undefined,
        occupants,
      };
    });
  }

  public async createRoom(data: Omit<Room, 'id' | 'currentOccupancy'>): Promise<Room> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO rooms (
        id, hotel_id, campaign_id, building, floor, room_number, room_type, capacity, current_occupancy, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, NOW())
      RETURNING *`,
      [
        id,
        data.hotelId,
        data.voyageId,
        data.building || null,
        data.floor || null,
        data.roomNumber,
        data.roomType,
        data.capacity,
        data.notes || null,
      ]
    );
    return this.mapRowToRoom(res.rows[0]);
  }

  // 5. ROOM ASSIGNMENTS (Strict Capacity & Anti-Overbooking Enforcement)
  public async assignClientToRoom(
    roomId: string,
    clientId: string,
    inscriptionId?: string
  ): Promise<RoomAssignment> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verrouiller la chambre pour vérifier sa capacité physique
      const roomRes = await client.query(`SELECT * FROM rooms WHERE id = $1 FOR UPDATE`, [roomId]);
      if (roomRes.rows.length === 0) throw new Error('Chambre introuvable.');
      const room = roomRes.rows[0];

      const countRes = await client.query(`SELECT COUNT(*) as cnt FROM room_assignments WHERE room_id = $1`, [roomId]);
      const currentAssignments = parseInt(countRes.rows[0].cnt, 10);
      if (currentAssignments >= room.capacity) {
        throw new Error(`Capacité physique maximale atteinte pour la chambre ${room.room_number} (${room.capacity} personnes max).`);
      }

      // 2. Vérifier si le pèlerin est déjà affecté dans cet hôtel
      const existRes = await client.query(
        `SELECT id FROM room_assignments WHERE hotel_id = $1 AND client_id = $2`,
        [room.hotel_id, clientId]
      );
      if (existRes.rows.length > 0) {
        throw new Error('Ce pèlerin est déjà assigné à une chambre dans cet hôtel.');
      }

      const id = randomUUID();
      const insertRes = await client.query(
        `INSERT INTO room_assignments (id, room_id, hotel_id, client_id, inscription_id, assigned_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         RETURNING *`,
        [id, roomId, room.hotel_id, clientId, inscriptionId || null]
      );

      // Mettre à jour l'occupancy
      await client.query(`UPDATE rooms SET current_occupancy = $1 WHERE id = $2`, [currentAssignments + 1, roomId]);

      await client.query('COMMIT');
      return {
        id: insertRes.rows[0].id,
        roomId: insertRes.rows[0].room_id,
        hotelId: insertRes.rows[0].hotel_id,
        clientId: insertRes.rows[0].client_id,
        inscriptionId: insertRes.rows[0].inscription_id || '',
        assignedAt: new Date(insertRes.rows[0].assigned_at).toISOString(),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async removeClientFromRoom(roomId: string, clientId: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM room_assignments WHERE room_id = $1 AND client_id = $2`, [roomId, clientId]);
      const countRes = await client.query(`SELECT COUNT(*) as cnt FROM room_assignments WHERE room_id = $1`, [roomId]);
      const current = parseInt(countRes.rows[0].cnt, 10);
      await client.query(`UPDATE rooms SET current_occupancy = $1 WHERE id = $2`, [current, roomId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // 6. GROUPS & MEMBERS
  public async getGroups(campaignId?: string): Promise<(Group & { members: Client[] })[]> {
    let sql = `
      SELECT g.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'code', c.code,
              'firstName', c.first_name,
              'lastName', c.last_name,
              'phone', c.phone
            )
          ) FILTER (WHERE c.id IS NOT NULL), '[]'
        ) as members
      FROM groups g
      LEFT JOIN group_members gm ON gm.group_id = g.id
      LEFT JOIN clients c ON gm.client_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (campaignId) {
      params.push(campaignId);
      sql += ` AND g.campaign_id = $1`;
    }
    sql += ` GROUP BY g.id ORDER BY g.name ASC`;

    const res = await pool.query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      voyageId: r.campaign_id,
      name: r.name,
      guideId: r.guide_id || undefined,
      guideName: r.guide_name || undefined,
      busNumber: r.bus_number || undefined,
      hotelId: r.hotel_id || undefined,
      notes: r.notes || undefined,
      members: typeof r.members === 'string' ? JSON.parse(r.members) : r.members || [],
    }));
  }

  public async createGroup(data: Omit<Group, 'id'>): Promise<Group> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO groups (id, campaign_id, name, guide_id, guide_name, bus_number, hotel_id, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        id,
        data.voyageId,
        data.name,
        data.guideId || null,
        data.guideName || null,
        data.busNumber || null,
        data.hotelId || null,
        data.notes || null,
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      voyageId: r.campaign_id,
      name: r.name,
      guideId: r.guide_id || undefined,
      guideName: r.guide_name || undefined,
      busNumber: r.bus_number || undefined,
      hotelId: r.hotel_id || undefined,
      notes: r.notes || undefined,
    };
  }

  public async addClientToGroup(
    groupId: string,
    clientId: string,
    inscriptionId?: string
  ): Promise<GroupMember> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO group_members (id, group_id, client_id, inscription_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [id, groupId, clientId, inscriptionId || null]
    );
    return {
      id: res.rows[0].id,
      groupId: res.rows[0].group_id,
      clientId: res.rows[0].client_id,
      inscriptionId: res.rows[0].inscription_id || '',
    };
  }

  // 7. ACCOMPAGNATEURS
  public async getAccompagnateurs(campaignId?: string): Promise<Accompagnateur[]> {
    let sql = `SELECT * FROM accompagnateurs`;
    const params: any[] = [];
    if (campaignId) {
      params.push(campaignId);
      sql += ` WHERE campaign_id IS NULL OR campaign_id = $1`;
    }
    const res = await pool.query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      role: r.role,
      voyageId: r.campaign_id || undefined,
      availability: r.availability,
      notes: r.notes || undefined,
    }));
  }

  private mapRowToFlight(r: any): Flight {
    return {
      id: r.id,
      voyageId: r.campaign_id,
      airline: r.airline,
      flightNumber: r.flight_number,
      departureCity: r.departure_city,
      arrivalCity: r.arrival_city,
      departureDate: r.departure_date ? new Date(r.departure_date).toISOString().split('T')[0] : '',
      departureTime: r.departure_time,
      arrivalTime: r.arrival_time,
      terminal: r.terminal || undefined,
      status: r.status,
    };
  }

  private mapRowToTicket(r: any): Ticket {
    return {
      id: r.id,
      flightId: r.flight_id,
      clientId: r.client_id,
      inscriptionId: r.inscription_id || '',
      ticketNumber: r.ticket_number || '',
      pnr: r.pnr || undefined,
      issueDate: r.issue_date ? new Date(r.issue_date).toISOString().split('T')[0] : '',
      status: r.status,
    };
  }

  private mapRowToHotel(r: any): Hotel {
    return {
      id: r.id,
      voyageId: r.campaign_id,
      name: r.name,
      city: r.city,
      address: r.address || '',
      category: Number(r.category) || 5,
      contactPhone: r.contact_phone || undefined,
      checkInDate: r.check_in_date ? new Date(r.check_in_date).toISOString().split('T')[0] : '',
      checkOutDate: r.check_out_date ? new Date(r.check_out_date).toISOString().split('T')[0] : '',
    };
  }

  private mapRowToRoom(r: any): Room {
    return {
      id: r.id,
      hotelId: r.hotel_id,
      voyageId: r.campaign_id,
      building: r.building || undefined,
      floor: r.floor || undefined,
      roomNumber: r.room_number,
      roomType: r.room_type,
      capacity: r.capacity,
      currentOccupancy: r.current_occupancy,
      notes: r.notes || undefined,
    };
  }

  // 7. HOTEL STAYS (Séjours Makkah / Médine géolocalisés par pèlerin)
  public async getHotelStays(query?: { campaignId?: string; inscriptionId?: string; clientId?: string }): Promise<HotelStay[]> {
    let sql = `SELECT * FROM hotel_stays WHERE 1=1`;
    const params: any[] = [];
    if (query?.campaignId) {
      params.push(query.campaignId);
      sql += ` AND campaign_id = $${params.length}`;
    }
    if (query?.inscriptionId) {
      params.push(query.inscriptionId);
      sql += ` AND inscription_id = $${params.length}`;
    }
    if (query?.clientId) {
      params.push(query.clientId);
      sql += ` AND client_id = $${params.length}`;
    }
    sql += ` ORDER BY check_in_date ASC`;
    const res = await pool.query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      inscriptionId: r.inscription_id,
      clientId: r.client_id,
      hotelId: r.hotel_id,
      campaignId: r.campaign_id,
      packageId: r.package_id || undefined,
      city: r.city,
      checkInDate: r.check_in_date ? new Date(r.check_in_date).toISOString().split('T')[0] : '',
      checkOutDate: r.check_out_date ? new Date(r.check_out_date).toISOString().split('T')[0] : '',
      roomType: r.room_type,
      roomId: r.room_id || undefined,
      shuttleService: Boolean(r.shuttle_service),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  }

  public async createHotelStay(data: Omit<HotelStay, 'id' | 'createdAt'>): Promise<HotelStay> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO hotel_stays (
        id, inscription_id, client_id, hotel_id, campaign_id, package_id,
        city, check_in_date, check_out_date, room_type, room_id, shuttle_service, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING *`,
      [
        id,
        data.inscriptionId,
        data.clientId,
        data.hotelId,
        data.campaignId,
        data.packageId || null,
        data.city,
        new Date(data.checkInDate),
        new Date(data.checkOutDate),
        data.roomType,
        data.roomId || null,
        data.shuttleService || false,
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      inscriptionId: r.inscription_id,
      clientId: r.client_id,
      hotelId: r.hotel_id,
      campaignId: r.campaign_id,
      packageId: r.package_id || undefined,
      city: r.city,
      checkInDate: r.check_in_date ? new Date(r.check_in_date).toISOString().split('T')[0] : '',
      checkOutDate: r.check_out_date ? new Date(r.check_out_date).toISOString().split('T')[0] : '',
      roomType: r.room_type,
      roomId: r.room_id || undefined,
      shuttleService: Boolean(r.shuttle_service),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }

  // 8. FLIGHT SEGMENTS (Tronçons multi-escales)
  public async getFlightSegments(flightId?: string): Promise<FlightSegment[]> {
    let sql = `SELECT * FROM flight_segments`;
    const params: any[] = [];
    if (flightId) {
      params.push(flightId);
      sql += ` WHERE flight_id = $1`;
    }
    sql += ` ORDER BY departure_time ASC`;
    const res = await pool.query(sql, params);
    return res.rows.map((r: any) => ({
      id: r.id,
      flightId: r.flight_id,
      segmentType: r.segment_type,
      departureAirport: r.departure_airport,
      arrivalAirport: r.arrival_airport,
      flightNumber: r.flight_number,
      airline: r.airline,
      departureTime: new Date(r.departure_time).toISOString(),
      arrivalTime: new Date(r.arrival_time).toISOString(),
      terminal: r.terminal || undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));
  }

  public async createFlightSegment(data: Omit<FlightSegment, 'id' | 'createdAt'>): Promise<FlightSegment> {
    const id = randomUUID();
    const res = await pool.query(
      `INSERT INTO flight_segments (
        id, flight_id, segment_type, departure_airport, arrival_airport,
        flight_number, airline, departure_time, arrival_time, terminal, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *`,
      [
        id,
        data.flightId,
        data.segmentType,
        data.departureAirport,
        data.arrivalAirport,
        data.flightNumber,
        data.airline,
        new Date(data.departureTime),
        new Date(data.arrivalTime),
        data.terminal || null,
      ]
    );
    const r = res.rows[0];
    return {
      id: r.id,
      flightId: r.flight_id,
      segmentType: r.segment_type,
      departureAirport: r.departure_airport,
      arrivalAirport: r.arrival_airport,
      flightNumber: r.flight_number,
      airline: r.airline,
      departureTime: new Date(r.departure_time).toISOString(),
      arrivalTime: new Date(r.arrival_time).toISOString(),
      terminal: r.terminal || undefined,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const logisticsRepository = new LogisticsRepository();

