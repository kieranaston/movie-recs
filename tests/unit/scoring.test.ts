import { describe, expect, it } from 'vitest';
import { C, M, NEW_RELEASE_MONTHS, monthsSince, priorWeight, wr } from '@/lib/scoring';

const now = new Date('2026-10-01T00:00:00Z');

describe('new-release prior', () => {
  it('counts whole months since release', () => {
    expect(monthsSince('2026-08-15', now)).toBe(2);
    expect(monthsSince('2025-10-01', now)).toBe(12);
    expect(monthsSince('2026-12-01', now)).toBe(-2); // not out yet
    expect(monthsSince(null, now)).toBeNull();
  });

  it('is five times stronger at release and fades to normal by 18 months', () => {
    expect(priorWeight('2026-10-01', now)).toBe(5 * M);
    expect(priorWeight('2026-01-01', now)).toBeCloseTo(M * (1 + 4 * (1 - 9 / NEW_RELEASE_MONTHS)));
    expect(priorWeight('2025-04-01', now)).toBe(M); // 18 months
    expect(priorWeight('1999-03-31', now)).toBe(M);
    expect(priorWeight(null, now)).toBe(M);
  });

  it('tempers early fan scores without touching established films', () => {
    // e.g. a 2-month-old release at ★9.1 from 1,260 votes
    const fresh = wr(9.1, 1260, '2026-08-01', now);
    const sameAsOld = wr(9.1, 1260, '2010-08-01', now);
    expect(fresh).toBeLessThan(sameAsOld - 0.5);
    expect(fresh).toBeGreaterThan(C);
    // an established classic is unchanged
    expect(wr(8.7, 27_000, '1994-09-23', now)).toBeCloseTo((27_000 / (27_000 + M)) * 8.7 + (M / (27_000 + M)) * C);
  });

  it('only ever lowers a rating — a weak new film is not lifted toward the average', () => {
    expect(wr(6.0, 400, '2026-09-01', now)).toBeCloseTo(wr(6.0, 400, '2005-09-01', now));
  });

  it('ranks an inflated new release below an established favourite until enough votes arrive', () => {
    const fanFavouriteNew = wr(9.1, 1260, '2026-08-01', now); // ★9.1 from 1,260 early votes
    const establishedGreat = wr(8.5, 20_000, '2008-07-16', now); // ★8.5 from 20,000 votes
    expect(fanFavouriteNew).toBeLessThan(establishedGreat);
    // …but once it has years of votes behind it, it can rank on its own merits.
    expect(wr(9.1, 1260, '2020-08-01', now)).toBeGreaterThan(establishedGreat);
  });
});
