import { afterEach, describe, expect, it, vi } from 'vitest';
import { latestApkUrl } from '@/lib/tv-release';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

afterEach(() => {
  delete process.env.GITHUB_RELEASES_TOKEN;
});

describe('latestApkUrl', () => {
  it('is unavailable without a token (and makes no requests)', async () => {
    const fetchImpl = vi.fn();
    expect(await latestApkUrl(fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns GitHub’s signed download URL for the APK asset', async () => {
    process.env.GITHUB_RELEASES_TOKEN = 'ghp_test';
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ assets: [
        { name: 'movie-recs-tv.apk.sha256', url: 'https://api.github.com/assets/1' },
        { name: 'movie-recs-tv.apk', url: 'https://api.github.com/assets/2' },
      ] }))
      .mockResolvedValueOnce(redirect('https://release-assets.githubusercontent.com/signed?sig=abc'));

    expect(await latestApkUrl(fetchImpl)).toBe('https://release-assets.githubusercontent.com/signed?sig=abc');
    expect(fetchImpl).toHaveBeenNthCalledWith(1, 'https://api.github.com/repos/kieranaston/movie-recs/releases/latest', expect.anything());
    const [assetUrl, init] = fetchImpl.mock.calls[1];
    expect(assetUrl).toBe('https://api.github.com/assets/2');
    expect(init.headers).toMatchObject({ Accept: 'application/octet-stream', Authorization: 'Bearer ghp_test' });
    expect(init.redirect).toBe('manual'); // the token must not follow the redirect to the storage host
  });

  it.each([
    ['no release yet', [json({ message: 'Not Found' }, 404)]],
    ['no APK in the release', [json({ assets: [{ name: 'notes.txt', url: 'u' }] })]],
    ['a non-https redirect', [json({ assets: [{ name: 'movie-recs-tv.apk', url: 'u' }] }), redirect('http://insecure.example/apk')]],
  ])('returns null for %s', async (_, responses) => {
    process.env.GITHUB_RELEASES_TOKEN = 'ghp_test';
    const fetchImpl = vi.fn();
    for (const r of responses) fetchImpl.mockResolvedValueOnce(r);
    expect(await latestApkUrl(fetchImpl)).toBeNull();
  });
});
