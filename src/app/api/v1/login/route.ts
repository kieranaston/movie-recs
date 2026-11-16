import { error, guard } from '@/lib/api';
import { ownerToken, passwordMatches } from '@/lib/auth';
import { allowRequest } from '@/lib/rate-limit';

/** POST /api/v1/login {password} — returns {token} to send as `Authorization: Bearer` on writes. */
export async function POST(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!(await allowRequest(`login:${ip}`, 10, 15 * 60_000))) return error(429, 'Too many attempts');

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const token = ownerToken();
  if (!token || typeof body?.password !== 'string' || !passwordMatches(body.password)) return error(401, 'Wrong password');
  return Response.json({ token });
}
