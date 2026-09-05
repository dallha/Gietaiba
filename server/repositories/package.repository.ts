import { pool } from '../db/neon.js';
import { VoyagePackage, PackageVersion } from '../../src/types.js';

export class PackageRepository {
  public async getPackages(campaignId?: string): Promise<VoyagePackage[]> {
    let sql = `SELECT * FROM packages`;
    const params: any[] = [];
    if (campaignId) {
      params.push(campaignId);
      sql += ` WHERE campaign_id = $1`;
    }
    sql += ` ORDER BY created_at ASC`;

    const res = await pool.query(sql, params);
    const packages: VoyagePackage[] = [];

    for (const row of res.rows) {
      const versionsRes = await pool.query(
        `SELECT * FROM package_versions WHERE package_id = $1 ORDER BY version_number ASC`,
        [row.id]
      );
      const versions = versionsRes.rows.map(this.mapRowToVersion);
      packages.push(this.mapRowToPackage(row, versions));
    }

    return packages;
  }

  public async getPackageById(id: string): Promise<VoyagePackage | null> {
    const res = await pool.query(`SELECT * FROM packages WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;

    const versionsRes = await pool.query(
      `SELECT * FROM package_versions WHERE package_id = $1 ORDER BY version_number ASC`,
      [id]
    );
    const versions = versionsRes.rows.map(this.mapRowToVersion);
    return this.mapRowToPackage(res.rows[0], versions);
  }

  public async createPackage(
    data: Omit<VoyagePackage, 'id' | 'activeVersionNumber' | 'versions' | 'createdAt'>
  ): Promise<VoyagePackage> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const packageId = `pkg-${Date.now()}`;
      const versionId = `ver-${Date.now()}-1`;
      const now = new Date();

      // 1. Insertion package
      const pkgRes = await client.query(
        `INSERT INTO packages (
          id, campaign_id, code, name, category, description, price, initial_price, current_price,
          currency, capacity, room_type, hotel_makkah, hotel_medina, conditions, services_included,
          status, valid_from, active_version_number, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 1, NOW(), NOW())
        RETURNING *`,
        [
          packageId,
          data.voyageId,
          data.code,
          data.name,
          data.category,
          data.description || null,
          data.price,
          data.initialPrice || data.price,
          data.currentPrice || data.price,
          data.currency || 'FCFA',
          data.capacity || null,
          data.roomType || null,
          data.hotelMakkah || null,
          data.hotelMedina || null,
          data.conditions || null,
          data.servicesIncluded || [],
          data.status || 'PROVISOIRE',
          new Date(data.validFrom),
        ]
      );

      // 2. Insertion version 1
      const verRes = await client.query(
        `INSERT INTO package_versions (
          id, package_id, version_number, price, status, effective_from, note, created_at
        ) VALUES ($1, $2, 1, $3, $4, $5, $6, NOW())
        RETURNING *`,
        [
          versionId,
          packageId,
          data.price,
          data.status || 'PROVISOIRE',
          new Date(data.validFrom),
          'Création initiale du package',
        ]
      );

      await client.query('COMMIT');
      const initialVersion = this.mapRowToVersion(verRes.rows[0]);
      return this.mapRowToPackage(pkgRes.rows[0], [initialVersion]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async updatePackage(id: string, updates: Partial<VoyagePackage>): Promise<VoyagePackage> {
    const current = await this.getPackageById(id);
    if (!current) throw new Error('Package introuvable');

    const merged = { ...current, ...updates };

    const res = await pool.query(
      `UPDATE packages SET
        code = $1,
        name = $2,
        category = $3,
        description = $4,
        price = $5,
        currency = $6,
        capacity = $7,
        room_type = $8,
        hotel_makkah = $9,
        hotel_medina = $10,
        conditions = $11,
        services_included = $12,
        status = $13,
        valid_from = $14,
        updated_at = NOW()
       WHERE id = $15
       RETURNING *`,
      [
        merged.code,
        merged.name,
        merged.category,
        merged.description || null,
        merged.price,
        merged.currency || 'FCFA',
        merged.capacity || null,
        merged.roomType || null,
        merged.hotelMakkah || null,
        merged.hotelMedina || null,
        merged.conditions || null,
        merged.servicesIncluded || [],
        merged.status,
        new Date(merged.validFrom),
        id,
      ]
    );

    const versionsRes = await pool.query(
      `SELECT * FROM package_versions WHERE package_id = $1 ORDER BY version_number ASC`,
      [id]
    );
    const versions = versionsRes.rows.map(this.mapRowToVersion);
    return this.mapRowToPackage(res.rows[0], versions);
  }

  /**
   * Price Versioning (Rule 7: Historical price immutability)
   */
  public async addPackagePriceVersion(
    packageId: string,
    newPrice: number,
    status: 'PROVISOIRE' | 'DEFINITIF',
    effectiveFrom: string,
    note: string
  ): Promise<VoyagePackage> {
    const pkg = await this.getPackageById(packageId);
    if (!pkg) throw new Error('Package introuvable');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const nextVersionNumber = pkg.activeVersionNumber + 1;
      const versionId = `ver-${Date.now()}-${nextVersionNumber}`;

      // Clôturer la date d'effet de l'ancienne version
      await client.query(
        `UPDATE package_versions SET effective_to = $1 WHERE package_id = $2 AND effective_to IS NULL`,
        [new Date(effectiveFrom), packageId]
      );

      // Insérer la nouvelle version
      await client.query(
        `INSERT INTO package_versions (
          id, package_id, version_number, price, status, effective_from, note, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [versionId, packageId, nextVersionNumber, newPrice, status, new Date(effectiveFrom), note]
      );

      // Mettre à jour le prix actuel et le numéro de version actif sur packages
      const updatedPkgRes = await client.query(
        `UPDATE packages SET
          active_version_number = $1,
          price = $2,
          current_price = $2,
          status = $3,
          updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [nextVersionNumber, newPrice, status, packageId]
      );

      await client.query('COMMIT');

      const versionsRes = await pool.query(
        `SELECT * FROM package_versions WHERE package_id = $1 ORDER BY version_number ASC`,
        [packageId]
      );
      const versions = versionsRes.rows.map(this.mapRowToVersion);
      return this.mapRowToPackage(updatedPkgRes.rows[0], versions);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async deletePackage(id: string): Promise<void> {
    const insCheck = await pool.query(`SELECT COUNT(*) as count FROM inscriptions WHERE package_id = $1`, [id]);
    if (parseInt(insCheck.rows[0].count, 10) > 0) {
      throw new Error('Impossible de supprimer un package lié à des inscriptions existantes.');
    }
    await pool.query(`DELETE FROM package_versions WHERE package_id = $1`, [id]);
    await pool.query(`DELETE FROM packages WHERE id = $1`, [id]);
  }

  private mapRowToPackage(r: any, versions: PackageVersion[]): VoyagePackage {
    return {
      id: r.id,
      voyageId: r.campaign_id,
      code: r.code,
      name: r.name,
      category: r.category,
      description: r.description || '',
      price: Number(r.price),
      initialPrice: Number(r.initial_price),
      currentPrice: Number(r.current_price),
      currency: r.currency,
      capacity: r.capacity || 0,
      roomType: r.room_type || 'QUADRUPLE',
      hotelMakkah: r.hotel_makkah || '',
      hotelMedina: r.hotel_medina || '',
      conditions: r.conditions || '',
      servicesIncluded: r.services_included || [],
      status: r.status,
      validFrom: r.valid_from ? new Date(r.valid_from).toISOString().split('T')[0] : '',
      activeVersionNumber: r.active_version_number,
      versions,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }

  private mapRowToVersion(r: any): PackageVersion {
    return {
      id: r.id,
      packageId: r.package_id,
      versionNumber: r.version_number,
      price: Number(r.price),
      status: r.status,
      effectiveFrom: r.effective_from ? new Date(r.effective_from).toISOString().split('T')[0] : '',
      effectiveTo: r.effective_to ? new Date(r.effective_to).toISOString().split('T')[0] : undefined,
      note: r.note || '',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    };
  }
}

export const packageRepository = new PackageRepository();
