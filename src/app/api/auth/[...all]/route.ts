import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/lib/auth';

// Better Auth endpoints: Google OAuth, sessions, sign-out, and the TV device flow (/device/*).
export const { GET, POST } = toNextJsHandler(auth);
