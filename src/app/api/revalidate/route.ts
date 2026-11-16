import { revalidateTag } from 'next/cache';
import { error } from '@/lib/api';
import { requestIsOwner } from '@/lib/auth';

/** POST /api/revalidate — marks the cached catalog stale. The weekly ingest calls it so new data shows at once. */
export async function POST(request: Request) {
  if (!requestIsOwner(request)) return error(401, 'Sign in required');
  revalidateTag('catalog', 'max');
  return Response.json({ revalidated: true });
}
