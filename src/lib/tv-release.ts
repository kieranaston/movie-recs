/**
 * Finds the latest signed TV APK published by .github/workflows/android-release.yml.
 * The repo is private, so this uses a read-only GitHub token (server-side only) and returns
 * GitHub's short-lived signed download URL — the token itself never reaches the client.
 */
export const APK_ASSET = 'movie-recs-tv.apk';

export async function latestApkUrl(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const token = process.env.GITHUB_RELEASES_TOKEN;
  const repo = process.env.GITHUB_RELEASES_REPO ?? 'kieranaston/movie-recs';
  if (!token) return null;

  const headers = { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'movie-recs' };
  const release = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, {
    headers: { ...headers, Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });
  if (!release.ok) return null;

  const { assets = [] } = (await release.json()) as { assets?: { name: string; url: string }[] };
  const asset = assets.find((a) => a.name === APK_ASSET);
  if (!asset) return null;

  // Asking for the binary makes GitHub answer with a redirect to a signed, expiring URL.
  const download = await fetchImpl(asset.url, {
    headers: { ...headers, Accept: 'application/octet-stream' },
    redirect: 'manual',
    cache: 'no-store',
  });
  const location = download.headers.get('location');
  return download.status >= 300 && download.status < 400 && location?.startsWith('https://') ? location : null;
}
