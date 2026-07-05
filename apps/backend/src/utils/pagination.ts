import { z } from 'zod';

/** Reusable pagination + sorting query schema. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function toSkipTake(p: Pagination): { skip: number; take: number } {
  return { skip: (p.page - 1) * p.limit, take: p.limit };
}

/** Build a Prisma orderBy from pagination input, allow-listing sortable fields. */
export function toOrderBy(
  p: Pagination,
  allowed: string[],
  fallback: string = 'createdAt'
): Record<string, 'asc' | 'desc'> {
  const field = p.sortBy && allowed.includes(p.sortBy) ? p.sortBy : fallback;
  return { [field]: p.sortOrder };
}
