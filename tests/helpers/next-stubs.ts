/** Minimal stand-ins for Next.js request APIs so server code runs under Vitest. */
export const nextCache = {
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  revalidatePath: () => {},
  revalidateTag: () => {},
};
