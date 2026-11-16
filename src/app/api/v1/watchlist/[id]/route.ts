import { error, guard, parseId } from '@/lib/api';
import { requestIsOwner } from '@/lib/auth';
import { addToWatchlist, removeFromWatchlist } from '@/lib/watchlist';

type Ctx = RouteContext<'/api/v1/watchlist/[id]'>;

/** PUT /api/v1/watchlist/<tmdbId> — idempotent add. 204, or 404 if not a real movie. */
export async function PUT(request: Request, ctx: Ctx) {
  const denied = await guard(request);
  if (denied) return denied;
  if (!requestIsOwner(request)) return error(401, 'Sign in required');

  const tmdbId = parseId((await ctx.params).id);
  if (!tmdbId || !(await addToWatchlist(tmdbId))) return error(404, 'Not found');
  return new Response(null, { status: 204 });
}

/** DELETE /api/v1/watchlist/<tmdbId> — idempotent remove. 204. */
export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await guard(request);
  if (denied) return denied;
  if (!requestIsOwner(request)) return error(401, 'Sign in required');

  const tmdbId = parseId((await ctx.params).id);
  if (!tmdbId) return error(404, 'Not found');
  await removeFromWatchlist(tmdbId);
  return new Response(null, { status: 204 });
}
