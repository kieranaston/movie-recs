/** A readable label for a session's user agent, e.g. "TV · Chromecast" or "Chrome on macOS". */
export function describeDevice(userAgent: string | null | undefined): { label: string; isTv: boolean } {
  const ua = userAgent ?? '';
  const tv = ua.match(/MovieRecsTV\/[\d.]+ \(([^)]*)\)/);
  if (tv) return { label: `TV · ${tv[1] || 'Android TV'}`, isTv: true };
  if (ua.startsWith('MovieRecsTV')) return { label: 'TV', isTv: true };

  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null;
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : null;
  if (browser && os) return { label: `${browser} on ${os}`, isTv: false };
  return { label: browser ?? os ?? 'Unknown device', isTv: false };
}
