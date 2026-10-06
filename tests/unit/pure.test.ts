import { describe, expect, it } from 'vitest';
import { isAllowedEmail, parseAllowlist } from '@/lib/allowlist';
import { safeNext } from '@/lib/safe-redirect';
import { describeDevice } from '@/app/account/devices';

describe('allowlist', () => {
  it('parses a comma-separated, case-insensitive list', () => {
    expect([...parseAllowlist(' A@x.com, b@Y.com ,,')]).toEqual(['a@x.com', 'b@y.com']);
  });
  it('admits listed emails regardless of case or whitespace', () => {
    expect(isAllowedEmail('ALICE@example.com ', 'alice@example.com')).toBe(true);
  });
  it('fails closed', () => {
    expect(isAllowedEmail('alice@example.com', '')).toBe(false);
    expect(isAllowedEmail(null, 'alice@example.com')).toBe(false);
    expect(isAllowedEmail('mallory@example.com', 'alice@example.com')).toBe(false);
  });
  it('does not match on substrings', () => {
    expect(isAllowedEmail('alice@example.com.evil.com', 'alice@example.com')).toBe(false);
  });
});

describe('safeNext', () => {
  it.each(['/', '/watchlist', '/activate?user_code=ABCD1234', '/genre/action?filter=Pixar'])('allows %s', (p) => {
    expect(safeNext(p)).toBe(p);
  });
  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '', 'watchlist', '/a\\b', undefined, 42])(
    'rejects %s',
    (p) => expect(safeNext(p)).toBe('/')
  );
});

describe('describeDevice', () => {
  it('labels the TV app with its model', () => {
    expect(describeDevice('MovieRecsTV/1.0 (Chromecast)')).toEqual({ label: 'TV · Chromecast', isTv: true });
  });
  it('labels common browsers', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
    expect(describeDevice(mac).label).toBe('Safari on macOS');
    const chromeAndroid = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
    expect(describeDevice(chromeAndroid).label).toBe('Chrome on Android');
  });
  it('handles missing user agents', () => {
    expect(describeDevice(null).label).toBe('Unknown device');
  });
});
