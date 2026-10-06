/**
 * Only allow same-site relative paths as post-sign-in destinations.
 * Rejects absolute URLs, protocol-relative `//host`, and `/\host` (browsers treat `\` like `/`).
 */
export function safeNext(next: unknown, fallback = '/'): string {
  return typeof next === 'string' && /^\/(?![/\\])[^\\]*$/.test(next) ? next : fallback;
}
