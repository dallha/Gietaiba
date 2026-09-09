import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

const authUrl = import.meta.env.VITE_NEON_AUTH_URL || '';

export const neonAuthClient = createAuthClient(authUrl, {
  adapter: BetterAuthReactAdapter(),
});
