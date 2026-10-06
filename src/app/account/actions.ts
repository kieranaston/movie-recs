'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { auth, getViewer } from '@/lib/auth';

/** Sign one of the viewer's devices out. Looks the session up by id so tokens never reach the browser. */
export async function revokeDevice(sessionId: string) {
  if (!(await getViewer())) throw new Error('Unauthorized');
  const h = await headers();
  const sessions = await auth.api.listSessions({ headers: h });
  const target = sessions.find((s) => s.id === sessionId);
  if (!target) return; // not this user's session (or already gone)
  await auth.api.revokeSession({ body: { token: target.token }, headers: h });
  revalidatePath('/account');
}
