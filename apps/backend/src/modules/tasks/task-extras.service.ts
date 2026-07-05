import type { Prisma } from '@prisma/client';
import { CustomFieldType, DependencyType, RecurrenceFrequency } from '@taskforge/shared-types';
import { addDays, addMonths } from '@taskforge/shared-utils';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';

async function assertTask(workspaceId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: null },
    select: { id: true, projectId: true, dueDate: true },
  });
  if (!task) throw ApiError.notFound('Task');
  return task;
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

export async function addChecklistItem(workspaceId: string, taskId: string, title: string) {
  await assertTask(workspaceId, taskId);
  const last = await prisma.checklistItem.findFirst({
    where: { taskId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return prisma.checklistItem.create({
    data: { taskId, title, position: (last?.position ?? -1) + 1 },
  });
}

export async function updateChecklistItem(
  workspaceId: string,
  taskId: string,
  itemId: string,
  input: { title?: string; isCompleted?: boolean; position?: number }
) {
  await assertTask(workspaceId, taskId);
  const item = await prisma.checklistItem.findFirst({ where: { id: itemId, taskId } });
  if (!item) throw ApiError.notFound('Checklist item');
  return prisma.checklistItem.update({ where: { id: itemId }, data: input });
}

export async function deleteChecklistItem(workspaceId: string, taskId: string, itemId: string): Promise<void> {
  await assertTask(workspaceId, taskId);
  const result = await prisma.checklistItem.deleteMany({ where: { id: itemId, taskId } });
  if (result.count === 0) throw ApiError.notFound('Checklist item');
}

// ---------------------------------------------------------------------------
// Workspace labels
// ---------------------------------------------------------------------------

export async function listLabels(workspaceId: string) {
  return prisma.label.findMany({
    where: { workspaceId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { tasks: true } } },
  });
}

export async function createLabel(workspaceId: string, input: { name: string; color?: string }) {
  const existing = await prisma.label.findUnique({
    where: { workspaceId_name: { workspaceId, name: input.name } },
  });
  if (existing) throw ApiError.conflict('A label with this name already exists');
  return prisma.label.create({
    data: { workspaceId, name: input.name, color: input.color ?? '#6366f1' },
  });
}

export async function updateLabel(
  workspaceId: string,
  labelId: string,
  input: { name?: string; color?: string }
) {
  const label = await prisma.label.findFirst({ where: { id: labelId, workspaceId } });
  if (!label) throw ApiError.notFound('Label');
  return prisma.label.update({ where: { id: labelId }, data: input });
}

export async function deleteLabel(workspaceId: string, labelId: string): Promise<void> {
  const result = await prisma.label.deleteMany({ where: { id: labelId, workspaceId } });
  if (result.count === 0) throw ApiError.notFound('Label');
}

// ---------------------------------------------------------------------------
// Dependencies (with cycle detection)
// ---------------------------------------------------------------------------

/**
 * DFS over blocking edges: adding "task depends on target" creates a cycle
 * iff target (transitively) depends on task.
 */
async function wouldCreateCycle(taskId: string, dependsOnTaskId: string): Promise<boolean> {
  const visited = new Set<string>();
  const stack = [dependsOnTaskId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const edges = await prisma.taskDependency.findMany({
      where: { taskId: current, type: { in: ['BLOCKED_BY', 'BLOCKS'] } },
      select: { dependsOnTaskId: true },
    });
    stack.push(...edges.map((e) => e.dependsOnTaskId));
  }
  return false;
}

export async function addDependency(
  workspaceId: string,
  taskId: string,
  input: { dependsOnTaskId: string; type: DependencyType }
) {
  if (taskId === input.dependsOnTaskId) {
    throw ApiError.badRequest('A task cannot depend on itself');
  }
  const [task, target] = await Promise.all([
    assertTask(workspaceId, taskId),
    assertTask(workspaceId, input.dependsOnTaskId),
  ]);
  if (task.projectId !== target.projectId) {
    throw ApiError.badRequest('Dependencies must stay within one project');
  }

  if (
    (input.type === 'BLOCKED_BY' || input.type === 'BLOCKS') &&
    (await wouldCreateCycle(taskId, input.dependsOnTaskId))
  ) {
    throw ApiError.conflict('This dependency would create a cycle');
  }

  return prisma.taskDependency.create({
    data: { taskId, dependsOnTaskId: input.dependsOnTaskId, type: input.type },
    include: {
      dependsOnTask: {
        select: { id: true, title: true, number: true, statusCategory: true, project: { select: { key: true } } },
      },
    },
  });
}

export async function removeDependency(workspaceId: string, taskId: string, dependencyId: string): Promise<void> {
  await assertTask(workspaceId, taskId);
  const result = await prisma.taskDependency.deleteMany({ where: { id: dependencyId, taskId } });
  if (result.count === 0) throw ApiError.notFound('Dependency');
}

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

export async function toggleWatcher(workspaceId: string, taskId: string, userId: string) {
  await assertTask(workspaceId, taskId);
  const existing = await prisma.taskWatcher.findUnique({
    where: { taskId_userId: { taskId, userId } },
  });
  if (existing) {
    await prisma.taskWatcher.delete({ where: { id: existing.id } });
    return { watching: false };
  }
  await prisma.taskWatcher.create({ data: { taskId, userId } });
  return { watching: true };
}

// ---------------------------------------------------------------------------
// Recurrence
// ---------------------------------------------------------------------------

export function computeNextRun(
  from: Date,
  frequency: RecurrenceFrequency,
  interval: number,
  daysOfWeek: number[] = []
): Date {
  switch (frequency) {
    case RecurrenceFrequency.DAILY:
      return addDays(from, interval);
    case RecurrenceFrequency.WEEKLY: {
      if (daysOfWeek.length === 0) return addDays(from, 7 * interval);
      // Next selected weekday after `from`.
      for (let i = 1; i <= 7 * interval; i += 1) {
        const candidate = addDays(from, i);
        if (daysOfWeek.includes(candidate.getDay())) return candidate;
      }
      return addDays(from, 7 * interval);
    }
    case RecurrenceFrequency.BIWEEKLY:
      return addDays(from, 14 * interval);
    case RecurrenceFrequency.MONTHLY:
      return addMonths(from, interval);
    case RecurrenceFrequency.QUARTERLY:
      return addMonths(from, 3 * interval);
    case RecurrenceFrequency.YEARLY:
      return addMonths(from, 12 * interval);
    default:
      return addDays(from, interval);
  }
}

export async function setRecurrence(
  workspaceId: string,
  taskId: string,
  input: { frequency: RecurrenceFrequency; interval: number; daysOfWeek?: number[]; endsAt?: Date }
) {
  await assertTask(workspaceId, taskId);
  const nextRunAt = computeNextRun(new Date(), input.frequency, input.interval, input.daysOfWeek);
  return prisma.taskRecurrence.upsert({
    where: { taskId },
    create: {
      taskId,
      frequency: input.frequency,
      interval: input.interval,
      daysOfWeek: input.daysOfWeek ?? [],
      endsAt: input.endsAt,
      nextRunAt,
    },
    update: {
      frequency: input.frequency,
      interval: input.interval,
      daysOfWeek: input.daysOfWeek ?? [],
      endsAt: input.endsAt ?? null,
      nextRunAt,
      isActive: true,
    },
  });
}

export async function removeRecurrence(workspaceId: string, taskId: string): Promise<void> {
  await assertTask(workspaceId, taskId);
  await prisma.taskRecurrence.deleteMany({ where: { taskId } });
}

// ---------------------------------------------------------------------------
// Custom fields
// ---------------------------------------------------------------------------

export async function listCustomFields(workspaceId: string, projectId?: string) {
  return prisma.customField.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}),
    },
    orderBy: { position: 'asc' },
  });
}

