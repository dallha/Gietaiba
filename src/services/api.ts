import {
  AgencySettings,
  Client,
  Voyage,
  VoyagePackage,
  Inscription,
  Payment,
  PilgrimDocument,
  Visa,
  Flight,
  Ticket,
  Hotel,
  Room,
  Group,
  Accompagnateur,
  Expense,
  AuditLog,
  DashboardStats,
  UserSession,
  User,
  Role,
  AppNotification,
} from '../types.js';
import { createNotification } from './notification.service.js';
import {
  ProvisionStaffInput,
  ProvisionPilgrimInput,
  ProvisionResult,
  ProvisionPartialResult,
  EmailCheckResult,
} from '../../contracts/provisioning.js';


class ApiService {
  private async request<T>(endpoint: string, options?: RequestInit & { idempotencyKey?: string }): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      ...(options?.headers as Record<string, string> || {}),
    };

    let res: Response | null = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        res = await fetch(endpoint, {
          ...options,
          headers,
          credentials: 'same-origin',
        });
        break;
      } catch (networkErr: any) {
        if (attempts >= maxAttempts) {
          throw new Error(`Échec de connexion au serveur (${endpoint}): ${networkErr?.message || networkErr}`);
        }
        await new Promise((r) => setTimeout(r, 200 * attempts));
      }
    }

    if (!res) {
      throw new Error(`Aucune réponse reçue du serveur pour ${endpoint}`);
    }

    const rawText = await res.text();
    const contentType = res.headers.get('content-type') || '';
    const isHtml = rawText.trim().startsWith('<') || contentType.includes('text/html');

    if (!res.ok) {
      if (res.status === 401) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('taiba:unauthorized'));
        }
      }
      let errorMsg = `Erreur HTTP ${res.status}`;
      if (!isHtml) {
        try {
          const errData = JSON.parse(rawText);
          if (errData?.error) errorMsg = errData.error;
        } catch {
          if (rawText.length < 150) errorMsg = rawText;
        }
      }
      throw new Error(errorMsg);
    }

    if (isHtml) {
      console.warn(`[ApiService] Réponse HTML inattendue pour l'endpoint ${endpoint} (${contentType}). Contenu:`, rawText.slice(0, 100));
      throw new Error(`Le serveur a renvoyé une page HTML au lieu de données JSON pour ${endpoint}.`);
    }


    try {
      return JSON.parse(rawText) as T;
    } catch (parseErr: any) {
      console.error(`[ApiService] Erreur de décodage JSON pour ${endpoint}:`, parseErr, rawText.slice(0, 150));
      throw new Error(`Données invalides renvoyées par le serveur pour ${endpoint}.`);
    }
  }

  // Auth
  async getCurrentUser(): Promise<UserSession> {
    const res = await this.request<{ user: UserSession }>('/api/auth/me');
    return res.user;
  }

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });
    } catch {
      // Nettoyage garanti
    }
  }

  async getUsers(): Promise<UserSession[]> {
    return this.request('/api/auth/users');
  }

  async getFullUsers(): Promise<User[]> {
    return this.request('/api/users');
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User> {
    return this.request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }

  async getUserClientAccess(userId: string): Promise<any[]> {
    return this.request(`/api/users/${userId}/client-access`);
  }

  async grantUserClientAccess(userId: string, data: { clientId: string; relationshipType?: string; canView?: boolean; canPay?: boolean; canUploadDocs?: boolean }): Promise<{ success: boolean }> {
    return this.request(`/api/users/${userId}/client-access`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeUserClientAccess(userId: string, clientId: string): Promise<{ success: boolean }> {
    return this.request(`/api/users/${userId}/client-access/${clientId}`, {
      method: 'DELETE',
    });
  }

  async getRoles(): Promise<Role[]> {
    return this.request('/api/roles');
  }

  // Provisioning (V1)
  // NOTE: a 207 COMPENSATION_FAILED response returns ProvisionPartialResult
  // (generic message + correlationId — neonAuthId is NEVER exposed to the client).
  async provisionStaff(input: ProvisionStaffInput): Promise<ProvisionResult | ProvisionPartialResult> {
    return this.request('/api/provisioning/staff', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async provisionPilgrim(input: ProvisionPilgrimInput): Promise<ProvisionResult | ProvisionPartialResult> {
    return this.request('/api/provisioning/pilgrim', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async checkEmailAvailability(email: string): Promise<EmailCheckResult> {
    const qs = new URLSearchParams({ email }).toString();
    return this.request(`/api/provisioning/check-email?${qs}`);
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/api/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // Notifications
  async getNotifications(): Promise<AppNotification[]> {
    return this.request('/api/notifications');
  }

  async createNotification(data: any): Promise<{ success: boolean; idempotencyKey: string }> {
    return this.request('/api/notifications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async markNotificationAsRead(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsAsRead(): Promise<{ success: boolean }> {
    return this.request('/api/notifications/read-all', {
      method: 'PUT',
    });
  }

  // Audit
  async createAuditLog(log: { action: string; entityType: string; entityId: string; metadata?: any }): Promise<{ success: boolean }> {
    return this.request('/api/audit-logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
  }

  // Settings
  async getSettings(): Promise<AgencySettings> {
    return this.request('/api/settings');
  }

  async updateSettings(settings: Partial<AgencySettings>): Promise<AgencySettings> {
    return this.request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request('/api/dashboard/stats');
  }

  // Clients
  async getClients(params?: { search?: string; status?: string }): Promise<Client[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.status) query.append('status', params.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/clients${qs}`);
  }

  async getClient(id: string): Promise<Client> {
    return this.request(`/api/clients/${id}`);
  }

  async createClient(client: Partial<Client>): Promise<Client> {
    return this.request('/api/clients', {
      method: 'POST',
      body: JSON.stringify(client),
    });
  }

  async updateClient(id: string, updates: Partial<Client>): Promise<Client> {
    return this.request(`/api/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteClient(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/clients/${id}`, {
      method: 'DELETE',
    });
  }

  async getClientDependencies(id: string): Promise<{
    hasDependencies: boolean;
    inscriptionsCount: number;
    paymentsCount: number;
    documentsCount: number;
    visasCount: number;
  }> {
    return this.request(`/api/clients/${id}/dependencies`);
  }

  async archiveClient(id: string, reason?: string): Promise<Client> {
    return this.request(`/api/clients/${id}/archive`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Voyages
  async getVoyages(): Promise<Voyage[]> {
    return this.request('/api/voyages');
  }

  async createVoyage(voyage: Partial<Voyage>): Promise<Voyage> {
    return this.request('/api/voyages', {
      method: 'POST',
      body: JSON.stringify(voyage),
    });
  }

  async updateVoyage(id: string, updates: Partial<Voyage>): Promise<Voyage> {
    return this.request(`/api/voyages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteVoyage(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/voyages/${id}`, {
      method: 'DELETE',
    });
  }

  // Packages & Versions
  async getPackages(voyageId?: string): Promise<VoyagePackage[]> {
    const qs = voyageId ? `?voyageId=${voyageId}` : '';
    return this.request(`/api/packages${qs}`);
  }

  async createPackage(pkg: Partial<VoyagePackage>): Promise<VoyagePackage> {
    return this.request('/api/packages', {
      method: 'POST',
      body: JSON.stringify(pkg),
    });
  }

  async updatePackage(id: string, updates: Partial<VoyagePackage>): Promise<VoyagePackage> {
    return this.request(`/api/packages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deletePackage(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/packages/${id}`, {
      method: 'DELETE',
    });
  }

  async createNewPriceVersion(
    packageId: string,
    data: { newPrice: number; status: 'PROVISOIRE' | 'DEFINITIF'; effectiveFrom: string; note?: string }
  ): Promise<VoyagePackage> {
    return this.request(`/api/packages/${packageId}/new-price-version`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePackagePrice(
    packageId: string,
    data: { newPrice: number; status: 'PROVISOIRE' | 'DEFINITIF'; effectiveFrom: string; note?: string }
  ): Promise<VoyagePackage> {
    return this.createNewPriceVersion(packageId, data);
  }

  // Inscriptions
  async getInscriptions(params?: { voyageId?: string; clientId?: string }): Promise<Inscription[]> {
    const query = new URLSearchParams();
    if (params?.voyageId) query.append('voyageId', params.voyageId);
    if (params?.clientId) query.append('clientId', params.clientId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/inscriptions${qs}`);
  }

  async createInscription(data: {
    clientId: string;
    voyageId: string;
    packageId: string;
    status?: 'CONFIRMEE' | 'EN_ATTENTE';
  }): Promise<Inscription> {
    return this.request('/api/inscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInscriptionStatus(id: string, status: Inscription['status']): Promise<Inscription> {
    return this.request(`/api/inscriptions/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async updateInscriptionPrice(id: string, newPrice: number, reason: string): Promise<Inscription> {
    return this.request(`/api/inscriptions/${id}/price`, {
      method: 'PATCH',
      body: JSON.stringify({ newPrice, reason }),
    });
  }

  // Payments
  async getPayments(params?: { clientId?: string; inscriptionId?: string; voyageId?: string }): Promise<Payment[]> {
    const query = new URLSearchParams();
    if (params?.clientId) query.append('clientId', params.clientId);
    if (params?.inscriptionId) query.append('inscriptionId', params.inscriptionId);
    if (params?.voyageId) query.append('voyageId', params.voyageId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/payments${qs}`);
  }

  async createPayment(data: {
    clientId: string;
    inscriptionId: string;
    amount: number;
    paymentMethod: string;
    reference?: string;
    comment?: string;
    paymentDate?: string;
  }): Promise<Payment> {
    const payment = await this.request<Payment>('/api/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // Central synchronized notification
    createNotification({
      recipientUserId: payment.clientId,
      recipientClientId: payment.clientId,
      inscriptionId: payment.inscriptionId,
      type: 'PAYMENT_VALIDATED',
      category: 'PAYMENT',
      title: `Paiement validé : ${payment.amount.toLocaleString()} FCFA`,
      message: `Votre versement de ${payment.amount.toLocaleString()} FCFA (${payment.paymentMethod}) a été validé. Reçu n° ${payment.receiptNumber}.`,
      entityType: 'payment',
      entityId: payment.id,
      priority: 'HIGH',
      actionUrl: 'finances'
    }).catch((err) => console.warn('Notification sync error:', err));

    return payment;
  }

  async cancelPayment(id: string, reason: string): Promise<Payment> {
    const canceled = await this.request<Payment>(`/api/payments/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });

    createNotification({
      recipientUserId: canceled.clientId,
      recipientClientId: canceled.clientId,
      inscriptionId: canceled.inscriptionId,
      type: 'PAYMENT_CANCELLED',
      category: 'PAYMENT',
      title: 'Paiement annulé',
      message: `Le versement n° ${canceled.receiptNumber} a été annulé par la direction. Motif: ${reason}.`,
      entityType: 'payment',
      entityId: canceled.id,
      priority: 'HIGH',
      actionUrl: 'finances'
    }).catch((err) => console.warn('Notification sync error:', err));

    return canceled;
  }

  // Documents
  async getDocuments(params?: { clientId?: string; inscriptionId?: string }): Promise<PilgrimDocument[]> {
    const query = new URLSearchParams();
    if (params?.clientId) query.append('clientId', params.clientId);
    if (params?.inscriptionId) query.append('inscriptionId', params.inscriptionId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/documents${qs}`);
  }

  async createDocument(doc: Partial<PilgrimDocument>): Promise<PilgrimDocument> {
    return this.request('/api/documents', {
      method: 'POST',
      body: JSON.stringify(doc),
    });
  }

  async updateDocumentStatus(
    id: string,
    status: PilgrimDocument['status'],
    comment?: string
  ): Promise<PilgrimDocument> {
    const updated = await this.request<PilgrimDocument>(`/api/documents/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, comment }),
    });

    if (status === 'VALIDE') {
      createNotification({
        recipientUserId: updated.clientId,
        recipientClientId: updated.clientId,
        inscriptionId: updated.inscriptionId,
        type: 'DOCUMENT_VALIDATED',
        category: 'DOCUMENT',
        title: `Pièce validée : ${updated.fileName || updated.type}`,
        message: `Votre document "${updated.fileName || updated.type}" a été approuvé par l'administration.`,
        entityType: 'document',
        entityId: updated.id,
        priority: 'MEDIUM',
        actionUrl: 'documents'
      }).catch((err) => console.warn('Notification sync error:', err));
    } else if (status === 'REFUSE') {
      createNotification({
        recipientUserId: updated.clientId,
        recipientClientId: updated.clientId,
        inscriptionId: updated.inscriptionId,
        type: 'DOCUMENT_REJECTED',
        category: 'DOCUMENT',
        title: `Pièce à corriger : ${updated.fileName || updated.type}`,
        message: comment ? `Motif du rejet : ${comment}` : `Votre document "${updated.fileName || updated.type}" nécessite une mise en conformité.`,
        entityType: 'document',
        entityId: updated.id,
        priority: 'HIGH',
        actionUrl: 'documents'
      }).catch((err) => console.warn('Notification sync error:', err));
    }

    return updated;
  }

  // Visas
  async getVisas(voyageId?: string): Promise<Visa[]> {
    const qs = voyageId ? `?voyageId=${voyageId}` : '';
    return this.request(`/api/visas${qs}`);
  }

  async updateVisa(id: string, updates: Partial<Visa>): Promise<Visa> {
    const updated = await this.request<Visa>(`/api/visas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });

    if (updates.status === 'APPROUVE') {
      createNotification({
        recipientUserId: updated.clientId,
        recipientClientId: updated.clientId,
        type: 'VISA_AVAILABLE',
        category: 'LOGISTICS',
        title: 'Visa officiel délivré',
        message: `Votre visa officiel pour le Royaume d'Arabie Saoudite est validé par le Ministère.`,
        entityType: 'visa',
        entityId: updated.id,
        priority: 'HIGH',
        actionUrl: 'dossier'
      }).catch((err) => console.warn('Notification sync error:', err));
    }

    return updated;
  }

  // Flights & Tickets
  async getFlights(voyageId?: string): Promise<Flight[]> {
    const qs = voyageId ? `?voyageId=${voyageId}` : '';
    return this.request(`/api/flights${qs}`);
  }

  async createFlight(flight: Partial<Flight>): Promise<Flight> {
    return this.request('/api/flights', {
      method: 'POST',
      body: JSON.stringify(flight),
    });
  }

  async getTickets(params?: { flightId?: string; clientId?: string }): Promise<Ticket[]> {
    const query = new URLSearchParams();
    if (params?.flightId) query.append('flightId', params.flightId);
    if (params?.clientId) query.append('clientId', params.clientId);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/tickets${qs}`);
  }

  async createTicket(ticket: Partial<Ticket>): Promise<Ticket> {
    const res = await this.request<Ticket>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(ticket),
    });

    if (res.clientId) {
      createNotification({
        recipientUserId: res.clientId,
        recipientClientId: res.clientId,
        type: 'TICKET_ASSIGNED',
        category: 'LOGISTICS',
        title: "Billet d'avion émis",
        message: `Votre billet de vol (N°: ${res.ticketNumber || res.pnr || 'Confirmé'}) est désormais disponible.`,
        entityType: 'flight',
        entityId: res.id,
        priority: 'MEDIUM',
        actionUrl: 'logistique'
      }).catch((err) => console.warn('Notification sync error:', err));
    }

    return res;
  }

  // Hotels & Rooms
  async getHotels(voyageId?: string): Promise<Hotel[]> {
    const qs = voyageId ? `?voyageId=${voyageId}` : '';
    return this.request(`/api/hotels${qs}`);
  }

  async createHotel(hotel: Partial<Hotel>): Promise<Hotel> {
    return this.request('/api/hotels', {
      method: 'POST',
      body: JSON.stringify(hotel),
    });
  }

  async getRooms(hotelId?: string): Promise<(Room & { occupants: Client[] })[]> {
    const qs = hotelId ? `?hotelId=${hotelId}` : '';
    return this.request(`/api/rooms${qs}`);
  }

  async createRoom(room: Partial<Room>): Promise<Room> {
    return this.request('/api/rooms', {
      method: 'POST',
      body: JSON.stringify(room),
    });
  }

  async assignClientToRoom(roomId: string, clientId: string, inscriptionId: string) {
    const assignment = await this.request(`/api/rooms/${roomId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ clientId, inscriptionId }),
    });

    if (clientId) {
      createNotification({
        recipientUserId: clientId,
        recipientClientId: clientId,
        inscriptionId,
        type: 'HOTEL_ASSIGNED',
        category: 'LOGISTICS',
        title: 'Hébergement attribué',
        message: "Votre chambre d'hôtel a été attribuée avec succès.",
        entityType: 'hotel',
        entityId: typeof assignment === 'object' && assignment && 'id' in assignment ? String((assignment as any).id) : undefined,
        priority: 'MEDIUM',
        actionUrl: 'logistique'
      }).catch((err) => console.warn('Notification sync error:', err));
    }

    return assignment;
  }

  async removeClientFromRoom(roomId: string, clientId: string) {
    return this.request(`/api/rooms/${roomId}/occupants/${clientId}`, {
      method: 'DELETE',
    });
  }

  // Groups & Accompagnateurs
  async getGroups(voyageId?: string): Promise<(Group & { members: Client[] })[]> {
    const qs = voyageId ? `?voyageId=${voyageId}` : '';
    return this.request(`/api/groups${qs}`);
  }

  async createGroup(group: Partial<Group>): Promise<Group> {
    return this.request('/api/groups', {
      method: 'POST',
      body: JSON.stringify(group),
    });
  }

  async addClientToGroup(groupId: string, clientId: string, inscriptionId: string) {
    return this.request(`/api/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ clientId, inscriptionId }),
    });
  }

  async getAccompagnateurs(voyageId?: string): Promise<Accompagnateur[]> {
    const qs = voyageId ? `?voyageId=${voyageId}` : '';
    return this.request(`/api/accompagnateurs${qs}`);
  }

  // Expenses
  async getExpenses(voyageId?: string): Promise<Expense[]> {
    const qs = voyageId ? `?voyageId=${voyageId}` : '';
    return this.request(`/api/expenses${qs}`);
  }

  async createExpense(expense: Partial<Expense>): Promise<Expense> {
    return this.request('/api/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    });
  }

  async updateExpense(id: string, updates: Partial<Expense>): Promise<Expense> {
    return this.request(`/api/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async cancelExpense(id: string, reason: string): Promise<Expense> {
    return this.request(`/api/expenses/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async deleteExpense(id: string) {
    return this.request(`/api/expenses/${id}`, {
      method: 'DELETE',
    });
  }

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    return this.request('/api/audit-logs');
  }

  // Espace Pèlerin (Dedicated Dossier & Multi-Client 5D)
  async getPilgrimDossier(clientId: string) {
    return this.request<{
      client: Partial<Client>;
      inscription?: Inscription;
      allInscriptions: Inscription[];
      payments: Payment[];
      documents: PilgrimDocument[];
      visa?: Visa;
      tickets: Ticket[];
      flights: Flight[];
      rooms: { hotelName?: string; city?: string; roomNumber?: string; roomType?: string }[];
      group?: { name: string; guideName?: string; busNumber?: string } | null;
    }>(`/api/pilgrim/dossier?clientId=${clientId}`);
  }

  async getPilgrimBeneficiaries() {
    return this.request<Array<{
      id: string;
      code: string;
      firstName: string;
      lastName: string;
      gender: string;
      phone: string;
      email: string;
      photoUrl?: string;
      passportNumber?: string;
      relationshipType: 'TITULAIRE' | 'TUTEUR_FAMILLE' | 'PAYEUR_TIERS' | 'GESTIONNAIRE';
      canView: boolean;
      canPay: boolean;
      canUploadDocs: boolean;
      isTest: boolean;
    }>>('/api/pilgrim/beneficiaries');
  }

  async addPilgrimBeneficiary(data: {
    firstName: string;
    lastName: string;
    gender: 'M' | 'F';
    phone: string;
    birthDate?: string;
    passportNumber?: string;
    relationshipType?: string;
    campaignId?: string;
    packageId?: string;
  }) {
    return this.request<{ client: any; inscription?: any; relationshipType: string }>('/api/pilgrim/beneficiaries', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadPilgrimDocument(data: {
    clientId: string;
    inscriptionId?: string;
    type: string;
    fileName?: string;
    fileUrl?: string;
  }) {
    return this.request('/api/pilgrim/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async recordPilgrimPayment(data: {
    clientId: string;
    inscriptionId: string;
    amount: number;
    paymentMethod?: string;
    reference?: string;
    comment?: string;
  }) {
    return this.request('/api/pilgrim/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Reset demo seed
  async resetSeed() {
    return this.request('/api/seed/reset', { method: 'POST' });
  }
}

const apiInstance = new ApiService();

export const api = new Proxy(apiInstance, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(target);
    }
    return value;
  }
}) as ApiService;
