import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Middleware & Auth
import { requireAuth, requirePermission, requireStaff } from './server/auth/auth.middleware.js';
import { authorizationService } from './server/auth/authorization.service.js';
import { createSignedSessionToken } from './server/auth/token.service.js';

// Repositories
import { userRepository } from './server/repositories/user.repository.js';
import { settingsRepository } from './server/repositories/settings.repository.js';
import { packageRepository } from './server/repositories/package.repository.js';
import { notificationRepository } from './server/repositories/notification.repository.js';
import { auditRepository } from './server/repositories/audit.repository.js';

// Services
import { clientService } from './server/services/client.service.js';
import { campaignService } from './server/services/campaign.service.js';
import { inscriptionService } from './server/services/inscription.service.js';
import { paymentService } from './server/services/payment.service.js';
import { documentService } from './server/services/document.service.js';
import { visaService } from './server/services/visa.service.js';
import { logisticsService } from './server/services/logistics.service.js';
import { expenseService } from './server/services/expense.service.js';
import { dashboardService } from './server/services/dashboard.service.js';
import { pilgrimService } from './server/services/pilgrim.service.js';

// Workflow Services (Phase 4.2 / Phase 5)
import { inscriptionWorkflowService } from './server/services/inscription-workflow.service.js';
import { paymentWorkflowService } from './server/services/payment-workflow.service.js';
import { logisticsWorkflowService } from './server/services/logistics-workflow.service.js';
import { campaignWorkflowService } from './server/services/campaign-workflow.service.js';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Règle de Sécurité Phase 3 : Validation stricte des secrets en production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.trim().length < 32) {
    console.error('[FATAL SECURITY ERROR] SESSION_SECRET est obligatoire en production (minimum 32 caractères). Démarrage du serveur refusé.');
    process.exit(1);
  }
}

app.use(express.json());

// Normalisation des erreurs API (Phase 5)
function formatErrorResponse(err: any) {
  const message = err?.message || 'Erreur interne du serveur';
  let status = 400;
  let code = 'BAD_REQUEST';

  if (message.includes('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST')) {
    status = 409;
    code = 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST';
  } else if (message.includes('DUPLICATE_INSCRIPTION') || message.includes('déjà une inscription active')) {
    status = 400;
    code = 'INSCRIPTION_ALREADY_EXISTS';
  } else if (message.includes('ROOM_FULL_ERROR') || message.includes('Capacité maximale')) {
    status = 422;
    code = 'ROOM_FULL_ERROR';
  } else if (message.includes('PASSPORT_EXPIRING_SOON') || message.includes('PASSPORT_INVALID')) {
    status = 422;
    code = 'PASSPORT_INVALID';
  } else if (message.includes('CAMPAIGN_MUTATION_FORBIDDEN_CLOSED') || message.includes('MUTATION_FORBIDDEN_ON_CLOSED_CAMPAIGN')) {
    status = 422;
    code = 'CAMPAIGN_MUTATION_FORBIDDEN_CLOSED';
  } else if (message.includes('introuvable') || message.includes('non trouvé')) {
    status = 404;
    code = 'NOT_FOUND';
  } else if (message.includes('interdit') || message.includes('non autorisé')) {
    status = 403;
    code = 'FORBIDDEN';
  }

  return {
    status,
    body: {
      error: message,
      code,
      details: {},
      error_info: {
        code,
        message,
        details: {},
      },
    },
  };
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 0. Health check (public)
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', engine: 'PostgreSQL Neon' });
});