export async function createCustomField(
  workspaceId: string,
  input: { name: string; type: CustomFieldType; options?: string[]; isRequired?: boolean; projectId?: string }
) {
  if ((input.type === 'SELECT' || input.type === 'MULTI_SELECT') && !input.options?.length) {
    throw ApiError.badRequest('SELECT fields require at least one option');
  }
  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!project) throw ApiError.notFound('Project');
  }
  return prisma.customField.create({
    data: {
      workspaceId,
      projectId: input.projectId,
      name: input.name,
      type: input.type,
      options: input.options ?? [],
      isRequired: input.isRequired ?? false,
    },
  });
}

export async function deleteCustomField(workspaceId: string, fieldId: string): Promise<void> {
  const result = await prisma.customField.updateMany({
    where: { id: fieldId, workspaceId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) throw ApiError.notFound('Custom field');
}

function validateFieldValue(type: CustomFieldType, options: string[], value: unknown): Prisma.InputJsonValue {
  const fail = (msg: string) => {
    throw ApiError.badRequest(msg);
  };
  switch (type) {
    case CustomFieldType.TEXT:
      if (typeof value !== 'string' || value.length > 5000) fail('Expected text value');
      break;
    case CustomFieldType.NUMBER:
      if (typeof value !== 'number' || !Number.isFinite(value)) fail('Expected number value');
      break;
    case CustomFieldType.DATE:
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail('Expected ISO date value');
      break;
    case CustomFieldType.CHECKBOX:
      if (typeof value !== 'boolean') fail('Expected boolean value');
      break;
    case CustomFieldType.SELECT:
      if (typeof value !== 'string' || !options.includes(value)) fail('Value must be one of the field options');
      break;
    case CustomFieldType.MULTI_SELECT:
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !options.includes(v))) {
        fail('Values must come from the field options');
      }
      break;
    case CustomFieldType.URL:
      try {
        new URL(String(value));
      } catch {
        fail('Expected a valid URL');
      }
      break;
    case CustomFieldType.EMAIL:
      if (typeof value !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) fail('Expected a valid email');
      break;
    case CustomFieldType.USER:
      if (typeof value !== 'string') fail('Expected a user id');
      break;
  }
  return value as Prisma.InputJsonValue;
}

export async function setCustomFieldValue(
  workspaceId: string,
  taskId: string,
  input: { fieldId: string; value: unknown }
) {
  const task = await assertTask(workspaceId, taskId);
  const field = await prisma.customField.findFirst({
    where: { id: input.fieldId, workspaceId, deletedAt: null },
  });
  if (!field) throw ApiError.notFound('Custom field');
  if (field.projectId && field.projectId !== task.projectId) {
    throw ApiError.badRequest('This field is not available on this project');
  }

  if (input.value === null || input.value === undefined) {
    await prisma.customFieldValue.deleteMany({ where: { fieldId: field.id, taskId } });
    return null;
  }

  const value = validateFieldValue(field.type as CustomFieldType, field.options, input.value);
  return prisma.customFieldValue.upsert({
    where: { fieldId_taskId: { fieldId: field.id, taskId } },
    create: { fieldId: field.id, taskId, value },
    update: { value },
    include: { field: true },
  });
}
