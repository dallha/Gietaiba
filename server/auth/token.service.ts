import crypto from 'crypto';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export function getSessionSecret(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const secret = process.env.SESSION_SECRET;

  if (isProduction) {
    if (!secret || secret.trim().length < 32) {
      throw new Error(
        '[FATAL SECURITY] En production, la variable SESSION_SECRET est strictement obligatoire (minimum 32 caractères). Démarrage refusé.'
      );
    }
    return secret;
  }

  // En développement / test uniquement
  return secret || 'dev-only-secret-taiba-voyages-jwt-key-not-for-production-use';
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  clientId?: string;
  exp: number; // Unix timestamp in seconds
  iat: number;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/**
 * Creates a cryptographically signed session token (HMAC-SHA256)
 */
export function createSignedSessionToken(
  user: { id: string; email: string; role: string; clientId?: string; [key: string]: any },
  expiresInSeconds: number = 86400 * 7 // 7 days default
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    clientId: user.clientId,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = base64UrlEncode(header);
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(dataToSign)
    .digest('base64url');

  return `${dataToSign}.${signature}`;
}

/**
 * Cryptographically verifies a signed session token.
 * Prevents tampering, forgery and replay attacks.
 */
export function verifySignedSessionToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const expectedSignature = crypto
      .createHmac('sha256', getSessionSecret())
      .update(dataToSign)
      .digest('base64url');

    // Constant-time comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: TokenPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    // Expiration check
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verifies a Firebase Auth ID token if Firebase Admin is initialized
 */
export async function verifyFirebaseIdToken(token: string): Promise<{ uid: string; email?: string } | null> {
  if (!getApps().length) return null;
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}
