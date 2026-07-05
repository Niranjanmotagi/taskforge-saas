/**
 * Fractional ordering keys ("lexorank"-style) for drag-and-drop positioning.
 * Keys are base-36 strings ordered lexicographically; a new key can always be
 * generated strictly between two existing keys without re-indexing siblings.
 *
 * Invariant: generated keys never end in '0', which guarantees a midpoint
 * always exists between any two generated keys.
 */

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = ALPHABET.length;

function charIndex(c: string): number {
  const idx = ALPHABET.indexOf(c);
  if (idx === -1) throw new Error(`Invalid rank character: "${c}"`);
  return idx;
}

/** Generate a key strictly between `before` and `after` (null = unbounded). */
export function rankBetween(before: string | null, after: string | null): string {
  const a = before ?? '';
  const b = after ?? '';
  if (b !== '' && a >= b) {
    throw new Error(`rankBetween: "${a}" must be strictly less than "${b}"`);
  }

  let result = '';
  let upperUnbounded = b === '';
  let i = 0;

  // Walk positions until a midpoint digit exists.
  for (;;) {
    const ca = i < a.length ? charIndex(a[i]) : 0;
    let cb: number;
    if (upperUnbounded) {
      cb = BASE;
    } else if (i < b.length) {
      cb = charIndex(b[i]);
    } else {
      // b exhausted while equal so far => b is a prefix of a => a >= b (guarded above),
      // or a non-generator key ending in '0' was supplied.
      throw new Error(`rankBetween: no space between "${a}" and "${b}"`);
    }

    if (cb - ca > 1) {
      // Midpoint digit exists at this position; it is > 0 because cb - ca > 1.
      result += ALPHABET[Math.floor((ca + cb) / 2)];
      return result;
    }

    // Equal or adjacent digits: copy lower digit and continue one level deeper.
    result += ALPHABET[ca];
    i += 1;
    if (cb === ca + 1) {
      // Anything extending `result` now sorts below b; only the lower bound matters.
      upperUnbounded = true;
    }
  }
}

/** First key for an empty list. */
export function initialRank(): string {
  return rankBetween(null, null);
}

/** Generate `count` ascending keys (for seeding ordered lists). */
export function seedRanks(count: number): string[] {
  const ranks: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < count; i += 1) {
    prev = rankBetween(prev, null);
    ranks.push(prev);
  }
  return ranks;
}
