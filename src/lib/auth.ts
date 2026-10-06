import { cache } from 'react';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { bearer, deviceAuthorization } from 'better-auth/plugins';
import { db } from '@/db';
import * as schema from '@/db/schema';
import { isAllowedEmail } from './allowlist';

/**
 * Accounts: Google sign-in for allowlisted emails (Better Auth, sessions in Postgres).
 * - Website: httpOnly session cookie.
 * - Android TV: RFC 8628 device flow — the TV shows a code/QR, you approve it at /activate,
 *   and the TV receives its own revocable session token, sent as `Authorization: Bearer …`.
 */

/** The only client allowed to start a device sign-in. */
export const TV_CLIENT_ID = 'movie-recs-tv';

const isProd = process.env.NODE_ENV === 'production';

export const auth = betterAuth({
  appName: 'Movie Recs',
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      deviceCode: schema.deviceCode,
      rateLimit: schema.rateLimit,
    },
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      prompt: 'select_account',
    },
  },
  user: {
    // Runs on account creation, linking and every Google sign-in (with the fresh Google profile).
    validateUserInfo: ({ user }) =>
      isAllowedEmail(user.email) && user.emailVerified !== false
        ? undefined
        : { error: 'not_allowed', errorDescription: 'This Google account is not on the invite list.' },
  },
  databaseHooks: {
    session: {
      create: {
        // Covers sessions not created by a Google sign-in (e.g. a TV approval) after removal from the list.
        before: async (s) => {
          const [owner] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, s.userId)).limit(1);
          if (!isAllowedEmail(owner?.email)) throw new APIError('FORBIDDEN', { message: 'Not allowed' });
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days…
    updateAge: 60 * 60 * 24, // …sliding: renewed at most daily while in use
  },
  rateLimit: {
    enabled: true,
    storage: 'database', // shared across serverless instances
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/social': { window: 60, max: 10 },
      '/device/code': { window: 60, max: 10 },
      '/device/token': { window: 60, max: 30 },
      '/device/approve': { window: 60, max: 10 },
      '/device/deny': { window: 60, max: 10 },
    },
  },
  advanced: {
    // Explicit, so CSRF/origin protection is on in every environment (Better Auth relaxes it under NODE_ENV=test).
    disableOriginCheck: false,
    disableCSRFCheck: false,
    useSecureCookies: isProd,
    ipAddress: { ipAddressHeaders: ['x-forwarded-for'] }, // set by Vercel's edge
  },
  onAPIError: { errorURL: '/login' },
  plugins: [
    deviceAuthorization({
      expiresIn: '10m',
      interval: '5s',
      verificationUri: '/activate',
      validateClient: (clientId) => clientId === TV_CLIENT_ID,
    }),
    bearer(),
    nextCookies(), // must stay last
  ],
});

export interface Viewer {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

/** The signed-in, still-allowlisted user for these headers (session cookie or bearer token), or null. */
export async function viewerFromHeaders(h: Headers): Promise<Viewer | null> {
  const result = await auth.api.getSession({ headers: h });
  if (!result || !isAllowedEmail(result.user.email)) return null;
  const { id, email, name, image } = result.user;
  return { id, email, name, image: image ?? null };
}

/** Viewer for the current server request (pages, layouts, server actions). Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => viewerFromHeaders(await headers()));
