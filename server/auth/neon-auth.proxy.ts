import { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { handleAuthProxyRequest, parseSetCookies, serializeSetCookie } from '@neondatabase/auth/server';

/**
 * Lit le flux brut de la requête Express si le body n'a pas encore été consommé.
 */
async function getRawBody(req: ExpressRequest): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;

  // Si express.json() est passé avant (à éviter), req.body est déjà un objet parsé.
  if (req.body && Object.keys(req.body).length > 0 && !Buffer.isBuffer(req.body)) {
    return Buffer.from(JSON.stringify(req.body));
  }
  
  // Sinon, on lit le flux réseau brut
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/**
 * Proxy Middleware vers Neon Auth Server.
 * Traduit la requête Express en Standard Web API Request, et inversement pour la réponse.
 */
export const neonAuthProxyMiddleware = async (req: ExpressRequest, res: ExpressResponse, next: any): Promise<void> => {
  // Ignorer les routes locales spécifiques à notre backend GIE TAIBA
  const LOCAL_AUTH_ROUTES = [
    '/api/auth/me',
    '/api/auth/neon-me',
    '/api/auth/logout',
    '/api/auth/users',
  ];
  if (LOCAL_AUTH_ROUTES.includes(req.path)) {
    return next();
  }

  try {
    const neonAuthUrl = process.env.NEON_AUTH_URL;
    const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

    if (!neonAuthUrl || !cookieSecret) {
      res.status(500).json({ error: 'NEON_AUTH_URL ou NEON_AUTH_COOKIE_SECRET manquant.' });
      return;
    }

    const host = req.get('host') || 'localhost';
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    // URL exacte appelée par le client (gietaiba.onrender.com/api/auth/...)
    const fullUrl = new URL(req.originalUrl || req.url, `${protocol}://${host}`);

    // Extraction du "path" relatif pour handleAuthProxyRequest (ex: 'sign-in/social')
    // Le routeur va appeler ça avec req.params[0] si monté en '/api/auth/*'
    let authPath = req.params[0] || '';
    if (!authPath && req.originalUrl) {
       // Fallback
       authPath = req.originalUrl.replace(/^\/api\/auth\/?/, '');
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else if (value !== undefined) {
        headers.set(key, value);
      }
    }

    const bodyBuffer = await getRawBody(req);

    const webRequest = new Request(fullUrl.href, {
      method: req.method,
      headers,
      body: bodyBuffer,
      // duplex: 'half' est souvent requis par Node 18+ quand on fournit un ReadableStream, mais avec un Buffer, non requis.
    });

    const webResponse = await handleAuthProxyRequest({
      request: webRequest,
      path: authPath,
      baseUrl: neonAuthUrl,
      cookieSecret: cookieSecret,
      sameSite: 'lax', // Requis pour OAuth redirects
      // domain: Si on laisse vide, le navigateur l'associe au domaine appelant (parfait pour gietaiba.onrender.com)
    });

    // Traduction de la réponse Web API -> Express
    webResponse.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'set-cookie') {
        // Le Headers.forEach combine les cookies avec ", " ce qui pose problème.
        // On récupère les cookies originaux via webResponse.headers.getSetCookie() si dispo.
        const setCookies = typeof webResponse.headers.getSetCookie === 'function' 
          ? webResponse.headers.getSetCookie() 
          : parseSetCookies(value).map(c => serializeSetCookie(c));
        
        res.setHeader('Set-Cookie', setCookies);
      } else {
        res.setHeader(key, value);
      }
    });

    res.status(webResponse.status);
    
    // Renvoyer le body
    const responseBody = await webResponse.text();
    res.send(responseBody);

  } catch (error: any) {
    console.error('[Neon Auth Proxy Error]', error);
    res.status(500).json({ error: 'Proxy Request Failed', details: error.message });
  }
};
