/**
 * GIE TAIBA VOYAGES — Service Worker Sécurisé (PWA)
 * 
 * Stratégie de mise en cache conforme aux exigences strictes de sécurité :
 * - HTML / Navigations (index.html) → NETWORK FIRST (Déploiements Render immédiats)
 * - Bundles JS, CSS, Polices, Images → CACHE CONTRÔLÉ (Stale-While-Revalidate)
 * - /api/*, Authentification, Sessions, Documents → NETWORK ONLY STRICT (0 cache, 0 persistance)
 * 
 * Invariant de sécurité : Aucune donnée financière, session ou réponse API n'entre dans CacheStorage.
 */

const CACHE_NAME = 'taiba-shell-v1';

const STATIC_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
];

// Installation : Mise en cache de la coquille applicative minimale
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activation : Nettoyage immédiat des anciens caches obsolètes
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interception des requêtes
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 1. Uniquement les requêtes GET sont éligibles
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 2. RÈGLE CRITIQUE DE SÉCURITÉ : Network Only strict pour API & Auth
  // Ne jamais mettre en cache les routes API, auth, tokens, sessions ou documents sensibles
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/auth') ||
    url.pathname.includes('neonauth') ||
    url.pathname.includes('/documents/')
  ) {
    // Laisser passer directement sur le réseau sans toucher au CacheStorage
    return;
  }

  // 3. HTML & Navigations : NETWORK FIRST
  // Permet de voir immédiatement les nouvelles versions après déploiement Render.
  // En cas de perte de connexion réseau, bascule sur la coquille index.html en cache.
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match('/index.html');
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response(
            `<!DOCTYPE html>
            <html lang="fr">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>GIE TAIBA VOYAGES — Hors Connexion</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; text-align: center; }
                  .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
                  h1 { color: #f59e0b; font-size: 20px; margin-bottom: 12px; }
                  p { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
                  button { background: #d97706; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>Connexion Interrompue</h1>
                  <p>La connexion au serveur GIE TAIBA VOYAGES est indisponible. Reconnexion automatique dès le retour du réseau.</p>
                  <button onclick="window.location.reload()">Réessayer</button>
                </div>
              </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 4. Assets statiques (JS, CSS, Polices, Images locales) : Stale-While-Revalidate
  if (
    url.origin === self.origin &&
    (url.pathname.startsWith('/assets/') ||
      url.pathname.endsWith('.js') ||
      url.pathname.endsWith('.css') ||
      url.pathname.endsWith('.svg') ||
      url.pathname.endsWith('.png') ||
      url.pathname.endsWith('.woff2'))
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            // S'assurer qu'aucune URL api ne rentre ici
            if (!url.pathname.startsWith('/api/')) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
          }
          return networkResponse;
        }).catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});
