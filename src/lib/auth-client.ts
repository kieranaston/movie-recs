import { createAuthClient } from 'better-auth/react';
import { deviceAuthorizationClient } from 'better-auth/client/plugins';

/** Browser-side auth client (same-origin; talks to /api/auth). */
export const authClient = createAuthClient({ plugins: [deviceAuthorizationClient()] });
