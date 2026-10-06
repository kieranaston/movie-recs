import { describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/tv/route';

vi.mock('@/lib/tv-release', () => ({ latestApkUrl: vi.fn() }));
const { latestApkUrl } = await import('@/lib/tv-release');

const req = (ip = '203.0.113.7') => new Request('http://localhost:3000/tv', { headers: { 'x-forwarded-for': ip } });

describe('GET /tv', () => {
  it('redirects to the latest APK without caching', async () => {
    vi.mocked(latestApkUrl).mockResolvedValue('https://release-assets.githubusercontent.com/signed');
    const res = await GET(req());
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://release-assets.githubusercontent.com/signed');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('says so when no release is available', async () => {
    vi.mocked(latestApkUrl).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(503);
  });

  it('rate-limits each address', async () => {
    vi.mocked(latestApkUrl).mockResolvedValue('https://x/signed');
    for (let i = 0; i < 30; i++) expect((await GET(req('198.51.100.1'))).status).toBe(302);
    expect((await GET(req('198.51.100.1'))).status).toBe(429);
    expect((await GET(req('198.51.100.2'))).status).toBe(302);
  });
});
