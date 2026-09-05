import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.js';
import { sendNotification } from './server/notification.service.js';
import { UserSession } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Simple Auth & Session Middleware
function getCurrentUser(req: Request): UserSession {
  const authHeader = req.headers['x-user-id'] as string;
  const users = db.getUsers();
  if (authHeader) {
    const user = users.find((u) => u.id === authHeader);
    if (user) return user;
  }
  // Default to Super Admin for admin testing if header not provided
  return users[0];
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 0. Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// 1. Auth routes
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email/Téléphone et mot de passe requis' });
  }
  const session = db.authenticate(email, password);
  if (!session) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }
  res.json({ user: session });
});

app.post('/api/auth/pilgrim-login', (req: Request, res: Response) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Numéro de téléphone ou Code pèlerin requis' });
  }
  const result = db.authenticatePilgrim(identifier);
  if (!result) {
    return res.status(404).json({ error: 'Aucun pèlerin trouvé avec ce numéro ou code' });
  }
  res.json(result);
});

app.get('/api/auth/users', (req: Request, res: Response) => {
  res.json(db.getUsers());
});

app.get('/api/users', (req: Request, res: Response) => {
  res.json(db.getUsers());
});

// 2. Settings routes
app.get('/api/settings', (req: Request, res: Response) => {
  res.json(db.getSettings());
});

app.put('/api/settings', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'DIRECTION') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  const updated = db.updateSettings(req.body, user);
  res.json(updated);
});

// 3. Dashboard stats
app.get('/api/dashboard/stats', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role === 'PELERIN') {
    return res.status(403).json({ error: 'Interdit aux pèlerins' });
  }
  res.json(db.getDashboardStats());
});

// 4. Clients routes
app.get('/api/clients', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role === 'PELERIN') {
    return res.status(403).json({ error: 'Interdit aux pèlerins' });
  }
  const { search, status } = req.query as { search?: string; status?: string };
  const clients = db.getClients({ search, status });
  res.json(clients);
});

app.get('/api/clients/:id', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role === 'PELERIN' && user.clientId !== req.params.id) {
    return res.status(403).json({ error: 'Interdit' });
  }
  const client = db.getClientById(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client introuvable' });
  res.json(client);
});

