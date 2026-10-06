import { allowRequest } from '@/lib/rate-limit';
import { latestApkUrl } from '@/lib/tv-release';

export const dynamic = 'force-dynamic';

/**
 * GET /tv → the latest Android TV APK (type this URL into the TV's Downloader app).
 * Public on purpose: the APK contains no secrets, and using it still requires an allowlisted account.
 */
export async function GET(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!(await allowRequest(`apk:${ip}`, 30, 60 * 60 * 1000))) {
    return new Response('Too many requests', { status: 429 });
  }

  const url = await latestApkUrl().catch(() => null);
  if (!url) return new Response('The TV app is not available right now.', { status: 503 });

  return new Response(null, {
    status: 302,
    headers: { Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}