// 1. Auth routes (public login endpoints)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email/Téléphone et mot de passe requis' });
  }
  try {
    const session = await userRepository.authenticate(email, password);
    if (!session) {
      return res.status(401).json({ error: 'Identifiants invalides ou compte inactif' });
    }
    const token = createSignedSessionToken(session);
    res.json({ user: session, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/pilgrim-login', async (req: Request, res: Response) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Numéro de téléphone ou Code pèlerin requis' });
  }
  try {
    const result = await userRepository.authenticatePilgrim(identifier);
    if (!result) {
      return res.status(404).json({ error: 'Aucun pèlerin trouvé avec ce numéro ou code' });
    }
    const token = createSignedSessionToken(result.user);
    res.json({ ...result, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
  res.json({ user: (req as any).user });
});

// User listing (Requires Auth & users.read permission - PELERIN strictly forbidden)
app.get('/api/auth/users', requireAuth, requirePermission('users.read'), async (req: Request, res: Response) => {
  try {
    const users = await userRepository.getUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', requireAuth, requirePermission('users.read'), async (req: Request, res: Response) => {
  try {
    const users = await userRepository.getFullUsers();
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', requireAuth, requirePermission('users.create'), async (req: Request, res: Response) => {
  try {
    const newUser = await userRepository.createUser(req.body);
    res.status(201).json(newUser);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', requireAuth, requirePermission('users.update'), async (req: Request, res: Response) => {
  try {
    const updated = await userRepository.updateUser(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', requireAuth, requirePermission('users.delete'), async (req: Request, res: Response) => {
  try {
    const success = await userRepository.deleteUser(req.params.id);
    res.json({ success });
  } catch (err: any) {
    const isConflict = err.message?.includes('SUPPRESSION_REFUSEE');
    res.status(isConflict ? 409 : 400).json({ error: err.message });
  }
});

// User Client Access routes (Multi-client / Tuteurs)
app.get('/api/users/:id/client-access', requireAuth, requirePermission('users.read'), async (req: Request, res: Response) => {
  try {
    const access = await userRepository.getUserAccessibleClients(req.params.id);
    res.json(access);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/client-access', requireAuth, requirePermission('users.update'), async (req: Request, res: Response) => {
  try {
    const { clientId, relationshipType, canView, canPay, canUploadDocs } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId est requis' });
    await userRepository.grantClientAccess({
      userId: req.params.id,
      clientId,
      relationshipType,
      canView,
      canPay,
      canUploadDocs,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id/client-access/:clientId', requireAuth, requirePermission('users.update'), async (req: Request, res: Response) => {
  try {
    const success = await userRepository.revokeClientAccess(req.params.id, req.params.clientId);
    res.json({ success });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/roles', requireAuth, async (req: Request, res: Response) => {
  try {
    const roles = await userRepository.getRoles();
    res.json(roles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Settings routes
app.get('/api/settings', requireAuth, requirePermission('settings.read'), async (req: Request, res: Response) => {
  try {
    const settings = await settingsRepository.getSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', requireAuth, requirePermission('settings.manage'), async (req: Request, res: Response) => {
  try {
    const updated = await settingsRepository.updateSettings(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Dashboard stats
app.get('/api/dashboard/stats', requireAuth, requirePermission('reports.read'), async (req: Request, res: Response) => {
  try {
    const stats = await dashboardService.getDashboardStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Clients routes
app.get('/api/clients', requireAuth, requirePermission('clients.read'), async (req: Request, res: Response) => {
  try {
    const { search, status } = req.query as { search?: string; status?: string };
    const clients = await clientService.getClients({ search, status });
    res.json(clients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/clients/:id', requireAuth, async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role === 'PELERIN') {
    if (user.clientId !== req.params.id) {
      return res.status(403).json({ error: 'Accès interdit aux données d\'un tiers' });
    }
  } else {
    const allowed = await authorizationService.authorize(user, 'clients.read');
    if (!allowed) {
      return res.status(403).json({ error: 'Accès non autorisé : la permission \'clients.read\' est requise.' });
    }
  }
  try {
    const client = await clientService.getClientById(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client introuvable' });
    res.json(client);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clients', requireAuth, requirePermission('clients.create'), async (req: Request, res: Response) => {
  try {
    const client = await clientService.createClient(req.body, req.user!);
    res.status(201).json(client);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/clients/:id', requireAuth, requirePermission('clients.update'), async (req: Request, res: Response) => {
  try {
    const updated = await clientService.updateClient(req.params.id, req.body, req.user!);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/clients/:id/dependencies', requireAuth, requirePermission('clients.read'), async (req: Request, res: Response) => {
  try {
    const deps = await clientService.getClientDependencies(req.params.id);
    res.json(deps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clients/:id/archive', requireAuth, requirePermission('clients.update'), async (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    const archived = await clientService.archiveClient(req.params.id, reason, req.user!);
    res.json(archived);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/clients/:id', requireAuth, requirePermission('clients.delete'), async (req: Request, res: Response) => {
  try {
    const result = await clientService.deleteClient(req.params.id, req.user!);
    res.json(result);
  } catch (err: any) {
    const isConflict = err.message?.includes('SUPPRESSION_REFUSEE');
    res.status(isConflict ? 409 : 400).json({ error: err.message });
  }
});

// 5. Voyages (Campaigns) routes
app.get(['/api/voyages', '/api/campaigns'], requireAuth, requirePermission('voyages.read'), async (req: Request, res: Response) => {
  try {
    const voyages = await campaignService.getCampaigns();
    res.json(voyages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post(['/api/voyages', '/api/campaigns'], requireAuth, requirePermission('voyages.manage'), async (req: Request, res: Response) => {
  try {
    const voyage = await campaignService.createCampaign(req.body, req.user!);
    res.status(201).json(voyage);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/voyages/:id', requireAuth, requirePermission('voyages.manage'), async (req: Request, res: Response) => {
  try {
    const updated = await campaignService.updateCampaign(req.params.id, req.body, req.user!);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/voyages/:id', requireAuth, requirePermission('voyages.manage'), async (req: Request, res: Response) => {
  try {
    const result = await campaignService.deleteCampaign(req.params.id, req.user!);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Packages routes & Price Versioning
app.get('/api/packages', requireAuth, requirePermission('voyages.read'), async (req: Request, res: Response) => {
  try {
    const { voyageId } = req.query as { voyageId?: string };
    const packages = await campaignService.getPackages(voyageId);
    res.json(packages);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/packages', requireAuth, requirePermission('voyages.manage'), async (req: Request, res: Response) => {
  try {
    const pkg = await campaignService.createPackage(req.body, req.user!);
    res.status(201).json(pkg);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/packages/:id', requireAuth, requirePermission('voyages.manage'), async (req: Request, res: Response) => {
  try {
    const updated = await campaignService.updatePackage(req.params.id, req.body, req.user!);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/packages/:id', requireAuth, requirePermission('voyages.manage'), async (req: Request, res: Response) => {
  try {
    await packageRepository.deletePackage(req.params.id);
    res.json({ success: true, message: 'Package supprimé' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/packages/:id/new-price-version', requireAuth, requirePermission('voyages.manage'), async (req: Request, res: Response) => {
  const { newPrice, status, effectiveFrom, note } = req.body;
  if (!newPrice || !status || !effectiveFrom) {
    return res.status(400).json({ error: 'Nouveau prix, statut et date de prise d’effet requis' });
  }
  try {
    const updated = await campaignService.addPackagePriceVersion(
      req.params.id,
      Number(newPrice),
      status,
      effectiveFrom,
      note || '',
      req.user!
    );
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Inscriptions routes
app.get('/api/inscriptions', requireAuth, requirePermission('inscriptions.read'), async (req: Request, res: Response) => {
  const user = req.user!;
  const { voyageId, clientId } = req.query as { voyageId?: string; clientId?: string };
  try {
    if (user.role === 'PELERIN') {
      const list = await inscriptionService.getInscriptions({ clientId: user.clientId });
      return res.json(list);
    }
    const list = await inscriptionService.getInscriptions({ campaignId: voyageId, clientId });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inscriptions', requireAuth, requirePermission('inscriptions.create'), async (req: Request, res: Response) => {
  try {
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
    const ins = await inscriptionWorkflowService.createInscription({
      clientId: req.body.clientId,
      campaignId: req.body.campaignId || req.body.voyageId,
      packageId: req.body.packageId,
      agreedPrice: req.body.agreedPrice || req.body.appliedPrice,
      priceModificationReason: req.body.priceModificationReason,
      registrationDate: req.body.registrationDate,
      idempotencyKey,
      overrideClosedCampaign: req.body.overrideClosedCampaign,
    }, req.user!);
    res.status(201).json(ins);
  } catch (err: any) {
    const errResp = formatErrorResponse(err);
    res.status(errResp.status).json(errResp.body);
  }
});

app.patch('/api/inscriptions/:id/price', requireAuth, requirePermission('inscriptions.update'), async (req: Request, res: Response) => {
  const { newPrice, reason } = req.body;
  if (!newPrice || Number(newPrice) <= 0) {
    return res.status(400).json({ error: 'Le montant convenu doit être supérieur à 0' });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Le motif de modification du prix est obligatoire' });
  }
  try {
    const updated = await inscriptionService.updateInscriptionPrice(req.params.id, Number(newPrice), reason.trim(), req.user!);
    res.json(updated);
  } catch (err: any) {
    const errResp = formatErrorResponse(err);
    res.status(errResp.status).json(errResp.body);
  }
});

app.put('/api/inscriptions/:id/status', requireAuth, requirePermission('inscriptions.update'), async (req: Request, res: Response) => {
  const { status } = req.body;
  try {
    const updated = await inscriptionService.updateInscriptionStatus(req.params.id, status, req.user!);
    res.json(updated);
  } catch (err: any) {
    const errResp = formatErrorResponse(err);
    res.status(errResp.status).json(errResp.body);
  }
});

app.delete('/api/inscriptions/:id', requireAuth, requirePermission('inscriptions.cancel'), async (req: Request, res: Response) => {
  try {
    const reason = (req.body?.reason as string) || 'Annulation du dossier par le conseiller';
    const result = await inscriptionService.cancelInscription(req.params.id, reason, req.user!);
    res.json({ success: true, message: `Dossier ${result.code} annulé avec succès.`, inscription: result });
  } catch (err: any) {
    const errResp = formatErrorResponse(err);
    res.status(errResp.status).json(errResp.body);
  }
});

// 8. Payments & Receipts (Ultra-sensitive zone)
app.get('/api/payments', requireAuth, requirePermission('payments.read'), async (req: Request, res: Response) => {
  const user = req.user!;
  const { clientId, inscriptionId, voyageId } = req.query as {
    clientId?: string;
    inscriptionId?: string;
    voyageId?: string;
  };
  try {
    if (user.role === 'PELERIN') {
      const list = await paymentService.getPayments({ clientId: user.clientId });
      return res.json(list.filter((p) => p.status === 'VALIDE'));
    }
    const list = await paymentService.getPayments({ clientId, inscriptionId, campaignId: voyageId });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', requireAuth, requirePermission('payments.create'), async (req: Request, res: Response) => {
  try {
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
    const payment = await paymentWorkflowService.recordPayment({
      clientId: req.body.clientId,
      inscriptionId: req.body.inscriptionId,
      amount: Number(req.body.amount),
      paymentMethod: req.body.paymentMethod,
      reference: req.body.reference,
      comment: req.body.comment,
      paymentDate: req.body.paymentDate,
      idempotencyKey,
      overrideClosedCampaign: req.body.overrideClosedCampaign,
    }, req.user!);
    res.status(201).json(payment);
  } catch (err: any) {
    const errResp = formatErrorResponse(err);
    res.status(errResp.status).json(errResp.body);
  }
});

app.post('/api/payments/:id/cancel', requireAuth, requirePermission('payments.cancel'), async (req: Request, res: Response) => {
  try {
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
    const reason = req.body.reason || 'Erreur de saisie';
    const canceled = await paymentWorkflowService.cancelPayment({
      paymentId: req.params.id,
      reason,
      idempotencyKey,
      overrideClosedCampaign: req.body.overrideClosedCampaign,
    }, req.user!);
    res.json(canceled);
  } catch (err: any) {
    const errResp = formatErrorResponse(err);
    res.status(errResp.status).json(errResp.body);
  }
});

// 9. Documents
app.get('/api/documents', requireAuth, requirePermission('documents.read'), async (req: Request, res: Response) => {
  const user = req.user!;
  const { clientId, inscriptionId } = req.query as { clientId?: string; inscriptionId?: string };
  try {
    if (user.role === 'PELERIN') {
      const list = await documentService.getDocuments({ clientId: user.clientId });
      return res.json(list.filter((d) => d.isClientVisible));
    }
    const list = await documentService.getDocuments({ clientId, inscriptionId });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents', requireAuth, requirePermission('documents.create'), async (req: Request, res: Response) => {
  try {
    const doc = await documentService.createDocument(req.body, req.user!);
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/documents/:id/status', requireAuth, requirePermission('documents.validate'), async (req: Request, res: Response) => {
  const { status, comment } = req.body;
  try {
    const updated = await documentService.updateDocumentStatus(req.params.id, status, comment, req.user!);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 10. Visas
app.get('/api/visas', requireAuth, requirePermission('visas.read'), async (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  try {
    const visas = await visaService.getVisas(voyageId);
    res.json(visas);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/visas/:id', requireAuth, requirePermission('visas.update'), async (req: Request, res: Response) => {
  try {
    const updated = await visaService.updateVisa(req.params.id, req.body, req.user!);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 11. Flights & Tickets
app.get('/api/flights', requireAuth, requirePermission('logistics.read'), async (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  try {
    const flights = await logisticsService.getFlights(voyageId);
    res.json(flights);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/flights', requireAuth, requirePermission('logistics.manage'), async (req: Request, res: Response) => {
  try {
    const flt = await logisticsService.createFlight(req.body, req.user!);
    res.status(201).json(flt);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/tickets', requireAuth, requirePermission('logistics.read'), async (req: Request, res: Response) => {
  const { flightId, clientId } = req.query as { flightId?: string; clientId?: string };
  try {
    const tickets = await logisticsService.getTickets({ flightId, clientId });
    res.json(tickets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tickets', requireAuth, requirePermission('logistics.manage'), async (req: Request, res: Response) => {
  try {
    const ticket = await logisticsService.createTicket(req.body, req.user!);
    res.status(201).json(ticket);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 12. Hotels & Rooms (Physical capacity enforcement)
app.get('/api/hotels', requireAuth, requirePermission('logistics.read'), async (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  try {
    const hotels = await logisticsService.getHotels(voyageId);
    res.json(hotels);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/hotels', requireAuth, requirePermission('logistics.manage'), async (req: Request, res: Response) => {
  try {
    const hotel = await logisticsService.createHotel(req.body, req.user!);
    res.status(201).json(hotel);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/rooms', requireAuth, requirePermission('logistics.read'), async (req: Request, res: Response) => {
  const { hotelId } = req.query as { hotelId?: string };
  try {
    const rooms = await logisticsService.getRooms(hotelId);
    res.json(rooms);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rooms', requireAuth, requirePermission('logistics.manage'), async (req: Request, res: Response) => {
  try {
    const room = await logisticsService.createRoom(req.body, req.user!);
    res.status(201).json(room);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/rooms/:id/assign', requireAuth, requirePermission('logistics.manage'), async (req: Request, res: Response) => {
  const { clientId, inscriptionId, checkInDate, checkOutDate, notes } = req.body;
  try {
    const assignment = await logisticsWorkflowService.assignRoomPessimistic({
      roomId: req.params.id,
      clientId,
      inscriptionId,
      checkInDate: checkInDate || '2027-05-15',
      checkOutDate: checkOutDate || '2027-06-05',
      notes,
    }, req.user!);
    res.status(201).json(assignment);
  } catch (err: any) {
    const errResp = formatErrorResponse(err);
    res.status(errResp.status).json(errResp.body);
  }
});

app.delete('/api/rooms/:id/occupants/:clientId', requireAuth, requirePermission('logistics.manage'), async (req: Request, res: Response) => {
  try {
    const result = await logisticsService.removeClientFromRoom(req.params.id, req.params.clientId, req.user!);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 13. Groups & Accompagnateurs
app.get('/api/groups', requireAuth, requirePermission('logistics.read'), async (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  try {
    const groups = await logisticsService.getGroups(voyageId);
    res.json(groups);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/groups', requireAuth, requirePermission('logistics.manage'), async (req: Request, res: Response) => {
  try {
    const grp = await logisticsService.createGroup(req.body, req.user!);
    res.status(201).json(grp);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/groups/:id/members', requireAuth, requirePermission('logistics.manage'), async (req: Request, res: Response) => {
  const { clientId, inscriptionId } = req.body;
  try {
    const member = await logisticsService.addClientToGroup(req.params.id, clientId, inscriptionId, req.user!);
    res.status(201).json(member);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/accompagnateurs', requireAuth, requirePermission('logistics.read'), async (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  try {
    const acc = await logisticsService.getAccompagnateurs(voyageId);
    res.json(acc);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Expenses & Rentability
app.get('/api/expenses', requireAuth, requirePermission('expenses.read'), async (req: Request, res: Response) => {
  const { voyageId } = req.query as { voyageId?: string };
  try {
    const expenses = await expenseService.getExpenses(voyageId);
    res.json(expenses);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/expenses', requireAuth, requirePermission('expenses.create'), async (req: Request, res: Response) => {
  try {
    const expense = await expenseService.createExpense(req.body, req.user!);
    res.status(201).json(expense);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/expenses/:id', requireAuth, requirePermission('expenses.delete'), async (req: Request, res: Response) => {
  try {
    const resDel = await expenseService.deleteExpense(req.params.id, req.user!);
    res.json(resDel);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 15. Audit Logs
app.get('/api/audit-logs', requireAuth, requirePermission('audit.read'), async (req: Request, res: Response) => {
  try {
    const logs = await auditRepository.getAuditLogs(200);
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit-logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { action, entityType, entityId, metadata } = req.body;
    await auditRepository.logAction(req.user!.id, action, entityType, entityId, metadata);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 16. Espace Pèlerin (Strict Isolation & 5D Multi-Clients)
app.get('/api/pilgrim/beneficiaries', requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await pilgrimService.getAccessiblePilgrims(req.user!);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pilgrim/dossier', requireAuth, async (req: Request, res: Response) => {
  let clientId = (req.query.clientId as string) || (req.headers['x-client-id'] as string);
  
  if (!clientId) {
    const accessible = await userRepository.getUserAccessibleClients(req.user!.id);
    clientId = accessible[0]?.id || req.user!.clientId;
  }

  if (!clientId) {
    return res.status(400).json({ error: 'Identifiant pèlerin requis' });
  }
  try {
    const dossier = await pilgrimService.getPilgrimDossier(clientId, req.user!);
    res.json(dossier);
  } catch (err: any) {
    if (err.message === 'ACCES_REFUSE_PELERIN_ISOLATION') {
      return res.status(403).json({ error: 'Accès strictement interdit au dossier d\'un autre pèlerin.' });
    }
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/pilgrim/beneficiaries', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await pilgrimService.addBeneficiary(req.user!, req.body);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/pilgrim/documents', requireAuth, async (req: Request, res: Response) => {
  const { clientId, inscriptionId, type, fileName, fileUrl } = req.body;
  if (!clientId || !type) {
    return res.status(400).json({ error: 'Client et Type de document requis' });
  }

  try {
    const hasUpload = await userRepository.hasAccessToClient(req.user!.id, clientId, 'canUploadDocs');
    if (!hasUpload && req.user!.role === 'PELERIN') {
      return res.status(403).json({ error: 'Dépôt de documents non autorisé pour ce bénéficiaire' });
    }

    const doc = await documentService.createDocument(
      {
        clientId,
        inscriptionId,
        type,
        fileName: fileName || `${type}.pdf`,
        fileUrl: fileUrl || 'https://storage.taiba.sn/docs/pending.pdf',
        status: 'RECU',
        isClientVisible: true,
      },
      req.user!
    );
    res.status(201).json(doc);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/pilgrim/payments', requireAuth, async (req: Request, res: Response) => {
  const { clientId, inscriptionId, amount, paymentMethod, reference, comment } = req.body;
  if (!clientId || !inscriptionId || !amount) {
    return res.status(400).json({ error: 'Client, Inscription et Montant requis' });
  }

  try {
    const hasPay = await userRepository.hasAccessToClient(req.user!.id, clientId, 'canPay');
    if (!hasPay && req.user!.role === 'PELERIN') {
      return res.status(403).json({ error: 'Paiement non autorisé pour ce bénéficiaire' });
    }

    const payment = await paymentService.createPayment(
      {
        clientId,
        inscriptionId,
        amount: Number(amount),
        paymentMethod: paymentMethod || 'WAVE',
        reference: reference || `ONLINE-${Date.now()}`,
        comment: comment || `Paiement en ligne par ${req.user!.displayName || req.user!.email}`,
      },
      req.user!
    );
    res.status(201).json(payment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 17. Notifications
app.get('/api/notifications', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const notifs = await notificationRepository.getNotifications(user.id, user.clientId);
    res.json(notifs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications', requireAuth, async (req: Request, res: Response) => {
  try {
    const idempotencyKey = await notificationRepository.createNotification(req.body);
    res.json({ success: true, idempotencyKey });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/notifications/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    await notificationRepository.markAsRead(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/notifications/read-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    await notificationRepository.markAllAsRead(user.id, user.clientId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
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
    console.log(`GIE TAIBA VOYAGES ERP (PostgreSQL Neon Engine) Server running on http://0.0.0.0:${PORT}`);
  });
}

// Start server only if executed directly
if (
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') ||
   process.argv[1].endsWith('server.cjs') ||
   process.argv[1].endsWith('server.js'))
) {
  startServer();
}

export { app };
