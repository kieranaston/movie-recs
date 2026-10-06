/**
 * One-time migration: copy the pre-accounts watchlist (table `watchlist`) into a user's account.
 * The user must have signed in at least once. Safe to re-run.
 *
 * Usage:
 *   DATABASE_URL=… npm run watchlist:claim -- you@example.com
 */
import { claimLegacyWatchlist } from '../src/lib/legacy-watchlist';

const email = process.argv[2];
if (!email || !process.env.DATABASE_URL) {
  console.error('Usage: DATABASE_URL=… npm run watchlist:claim -- you@example.com');
  process.exit(1);
}

claimLegacyWatchlist(email)
  .then((n) => {
    console.log(`Copied ${n} title(s) into ${email}'s watchlist.`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
