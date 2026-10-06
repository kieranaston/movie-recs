import { requireUser, toApiCard } from '@/lib/api';
import { getWatchlist } from '@/lib/watchlist';

/** GET /api/v1/watchlist → the signed-in user's { movies }, newest first. */
export async function GET(request: Request) {
  const viewer = await requireUser(request);
  if (viewer instanceof Response) return viewer;

  const items = await getWatchlist(viewer.id);
  return Response.json({ movies: items.map(toApiCard) });
}
