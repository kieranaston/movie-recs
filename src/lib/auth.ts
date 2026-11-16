import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * One-owner auth. `SITE_PASSWORD` is the only secret; the login token is an HMAC of it, so the password
 * itself is never stored in a cookie or on the TV. Reading is open; every write needs the token
 * (website: httpOnly cookie, TV app: `Authorization: Bearer`). With no password set, writes are refused.
 */
export const AUTH_COOKIE = 'owner';

/** The token that proves you know the password, or null when no password is configured. */
export function ownerToken(): string | null {
  const password = process.env.SITE_PASSWORD;
  if (!password) return null;
  return createHmac('sha256', password).update('movie-recs-owner').digest('hex');
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** True if the submitted password is the right one. */
export function passwordMatches(input: string): boolean {
  const password = process.env.SITE_PASSWORD;
  return !!password && same(input, password);
}

export function tokenValid(candidate: string | null | undefined): boolean {
  const expected = ownerToken();
  return !!expected && !!candidate && same(candidate, expected);
}

/** True if a request carries the owner token as a bearer header or the login cookie. */
export function requestIsOwner(request: Request): boolean {
  const bearer = /^Bearer (.+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
  if (tokenValid(bearer)) return true;
  const cookie = request.headers.get('cookie') ?? '';
  const value = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${AUTH_COOKIE}=`));
  return tokenValid(value?.slice(AUTH_COOKIE.length + 1));
}
