import crypto from "crypto";
import { pool } from "../db/neon.js";
import { createSignedSessionToken } from "./token.service.js";
import { userRepository } from "../repositories/user.repository.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import { UserSession } from "../../src/types.js";

const auditRepo = new AuditRepository();

export interface GoogleUserInfo {
  id: string; // Google sub
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
  refresh_token?: string;
}

export interface GoogleAuthResult {
  user: UserSession;
  token: string;
  redirectPath: string;
}

export class GoogleOAuthService {
  /**
   * Vérifie si Google OAuth est activé et configuré
   */
  public isConfigured(): boolean {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    return Boolean(clientId && clientId.trim() && clientSecret && clientSecret.trim());
  }

  public getClientId(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error("GOOGLE_CLIENT_ID n'est pas configuré dans les variables d'environnement.");
    }
    return clientId.trim();
  }

  public getClientSecret(): string {
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientSecret) {
      throw new Error("GOOGLE_CLIENT_SECRET n'est pas configuré dans les variables d'environnement.");
    }
    return clientSecret.trim();
  }

  /**
   * Génère l'URL de redirection vers Google OAuth Consent Screen
   */
  public generateAuthUrl(redirectUri: string, state: string): string {
    const clientId = this.getClientId();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    url.searchParams.set("access_type", "online");
    return url.toString();
  }

  /**
   * Échange le code d'autorisation contre le token Google et récupère le profil
   */
  public async exchangeCodeAndGetUserInfo(code: string, redirectUri: string): Promise<GoogleUserInfo> {
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();

    // 1. Échange du code d'autorisation
    const tokenParams = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: tokenParams.toString(),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error("[GoogleOAuth] Échec échange token:", errorText);
      throw new Error("Impossible de valider le jeton Google auprès des serveurs d'authentification.");
    }

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error("Jeton d'accès Google manquant dans la réponse.");
    }

    // 2. Récupération des informations utilisateur via l'endpoint UserInfo officiel
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!userInfoRes.ok) {
      const errorText = await userInfoRes.text();
      console.error("[GoogleOAuth] Échec lecture userinfo:", errorText);
      throw new Error("Impossible de récupérer le profil utilisateur depuis Google.");
    }

    const rawUser = (await userInfoRes.json()) as any;

    return {
      id: rawUser.sub,
      email: rawUser.email,
      emailVerified: Boolean(rawUser.email_verified),
      name: rawUser.name,
      givenName: rawUser.given_name,
      familyName: rawUser.family_name,
      picture: rawUser.picture,
    };
  }

  /**
   * Résolution d'identité dans Neon Cloud :
   * 1. Google authentifie, mais Neon autorise !
   * 2. Si l'utilisateur existe dans users -> charge et signe le jeton Taiba.
   * 3. Si l'utilisateur existe dans clients (pèlerin réel) -> rattachement dynamique PELERIN.
   * 4. Sinon -> Rejet strict (COMPTE_NON_AUTORISE). Zéro création de SUPER_ADMIN sauvage.
   */
  public async authenticateWithGoogleUser(googleUser: GoogleUserInfo): Promise<GoogleAuthResult> {
    if (!googleUser.email || !googleUser.emailVerified) {
      throw new Error("Adresse e-mail Google non vérifiée ou inaccessible.");
    }

    const cleanEmail = googleUser.email.trim().toLowerCase();

    // 1. Recherche dans la table users
    const userRes = await pool.query(
      `SELECT id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [cleanEmail]
    );

    if (userRes.rows.length > 0) {
      const row = userRes.rows[0];

      // Vérification du statut
      if (!row.active || row.status !== "ACTIF") {
        await auditRepo.logAudit({
          actorUserId: row.id,
          actorUserName: row.display_name || cleanEmail,
          action: "AUTH_GOOGLE_BLOCKED_INACTIVE",
          entityType: "USER",
          entityId: row.id,
          reason: "Tentative de connexion Google sur un compte inactif ou désactivé",
          metadata: { email: cleanEmail, status: row.status, active: row.active },
        });
        throw new Error("Ce compte utilisateur est inactif ou désactivé. Veuillez contacter la direction.");
      }

      // Mise à jour de la dernière connexion
      await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [row.id]);

      const rawName = (row.display_name || "").trim();
      const nameParts = rawName ? rawName.split(" ") : [];

      const session: UserSession = {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        firstName: nameParts[0] || (row.email ? row.email.split("@")[0] : "Utilisateur"),
        lastName: nameParts.slice(1).join(" ") || "",
        role: row.role_id,
        phone: row.phone || undefined,
        clientId: row.client_id || undefined,
        allowedInscriptionIds: row.allowed_inscription_ids || undefined,
        active: row.active,
      };

      session.accessibleClientIds = await userRepository.getAccessibleClientIds(row.id);

      // Traçabilité audit
      await auditRepo.logAudit({
        actorUserId: session.id,
        actorUserName: session.displayName || session.email,
        action: "AUTH_GOOGLE_SUCCESS",
        entityType: "USER",
        entityId: session.id,
        metadata: {
          email: cleanEmail,
          role: session.role,
          provider: "google",
          googleSub: googleUser.id,
        },
      });

      const token = createSignedSessionToken(session);
      const isPilgrim = session.role === "PELERIN" || session.role === "PILGRIM";
      const redirectPath = isPilgrim ? "/portail" : "/erp";

      return {
        user: session,
        token,
        redirectPath,
      };
    }

    // 2. Recherche de repli dans la table clients (pèlerin réel déjà enregistré)
    const clientRes = await pool.query(
      `SELECT id, code, first_name, last_name, email, phone, status, is_test
       FROM clients
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [cleanEmail]
    );

    if (clientRes.rows.length > 0) {
      const client = clientRes.rows[0];
      const userId = `usr-google-pelerin-${client.id}`;
      const displayName = `${client.first_name || ""} ${client.last_name || ""}`.trim() || googleUser.name || cleanEmail;
      const randomPasswordHash = crypto.randomBytes(32).toString("hex");

      // Création du compte pèlerin (strictement PELERIN, jamais de promotion SUPER_ADMIN)
      await pool.query(
        `INSERT INTO users (
          id, email, display_name, phone, password_hash, role_id, status, active, client_id, created_at, updated_at, last_login_at
        ) VALUES ($1, $2, $3, $4, $5, 'PELERIN', 'ACTIF', TRUE, $6, NOW(), NOW(), NOW())
        ON CONFLICT (email) DO UPDATE SET
          client_id = EXCLUDED.client_id,
          active = TRUE,
          status = 'ACTIF',
          last_login_at = NOW(),
          updated_at = NOW()
        RETURNING id, email, display_name, phone, role_id, status, active, client_id, allowed_inscription_ids`,
        [userId, cleanEmail, displayName, client.phone, randomPasswordHash, client.id]
      );

      // Attribution du rôle PELERIN
      await pool.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, 'PELERIN') ON CONFLICT DO NOTHING`,
        [userId]
      );

      // Attribution des accès client
      await userRepository.grantClientAccess({
        userId,
        clientId: client.id,
        relationshipType: "TITULAIRE",
        canView: true,
        canPay: true,
        canUploadDocs: true,
      });

      const session: UserSession = {
        id: userId,
        email: cleanEmail,
        displayName,
        firstName: client.first_name,
        lastName: client.last_name,
        role: "PELERIN",
        phone: client.phone,
        clientId: client.id,
        active: true,
      };

      session.accessibleClientIds = await userRepository.getAccessibleClientIds(userId);

      // Traçabilité audit
      await auditRepo.logAudit({
        actorUserId: userId,
        actorUserName: displayName,
        action: "AUTH_GOOGLE_PILGRIM_ATTACHED",
        entityType: "USER",
        entityId: userId,
        reason: `Compte pèlerin créé et rattaché au client officiel ${client.code} via Google OAuth`,
        metadata: {
          email: cleanEmail,
          clientId: client.id,
          clientCode: client.code,
          googleSub: googleUser.id,
        },
      });

      const token = createSignedSessionToken(session);

      return {
        user: session,
        token,
        redirectPath: "/portail",
      };
    }

    // 3. Ni dans users ni dans clients -> ACCÈS REFUSÉ
    await auditRepo.logAudit({
      actorUserId: "system",
      actorUserName: "Visiteur Google Inconnu",
      action: "AUTH_GOOGLE_REJECTED",
      entityType: "SECURITY",
      entityId: cleanEmail,
      reason: "Tentative de connexion Google OAuth non autorisée : email absent du référentiel Neon",
      metadata: {
        email: cleanEmail,
        googleName: googleUser.name,
        googleSub: googleUser.id,
      },
    });

    const error = new Error(
      `Votre adresse Google (${cleanEmail}) n'est pas autorisée sur la plateforme GIE TAIBA VOYAGES. Veuillez contacter le secrétariat ou la direction.`
    );
    (error as any).code = "COMPTE_NON_AUTORISE";
    throw error;
  }
}

export const googleOAuthService = new GoogleOAuthService();
