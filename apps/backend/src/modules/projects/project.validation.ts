import { z } from 'zod';
import { ProjectHealth, ProjectStatus } from '@taskforge/shared-types';
import { paginationSchema } from '@/utils/pagination';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a hex value like #6366f1');

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, 'Project name is required').max(100),
  key: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9]{1,5}$/, 'Key must be 2-6 uppercase letters/digits')
    .optional(),
  description: z.string().trim().max(2000).optional(),
  color: hexColor.optional(),
  icon: z.string().max(50).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  budgetCents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  clientName: z.string().trim().max(120).optional(),
  clientEmail: z.string().trim().email().optional(),
  clientPhone: z.string().trim().max(30).optional(),
  leadId: z.string().uuid().optional(),
  isTemplate: z.boolean().optional(),
  /** Instantiate from a template/existing project. */
  templateId: z.string().uuid().optional(),
  memberIds: z.array(z.string().uuid()).max(100).optional(),
});

export const updateProjectSchema = createProjectSchema
  .omit({ templateId: true })
  .partial()
  .extend({
    health: z.nativeEnum(ProjectHealth).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startDate: z.coerce.date().nullable().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    budgetCents: z.number().int().nonnegative().nullable().optional(),
    leadId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const listProjectsQuerySchema = paginationSchema.extend({
  status: z.nativeEnum(ProjectStatus).optional(),
  search: z.string().trim().max(100).optional(),
  favorites: z.coerce.boolean().optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
  templates: z.coerce.boolean().optional(),
});

export const projectIdParam = z.object({
  workspaceId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export const duplicateProjectSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  includeTasks: z.boolean().optional().default(true),
});
