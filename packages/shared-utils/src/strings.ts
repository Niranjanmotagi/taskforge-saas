/** Convert arbitrary text into a URL-safe slug. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Derive a short uppercase project key from a name, e.g. "Mobile App" -> "MA". */
export function deriveProjectKey(name: string, maxLen = 5): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const key =
    words.length >= 2
      ? words.map((w) => w[0]).join('')
      : name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4);
  return key.toUpperCase().slice(0, maxLen) || 'PRJ';
}

/** Extract initials for avatar fallbacks. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Extract @mentions (returns usernames without the @). */
export function extractMentions(text: string): string[] {
  const matches = text.match(/@\[([^\]]+)\]\(([0-9a-f-]{36})\)/g) ?? [];
  return [...new Set(matches.map((m) => m.replace(/^@\[[^\]]+\]\(/, '').replace(/\)$/, '')))];
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(0, max - 1))}…`;
}
