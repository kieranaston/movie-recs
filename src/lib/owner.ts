import { cookies } from 'next/headers';
import { AUTH_COOKIE, tokenValid } from './auth';

/** For server components and server actions: is the current visitor the owner? */
export async function isOwner(): Promise<boolean> {
  return tokenValid((await cookies()).get(AUTH_COOKIE)?.value);
}

/** Throws unless the visitor is signed in. Call first in every server action that writes. */
export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) throw new Error('Not signed in');
}
