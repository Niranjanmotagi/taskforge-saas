/**
 * Non-CSS design tokens shared across the product (chart palettes, avatar
 * colors, priority/status color mapping). CSS-level tokens live in tokens.css.
 */

export const CHART_PALETTE = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#84cc16', // lime
] as const;

export const AVATAR_COLORS = [
  '#f97316',
  '#f59e0b',
  '#84cc16',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#d946ef',
  '#ec4899',
] as const;

export const PRIORITY_COLORS: Record<string, string> = {
  URGENT: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#3b82f6',
  NONE: '#94a3b8',
};

export const STATUS_CATEGORY_COLORS: Record<string, string> = {
  BACKLOG: '#94a3b8',
  TODO: '#64748b',
  IN_PROGRESS: '#3b82f6',
  REVIEW: '#8b5cf6',
  TESTING: '#f59e0b',
  DONE: '#10b981',
};

export const PROJECT_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#64748b',
] as const;

/** Deterministically pick a color for an id (avatars, cursors). */
export function colorForId(id: string, palette: readonly string[] = AVATAR_COLORS): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}
