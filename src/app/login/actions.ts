'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_COOKIE, ownerToken, passwordMatches } from '@/lib/auth';
import { allowRequest } from '@/lib/rate-limit';

export async function login(_prev: string | null, formData: FormData): Promise<string | null> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!(await allowRequest(`login:${ip}`, 10, 15 * 60_000))) return 'Too many attempts. Try again later.';

  const token = ownerToken();
  if (!token || !passwordMatches(String(formData.get('password') ?? ''))) return 'Wrong password.';

  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect('/');
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect('/');
}
