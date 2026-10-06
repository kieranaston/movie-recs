import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { legacyWatchlist, user, userWatchlist } from '@/db/schema';

/**
 * One-time migration: copy the pre-accounts single watchlist into the account for `email`.
 * Idempotent (titles already on that watchlist are skipped). Returns the number of legacy rows.
 */
export async function claimLegacyWatchlist(email: string): Promise<number> {
  const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, email.trim().toLowerCase())).limit(1);
  if (!owner) throw new Error(`No account for ${email} — sign in on the website once first.`);

  const legacy = await db.select().from(legacyWatchlist);
  if (legacy.length) {
    await db
      .insert(userWatchlist)
      .values(legacy.map(({ tmdbId, title, posterPath, releaseDate, voteAverage, addedAt }) => ({
        userId: owner.id, tmdbId, title, posterPath, releaseDate, voteAverage, addedAt,
      })))
      .onConflictDoNothing({ target: [userWatchlist.userId, userWatchlist.tmdbId] });
  }
  return legacy.length;
}
