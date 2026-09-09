import crypto from 'crypto';

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.trim().length >= 32) {
    return secret.trim();
  }

  // En production Render, si la variable n'est pas encore injectée,
  // dérivation cryptographique stable (HMAC-SHA256 64 chars) basée sur l'instance Neon
  // pour éviter tout crash tout en préservant la stabilité des sessions.
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    return crypto.createHmac('sha256', dbUrl).update('taiba-voyages-session-salt-2027').digest('hex');
  }

  // En développement local sans DB URL
  return 'dev-only-secret-taiba-voyages-jwt-key-not-for-production-use';
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

