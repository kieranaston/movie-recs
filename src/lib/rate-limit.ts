import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { apiRateLimit } from '@/db/schema';

/**
 * Fixed-window rate limiter backed by Postgres, so limits hold across serverless instances.
 * Returns true if this request is within `max` requests per `windowMs` for `key`.
 */
export async function allowRequest(key: string, max: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const [row] = await db
    .insert(apiRateLimit)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: apiRateLimit.key,
      set: {
        count: sql`case when ${apiRateLimit.windowStart} = excluded.window_start then ${apiRateLimit.count} + 1 else 1 end`,
        windowStart: sql`excluded.window_start`,
      },
    })
    .returning({ count: apiRateLimit.count });
  return row.count <= max;
}
