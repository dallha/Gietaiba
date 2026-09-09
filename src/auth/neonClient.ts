import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

const envUrl = import.meta.env.VITE_NEON_AUTH_URL || '';
// Le SDK Better Auth utilise `new URL()` en interne, ce qui crashe sur les chemins relatifs ("/api/auth").
// On s'assure donc de construire dynamiquement l'URL absolue basée sur le domaine courant.
const authUrl = envUrl.startsWith('http') 
  ? envUrl 
  : `${window.location.origin}${envUrl || '/api/auth'}`;

export const neonAuthClient = createAuthClient(authUrl, {
  adapter: BetterAuthReactAdapter(),
});