app.post('/api/clients', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const client = db.createClient(req.body, user);
    res.status(201).json(client);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/clients/:id', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const updated = db.updateClient(req.params.id, req.body, user);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/clients/:id', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const result = db.deleteClient(req.params.id, user);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Voyages routes
app.get('/api/voyages', (req: Request, res: Response) => {
  res.json(db.getVoyages());
});

app.post('/api/voyages', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const voyage = db.createVoyage(req.body, user);
    res.status(201).json(voyage);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/voyages/:id', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const updated = db.updateVoyage(req.params.id, req.body, user);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/voyages/:id', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const result = db.deleteVoyage(req.params.id, user);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Packages routes & Price Versioning
app.get('/api/packages', (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  res.json(db.getPackages(voyageId));
});

app.post('/api/packages', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const pkg = db.createPackage(req.body, user);
    res.status(201).json(pkg);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/packages/:id', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const updated = db.updatePackage(req.params.id, req.body, user);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/packages/:id', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const result = db.deletePackage(req.params.id, user);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/packages/:id/new-price-version', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { newPrice, status, effectiveFrom, note } = req.body;
  if (!newPrice || !status || !effectiveFrom) {
    return res.status(400).json({ error: 'Nouveau prix, statut et date de prise d’effet requis' });
  }
  try {
    const updated = db.updatePackagePriceVersion(
      req.params.id,
      Number(newPrice),
      status,
      effectiveFrom,
      note || '',
      user
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Inscriptions routes
app.get('/api/inscriptions', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { voyageId, clientId } = req.query as { voyageId?: string; clientId?: string };
  if (user.role === 'PELERIN') {
    return res.json(db.getInscriptions({ clientId: user.clientId }));
  }
  res.json(db.getInscriptions({ voyageId, clientId }));
});

app.post('/api/inscriptions', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const ins = db.createInscription(req.body, user);
    res.status(201).json(ins);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Price modification with mandatory audit trail
app.patch('/api/inscriptions/:id/price', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role === 'PELERIN') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }
  const { newPrice, reason } = req.body;
  if (!newPrice || Number(newPrice) <= 0) {
    return res.status(400).json({ error: 'Le montant convenu doit être supérieur à 0' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Le motif de modification du prix est obligatoire' });
  }
  try {
    const updated = db.updateInscriptionPrice(req.params.id, Number(newPrice), reason.trim(), user);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Payments & Receipts
app.get('/api/payments', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { clientId, inscriptionId, voyageId } = req.query as {
    clientId?: string;
    inscriptionId?: string;
    voyageId?: string;
  };
  if (user.role === 'PELERIN') {
    return res.json(db.getPayments({ clientId: user.clientId }));
  }
  res.json(db.getPayments({ clientId, inscriptionId, voyageId }));
});

app.post('/api/payments', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'DIRECTION' && user.role !== 'CAISSE') {
    return res.status(403).json({ error: 'Seule la Caisse ou la Direction peut enregistrer un paiement' });
  }
  try {
    const payment = db.createPayment(req.body, user);
    // Notification pèlerin
    sendNotification({
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
    });
    // Notification staff (Caisse & Direction)
    sendNotification({
      recipientUserId: 'STAFF',
      recipientClientId: payment.clientId,
      inscriptionId: payment.inscriptionId,
      type: 'PAYMENT_RECEIVED',
      category: 'PAYMENT',
      title: `Encaissement : ${payment.amount.toLocaleString()} FCFA`,
      message: `${user.displayName} a enregistré un reçu n° ${payment.receiptNumber} (${payment.paymentMethod}).`,
      entityType: 'payment',
      entityId: payment.id,
      priority: 'MEDIUM',
      actionUrl: 'paiements'
    });
    res.status(201).json(payment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/payments/:id/cancel', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'DIRECTION') {
    return res.status(403).json({ error: 'Annulation réservée à la Direction ou Super Admin' });
  }
  try {
    const canceled = db.cancelPayment(req.params.id, req.body.reason || 'Erreur de saisie', user);
    sendNotification({
      recipientClientId: canceled.clientId,
      inscriptionId: canceled.inscriptionId,
      type: 'PAYMENT_CANCELLED',
      category: 'PAYMENT',
      title: 'Paiement annulé',
      message: `Le versement n° ${canceled.receiptNumber} a été annulé par la direction. Motif: ${req.body.reason || 'Erreur de saisie'}.`,
      entityType: 'payment',
      entityId: canceled.id,
      priority: 'HIGH',
      actionUrl: 'finances'
    });
    res.json(canceled);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Documents
app.get('/api/documents', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { clientId, inscriptionId } = req.query as { clientId?: string; inscriptionId?: string };
  if (user.role === 'PELERIN') {
    return res.json(db.getDocuments({ clientId: user.clientId }).filter((d) => d.isClientVisible));
  }
  res.json(db.getDocuments({ clientId, inscriptionId }));
});

app.post('/api/documents', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const doc = db.createDocument(req.body, user);
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/documents/:id/status', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { status, comment } = req.body;
  try {
    const updated = db.updateDocumentStatus(req.params.id, status, comment, user);
    if (status === 'VALIDE' || status === 'VALIDATED') {
      sendNotification({
        recipientClientId: updated.clientId,
        type: 'DOCUMENT_VALIDATED',
        category: 'DOCUMENT',
        title: `Pièce validée : ${updated.fileName || updated.type}`,
        message: `Votre document a été examiné et validé.`,
        entityType: 'document',
        entityId: updated.id,
        priority: 'MEDIUM',
        actionUrl: 'documents'
      });
    } else if (status === 'REJETE' || status === 'REJECTED') {
      sendNotification({
        recipientClientId: updated.clientId,
        type: 'DOCUMENT_REJECTED',
        category: 'DOCUMENT',
        title: `Pièce rejetée : ${updated.fileName || updated.type}`,
        message: `Votre document a été rejeté. Motif: ${comment || 'Non conforme'}`,
        entityType: 'document',
        entityId: updated.id,
        priority: 'HIGH',
        actionUrl: 'documents'
      });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 10. Visas
app.get('/api/visas', (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  res.json(db.getVisas(voyageId));
});

app.put('/api/visas/:id', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const updated = db.updateVisa(req.params.id, req.body, user);
    if (req.body.statut === 'VALIDE' || req.body.statut === 'EMIS') {
      sendNotification({
        recipientClientId: updated.clientId,
        type: 'VISA_AVAILABLE',
        category: 'LOGISTICS',
        title: `Visa officiel délivré`,
        message: `Votre visa pour le Royaume d'Arabie Saoudite est validé par le Ministère.`,
        entityType: 'visa',
        entityId: updated.id,
        priority: 'HIGH',
        actionUrl: 'dossier'
      });
    }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 11. Flights & Tickets
app.get('/api/flights', (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  res.json(db.getFlights(voyageId));
});

app.post('/api/flights', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const flt = db.createFlight(req.body, user);
    res.status(201).json(flt);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tickets', (req: Request, res: Response) => {
  const { flightId, clientId } = req.query as { flightId?: string; clientId?: string };
  res.json(db.getTickets({ flightId, clientId }));
});

app.post('/api/tickets', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const ticket = db.createTicket(req.body, user);
    if (ticket.clientId) {
      sendNotification({
        recipientClientId: ticket.clientId,
        type: 'TICKET_ASSIGNED',
        category: 'LOGISTICS',
        title: "Billet d'avion émis",
        message: `Votre billet de vol (N°: ${ticket.ticketNumber || ticket.pnr || 'Confirmé'}) est désormais disponible.`,
        entityType: 'flight',
        entityId: ticket.id,
        priority: 'MEDIUM',
        actionUrl: 'logistique'
      });
    }
    res.status(201).json(ticket);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 12. Hotels & Rooms (Capacity enforcement)
app.get('/api/hotels', (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  res.json(db.getHotels(voyageId));
});

app.post('/api/hotels', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const hotel = db.createHotel(req.body, user);
    res.status(201).json(hotel);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/rooms', (req: Request, res: Response) => {
  const { hotelId } = req.query as { hotelId?: string };
  res.json(db.getRooms(hotelId));
});

app.post('/api/rooms', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const room = db.createRoom(req.body, user);
    res.status(201).json(room);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/rooms/:id/assign', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { clientId, inscriptionId } = req.body;
  try {
    const assignment = db.assignClientToRoom(req.params.id, clientId, inscriptionId, user);
    if (clientId) {
      sendNotification({
        recipientClientId: clientId,
        inscriptionId,
        type: 'HOTEL_ASSIGNED',
        category: 'LOGISTICS',
        title: 'Hébergement attribué',
        message: "Votre chambre d'hôtel a été attribuée avec succès.",
        entityType: 'hotel',
        entityId: assignment.id,
        priority: 'MEDIUM',
        actionUrl: 'logistique'
      });
    }
    res.status(201).json(assignment);
  } catch (err: any) {
    res.status(422).json({ error: err.message });
  }
});

// 12b. Notifications endpoint (Firestore-backed)
app.post('/api/notifications', async (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role === 'PELERIN') {
    return res.status(403).json({ error: 'Les pèlerins ne peuvent pas créer directement de notifications' });
  }

  try {
    const key = await sendNotification(req.body);
    res.status(201).json({ success: true, idempotencyKey: key });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/rooms/:id/occupants/:clientId', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const result = db.removeClientFromRoom(req.params.id, req.params.clientId, user);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 13. Groups & Accompagnateurs
app.get('/api/groups', (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  res.json(db.getGroups(voyageId));
});

app.post('/api/groups', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const grp = db.createGroup(req.body, user);
    res.status(201).json(grp);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/groups/:id/members', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  const { clientId, inscriptionId } = req.body;
  try {
    const member = db.addClientToGroup(req.params.id, clientId, inscriptionId, user);
    res.status(201).json(member);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/accompagnateurs', (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  res.json(db.getAccompagnateurs(voyageId));
});

// 14. Expenses & Rentability
app.get('/api/expenses', (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  res.json(db.getExpenses(voyageId));
});

app.post('/api/expenses', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const expense = db.createExpense(req.body, user);
    res.status(201).json(expense);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  try {
    const resDel = db.deleteExpense(req.params.id, user);
    res.json(resDel);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 15. Audit Logs
app.get('/api/audit-logs', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'DIRECTION') {
    return res.status(403).json({ error: 'Accès réservé à la Direction et Administrateurs' });
  }
  res.json(db.getAuditLogs());
});

// 16. Espace Pèlerin (Strict Isolation)
app.get('/api/pilgrim/dossier', (req: Request, res: Response) => {
  const clientId = (req.query.clientId as string) || (req.headers['x-client-id'] as string);
  if (!clientId) {
    return res.status(400).json({ error: 'Identifiant pèlerin requis' });
  }
  try {
    const dossier = db.getPilgrimDossier(clientId);
    res.json(dossier);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// 17. Seed Reset
app.post('/api/seed/reset', (req: Request, res: Response) => {
  const user = getCurrentUser(req);
  if (user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Seul le Super Admin peut réinitialiser la base' });
  }
  db.resetToInitialSeed();
  res.json({ message: 'Base de données réinitialisée avec succès avec les données Hajj 2027.' });
});

// API 404 Catch-All: ensures ANY unhandled /api/* route returns 404 JSON and never reaches Vite HTML fallback
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: `Route API introuvable: ${req.method} ${req.originalUrl}` });
});

// ----------------------------------------------------
// VITE MIDDLEWARE & SPA FALLBACK
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GIE VOYAGE ERP V4 Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
