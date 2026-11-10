import { guard, toApiCard } from '@/lib/api';
import { getWatchlist } from '@/lib/watchlist';

/** GET /api/v1/watchlist → { movies }, newest first. */
export async function GET(request: Request) {
  const denied = await guard(request);
  if (denied) return denied;

  const items = await getWatchlist();
  return Response.json({ movies: items.map(toApiCard) });
}
