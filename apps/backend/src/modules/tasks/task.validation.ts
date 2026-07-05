import { z } from 'zod';
import {
  CustomFieldType,
  DependencyType,
  RecurrenceFrequency,
  TaskPriority,
  TaskStatusCategory,
} from '@taskforge/shared-types';
import { paginationSchema } from '@/utils/pagination';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: z.string().max(50_000).optional(),
  columnId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  estimatedMinutes: z.number().int().positive().max(60 * 1000).optional(),
  storyPoints: z.number().int().min(0).max(100).optional(),
  assigneeIds: z.array(z.string().uuid()).max(20).optional(),
  labelIds: z.array(z.string().uuid()).max(20).optional(),
  /** Insert position; defaults to end of column. */
  beforeTaskId: z.string().uuid().optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().max(50_000).nullable().optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
    sprintId: z.string().uuid().nullable().optional(),
    startDate: z.coerce.date().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    estimatedMinutes: z.number().int().positive().max(60 * 1000).nullable().optional(),
    storyPoints: z.number().int().min(0).max(100).nullable().optional(),
    assigneeIds: z.array(z.string().uuid()).max(20).optional(),
    labelIds: z.array(z.string().uuid()).max(20).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const moveTaskSchema = z.object({
  columnId: z.string().uuid(),
  /** Neighbouring task ids at the drop location (either may be absent). */
  beforeTaskId: z.string().uuid().optional(),
  afterTaskId: z.string().uuid().optional(),
});

export const listTasksQuerySchema = paginationSchema.extend({
  projectId: z.string().uuid().optional(),
  columnId: z.string().uuid().optional(),
  sprintId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  statusCategory: z.nativeEnum(TaskStatusCategory).optional(),
  priority: z.nativeEnum(TaskPriority).optional(),
  assigneeId: z.string().uuid().optional(),
  labelId: z.string().uuid().optional(),
  search: z.string().trim().max(200).optional(),
  dueBefore: z.coerce.date().optional(),
  dueAfter: z.coerce.date().optional(),
  includeSubtasks: z.coerce.boolean().optional().default(false),
  overdue: z.coerce.boolean().optional(),
});

export const taskIdParam = z.object({
  workspaceId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export const projectScopedParam = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export const checklistCreateSchema = z.object({
  title: z.string().trim().min(1).max(300),
});

export const checklistUpdateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  isCompleted: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export const dependencyCreateSchema = z.object({
  dependsOnTaskId: z.string().uuid(),
  type: z.nativeEnum(DependencyType).default(DependencyType.BLOCKED_BY),
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export const commentCreateSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(10_000),
  parentId: z.string().uuid().optional(),
});

export const commentUpdateSchema = z.object({
  body: z.string().trim().min(1).max(10_000),
});

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const labelCreateSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: hexColor.optional(),
});

export const labelUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    color: hexColor.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

// ---------------------------------------------------------------------------
// Board columns
// ---------------------------------------------------------------------------

export const columnCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  category: z.nativeEnum(TaskStatusCategory),
  color: hexColor.optional(),
  wipLimit: z.number().int().positive().max(999).nullable().optional(),
});

export const columnUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    category: z.nativeEnum(TaskStatusCategory).optional(),
    color: hexColor.optional(),
    wipLimit: z.number().int().positive().max(999).nullable().optional(),
    position: z.number().int().min(0).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

export const recurrenceSchema = z.object({
  frequency: z.nativeEnum(RecurrenceFrequency),
  interval: z.number().int().min(1).max(52).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  endsAt: z.coerce.date().optional(),
});

// ---------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------

export const customFieldCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  type: z.nativeEnum(CustomFieldType),
  options: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
  isRequired: z.boolean().optional().default(false),
  projectId: z.string().uuid().optional(),
});

export const customFieldValueSchema = z.object({
  fieldId: z.string().uuid(),
  value: z.unknown(),
});
