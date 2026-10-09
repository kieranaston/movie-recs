/**
 * Scoring — the validated math from aspects #1–#3.
 *
 * quality  : Bayesian weighted rating (C, m)
 * settled  : WR minus a vote-count confidence penalty (kills recency inflation)
 * obscurity: band around an age-relative vote target (surfaces underseen gems)
 */

// --- aspect #1: quality prior ---
export const C = 7.0;
export const M = 300;

// --- aspect #2: obscurity band ---
export const BAND_SIGMA = 1.1;
export const BAND_K = 0.5; // 0 = fixed target, 1 = pure era-relative
export const BAND_T_ABS = 2000;

// --- aspect #3: global gate + lens params ---
export const GATE_WR = 6.8;
export const GATE_VOTES = 200;

export const CLASSIC_MIN_AGE = 25;
/** "Recent" = released within this many months. */
export const RECENT_MAX_MONTHS = 36;

/** Nothing older than this shows anywhere (viewing preference). */
export const MIN_YEAR = 1970;

export const SETTLE_A = 0.8;
export const SETTLE_V0 = 2000;

export interface Scorable {
  voteAverage: number | null;
  voteCount: number | null;
  releaseDate: string | null;
}

export const currentYear = (): number => new Date().getFullYear();

export function yearOf(releaseDate: string | null): number | null {
  if (!releaseDate) return null;
  const y = parseInt(releaseDate.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function ageOf(releaseDate: string | null): number | null {
  const y = yearOf(releaseDate);
  return y == null ? null : currentYear() - y;
}

/** Within the viewer's year preference (MIN_YEAR onward). */
export function yearInRange(releaseDate: string | null): boolean {
  const y = yearOf(releaseDate);
  return y != null && y >= MIN_YEAR;
}

// --- new releases: early votes skew high (fans vote first), so young films get a stronger prior. ---
export const NEW_RELEASE_MONTHS = 18;
export const NEW_RELEASE_PRIOR_BOOST = 4; // prior weight is (1 + 4)× M at release, easing to 1× at 18 months

/** Whole months since release (negative for unreleased), or null if unknown. */
export function monthsSince(releaseDate: string | null, now: Date = new Date()): number | null {
  if (!releaseDate) return null;
  const d = new Date(`${releaseDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + (now.getUTCMonth() - d.getUTCMonth());
}

/** Prior weight (in votes) pulling a rating toward C: M, boosted while a film is new. */
export function priorWeight(releaseDate: string | null | undefined, now: Date = new Date()): number {
  const months = releaseDate ? monthsSince(releaseDate, now) : null;
  if (months == null || months >= NEW_RELEASE_MONTHS) return M;
  const freshness = 1 - Math.max(months, 0) / NEW_RELEASE_MONTHS; // 1 at release → 0 at 18 months
  return M * (1 + NEW_RELEASE_PRIOR_BOOST * freshness);
}

const shrink = (avg: number, votes: number, m: number) => (votes / (votes + m)) * avg + (m / (votes + m)) * C;

/**
 * Bayesian weighted rating. Pass the release date so new releases get the stronger prior — which may
 * only lower a rating (tempering early fan scores), never lift a weak new film toward C.
 */
export function wr(avg: number, votes: number, releaseDate?: string | null, now?: Date): number {
  const standard = shrink(avg, votes, M);
  const m = priorWeight(releaseDate, now);
  return m === M ? standard : Math.min(standard, shrink(avg, votes, m));
}

/** WR with a vote-count confidence penalty — used by consensus lenses. */
export function settled(wrVal: number, votes: number): number {
  const conf = votes / (votes + SETTLE_V0);
  return wrVal - SETTLE_A * (1 - conf);
}

/** Age-relative band target: geometric blend of fixed + era median. */
export function eraTarget(eraMedian: number): number {
  return Math.pow(BAND_T_ABS, 1 - BAND_K) * Math.pow(eraMedian, BAND_K);
}

/** Obscurity factor in [0,1], peaks when votes == target. */
export function obscurity(votes: number, target: number): number {
  const z = Math.log(votes) - Math.log(target);
  return Math.exp(-(z * z) / (2 * BAND_SIGMA * BAND_SIGMA));
}

/** Does the film clear the global gate? (TMDB-only) */
export function passesGate(m: Scorable): boolean {
  if (m.voteAverage == null || m.voteCount == null) return false;
  if (m.voteCount < GATE_VOTES) return false;
  if (wr(m.voteAverage, m.voteCount, m.releaseDate) < GATE_WR) return false;
  return true;
}

// Age buckets used to derive era medians from the catalog.
export const AGE_BUCKETS: [number, number][] = [
  [0, 2], [3, 5], [6, 10], [11, 20], [21, 40], [41, 200],
];

/** Median vote count per age bucket among gate-passing films. */
export function computeEraMedians(rows: { age: number; votes: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const [lo, hi] of AGE_BUCKETS) {
    const vs = rows.filter((r) => r.age >= lo && r.age <= hi).map((r) => r.votes).sort((a, b) => a - b);
    if (!vs.length) continue;
    const mid = Math.floor(vs.length / 2);
    out.set(`${lo}-${hi}`, vs.length % 2 ? vs[mid] : (vs[mid - 1] + vs[mid]) / 2);
  }
  return out;
}

export function medianForAge(medians: Map<string, number>, age: number): number {
  for (const [lo, hi] of AGE_BUCKETS) {
    if (age >= lo && age <= hi) {
      const v = medians.get(`${lo}-${hi}`);
      if (v) return v;
    }
  }
  const vals = [...medians.values()];
  return vals.length ? vals[vals.length - 1] : BAND_T_ABS;
}
