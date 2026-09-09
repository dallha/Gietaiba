import { clientRepository } from '../repositories/client.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { Client, UserSession } from '../../src/types.js';

export class ClientService {
  public async getClients(query?: { search?: string; status?: string }): Promise<Client[]> {
    return clientRepository.getClients(query);
  }

  public async getClientById(id: string): Promise<Client | null> {
    return clientRepository.getClientById(id);
  }

  public async createClient(
    clientData: Omit<Client, 'id' | 'code' | 'createdAt' | 'updatedAt'>,
    actor: UserSession
  ): Promise<Client> {
    const client = await clientRepository.createClient(clientData);

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'CREATION_CLIENT',
      entityType: 'CLIENT',
      entityId: client.id,
      newValue: client,
    });

    return client;
  }

  public async updateClient(id: string, updates: Partial<Client>, actor: UserSession): Promise<Client> {
    const old = await clientRepository.getClientById(id);
    if (!old) throw new Error('Client introuvable.');

    const updated = await clientRepository.updateClient(id, updates);

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'MODIFICATION_CLIENT',
      entityType: 'CLIENT',
      entityId: id,
      oldValue: old,
      newValue: updated,
    });

    return updated;
  }

  public async getClientDependencies(id: string) {
    return clientRepository.checkClientDependencies(id);
  }

  public async archiveClient(id: string, reason: string | undefined, actor: UserSession): Promise<Client> {
    const old = await clientRepository.getClientById(id);
    if (!old) throw new Error('Client introuvable.');

    const archived = await clientRepository.archiveClient(id);

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'ARCHIVAGE_CLIENT',
      entityType: 'CLIENT',
      entityId: id,
      oldValue: { status: old.status },
      newValue: { status: 'ARCHIVE', reason: reason || 'Archivage administratif' },
      reason: reason || 'Archivage administratif',
    });

    return archived;
  }

  public async deleteClient(id: string, actor: UserSession): Promise<{ success: boolean; message: string }> {
    const old = await clientRepository.getClientById(id);
    if (!old) throw new Error('Client introuvable.');

    try {
      await clientRepository.deleteClient(id);
    } catch (err: any) {
      if (err.message?.includes('SUPPRESSION_REFUSEE_DEPENDANCES_EXISTANTES')) {
        err.code = 'SUPPRESSION_REFUSEE_DEPENDANCES_EXISTANTES';
      }
      throw err;
    }

    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'SUPPRESSION_CLIENT',
      entityType: 'CLIENT',
      entityId: id,
      oldValue: old,
    });

    return {
      success: true,
      message: `Pèlerin ${old.firstName} ${old.lastName} supprimé avec succès.`,
    };
  }
}

export const clientService = new ClientService();
