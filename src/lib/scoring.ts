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
export const RECENT_MAX_AGE = 5;

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

/** Bayesian weighted rating. */
export function wr(avg: number, votes: number): number {
  return (votes / (votes + M)) * avg + (M / (votes + M)) * C;
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
  if (wr(m.voteAverage, m.voteCount) < GATE_WR) return false;
  return true;
}

// --- cult gate: relaxed, age-aware. Admits mid-rated canon with a following. ---
export const CULT_VOTES = 100;
export const CULT_MIN_AGE = 10;

/** Older films get a lower quality floor (cult status accrues over time). */
export function cultWrFloor(age: number): number {
  if (age < 15) return 6.4;
  if (age < 30) return 6.0;
  return 5.8;
}

export function passesCultGate(m: Scorable): boolean {
  if (m.voteAverage == null || m.voteCount == null) return false;
  if (m.voteCount < CULT_VOTES) return false;
  const age = ageOf(m.releaseDate);
  if (age == null || age < CULT_MIN_AGE) return false;
  if (wr(m.voteAverage, m.voteCount) < cultWrFloor(age)) return false;
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
