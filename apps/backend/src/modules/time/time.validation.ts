import { z } from 'zod';
import { paginationSchema } from '@/utils/pagination';

export const startTimerSchema = z.object({
  taskId: z.string().uuid(),
  description: z.string().trim().max(500).optional(),
  isBillable: z.boolean().optional().default(false),
  hourlyRateCents: z.number().int().positive().optional(),
});

export const manualEntrySchema = z
  .object({
    taskId: z.string().uuid(),
    description: z.string().trim().max(500).optional(),
    startedAt: z.coerce.date(),
    endedAt: z.coerce.date(),
    isBillable: z.boolean().optional().default(false),
    hourlyRateCents: z.number().int().positive().optional(),
  })
  .refine((v) => v.startedAt < v.endedAt, {
    message: 'End time must be after start time',
    path: ['endedAt'],
  });

export const listEntriesQuerySchema = paginationSchema.extend({
  taskId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  billableOnly: z.coerce.boolean().optional(),
});

export const entryIdParam = z.object({
  workspaceId: z.string().uuid(),
  entryId: z.string().uuid(),
});
