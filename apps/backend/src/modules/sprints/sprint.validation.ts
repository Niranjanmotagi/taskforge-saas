import { z } from 'zod';
import { SprintStatus } from '@taskforge/shared-types';

export const createSprintSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    goal: z.string().trim().max(1000).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((v) => v.startDate < v.endDate, {
    message: 'Sprint end date must be after start date',
    path: ['endDate'],
  });

export const updateSprintSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    goal: z.string().trim().max(1000).nullable().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    status: z.nativeEnum(SprintStatus).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const completeSprintSchema = z.object({
  /** Where unfinished tasks go: another sprint id or backlog (null). */
  moveOpenTasksToSprintId: z.string().uuid().nullable().optional(),
});

export const sprintIdParam = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid(),
  sprintId: z.string().uuid(),
});

export const assignTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(200),
});
