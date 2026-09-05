import { campaignRepository } from '../repositories/campaign.repository.js';
import { packageRepository } from '../repositories/package.repository.js';
import { auditRepository } from '../repositories/audit.repository.js';
import { Voyage, VoyagePackage, UserSession } from '../../src/types.js';

export class CampaignService {
  // Campaigns (Voyages)
  public async getCampaigns(): Promise<Voyage[]> {
    return campaignRepository.getCampaigns();
  }

  public async getCampaignById(id: string): Promise<Voyage | null> {
    return campaignRepository.getCampaignById(id);
  }

  public async createCampaign(data: Omit<Voyage, 'id' | 'createdAt'>, actor: UserSession): Promise<Voyage> {
    const campaign = await campaignRepository.createCampaign(data);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'CREATION_CAMPAGNE',
      entityType: 'CAMPAIGN',
      entityId: campaign.id,
      newValue: { code: campaign.code, title: campaign.title, year: campaign.year },
    });
    return campaign;
  }

  public async updateCampaign(id: string, updates: Partial<Voyage>, actor: UserSession): Promise<Voyage> {
    const updated = await campaignRepository.updateCampaign(id, updates);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'MODIFICATION_CAMPAGNE',
      entityType: 'CAMPAIGN',
      entityId: id,
      newValue: updates,
    });
    return updated;
  }

  public async deleteCampaign(id: string, actor: UserSession): Promise<{ success: boolean }> {
    await campaignRepository.deleteCampaign(id);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'SUPPRESSION_CAMPAGNE',
      entityType: 'CAMPAIGN',
      entityId: id,
    });
    return { success: true };
  }

  // Packages
  public async getPackages(campaignId?: string): Promise<VoyagePackage[]> {
    return packageRepository.getPackages(campaignId);
  }

  public async createPackage(
    data: Omit<VoyagePackage, 'id' | 'activeVersionNumber' | 'versions' | 'createdAt'>,
    actor: UserSession
  ): Promise<VoyagePackage> {
    const pkg = await packageRepository.createPackage(data);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'CREATION_PACKAGE',
      entityType: 'PACKAGE',
      entityId: pkg.id,
      newValue: { code: pkg.code, name: pkg.name, price: pkg.price },
    });
    return pkg;
  }

  public async updatePackage(id: string, updates: Partial<VoyagePackage>, actor: UserSession): Promise<VoyagePackage> {
    const updated = await packageRepository.updatePackage(id, updates);
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'MODIFICATION_PACKAGE',
      entityType: 'PACKAGE',
      entityId: id,
      newValue: updates,
    });
    return updated;
  }

  public async addPackagePriceVersion(
    packageId: string,
    newPrice: number,
    status: 'PROVISOIRE' | 'DEFINITIF',
    effectiveFrom: string,
    note: string,
    actor: UserSession
  ): Promise<VoyagePackage> {
    const updated = await packageRepository.addPackagePriceVersion(
      packageId,
      newPrice,
      status,
      effectiveFrom,
      note
    );
    await auditRepository.logAudit({
      actorUserId: actor.id,
      actorUserName: actor.displayName || actor.email,
      action: 'NOUVELLE_VERSION_PRIX_PACKAGE',
      entityType: 'PACKAGE_VERSION',
      entityId: packageId,
      newValue: { newPrice, status, effectiveFrom, note, activeVersionNumber: updated.activeVersionNumber },
      reason: note,
    });
    return updated;
  }
}

export const campaignService = new CampaignService();
