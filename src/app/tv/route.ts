export const dynamic = 'force-dynamic';

/**
 * GET /tv → the Android TV APK, served from /public. A short URL to type into the TV's Downloader app
 * (e.g. `movie-recs-tawny.vercel.app/tv`). Public on purpose: the APK contains no secrets, and installing
 * it only points at this site.
 */
export function GET(request: Request) {
  return Response.redirect(new URL('/movie-recs-tv.apk', request.url), 307);
}
