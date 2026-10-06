/**
 * Minimal stand-ins for Next.js request APIs so server code runs under Vitest.
 * Tests set `request.headers` to act as a given client (e.g. a bearer token).
 */
export const request = { headers: new Headers() };

const jar = new Map<string, string>();

export const nextHeaders = {
  headers: async () => request.headers,
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    has: (name: string) => jar.has(name),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
};

export const nextCache = {
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  revalidatePath: () => {},
  revalidateTag: () => {},
};

export function actAs(token: string | null) {
  request.headers = new Headers(token ? { authorization: `Bearer ${token}` } : {});
}
