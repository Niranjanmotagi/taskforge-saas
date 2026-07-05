import { initialRank, rankBetween, seedRanks } from './lexorank';

describe('lexorank', () => {
  it('generates an initial rank', () => {
    const r = initialRank();
    expect(r.length).toBeGreaterThan(0);
    expect(r.endsWith('0')).toBe(false);
  });

  it('generates a key between two keys', () => {
    const a = 'i';
    const b = 'r';
    const mid = rankBetween(a, b);
    expect(mid > a).toBe(true);
    expect(mid < b).toBe(true);
  });

  it('handles unbounded ends', () => {
    const first = initialRank();
    const before = rankBetween(null, first);
    const after = rankBetween(first, null);
    expect(before < first).toBe(true);
    expect(after > first).toBe(true);
  });

  it('never produces keys ending in 0 under repeated midpoint insertion', () => {
    let lo = initialRank();
    let hi = rankBetween(lo, null);
    for (let i = 0; i < 200; i += 1) {
      const mid = rankBetween(lo, hi);
      expect(mid > lo).toBe(true);
      expect(mid < hi).toBe(true);
      expect(mid.endsWith('0')).toBe(false);
      // squeeze from alternating sides to stress adjacent-digit descent
      if (i % 2 === 0) lo = mid;
      else hi = mid;
    }
  });

  it('survives repeated prepends and appends', () => {
    let first = initialRank();
    let last = first;
    for (let i = 0; i < 100; i += 1) {
      const newFirst = rankBetween(null, first);
      expect(newFirst < first).toBe(true);
      first = newFirst;
      const newLast = rankBetween(last, null);
      expect(newLast > last).toBe(true);
      last = newLast;
    }
  });

  it('seeds monotonically increasing ranks', () => {
    const ranks = seedRanks(50);
    for (let i = 1; i < ranks.length; i += 1) {
      expect(ranks[i] > ranks[i - 1]).toBe(true);
    }
  });

  it('rejects inverted bounds', () => {
    expect(() => rankBetween('r', 'i')).toThrow();
    expect(() => rankBetween('i', 'i')).toThrow();
  });
});
