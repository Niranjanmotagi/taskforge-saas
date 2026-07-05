import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { completeJson } from '@/lib/anthropic';
import { ApiError } from '@/utils/api-error';
import { assertAiCreditsAvailable } from '@/services/plan-limits.service';

/**
 * Every AI feature: (1) checks plan credits, (2) gathers scoped context,
 * (3) prompts Claude for strict JSON, (4) validates with Zod, (5) burns a credit.
 */

async function consumeCredit(workspaceId: string): Promise<void> {
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { aiCreditsUsed: { increment: 1 } },
  });
}

async function withCredit<T>(workspaceId: string, fn: () => Promise<T>): Promise<T> {
  await assertAiCreditsAvailable(workspaceId);
  const result = await fn();
  await consumeCredit(workspaceId);
  return result;
}

async function getProjectContext(workspaceId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId, deletedAt: null },
    select: {
      id: true,
      name: true,
      description: true,
      startDate: true,
      dueDate: true,
      status: true,
      tasks: {
        where: { deletedAt: null },
        select: {
          title: true,
          statusCategory: true,
          priority: true,
          dueDate: true,
          estimatedMinutes: true,
          storyPoints: true,
          completedAt: true,
          assignees: { select: { user: { select: { name: true } } } },
        },
        take: 150,
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
  if (!project) throw ApiError.notFound('Project');
  return project;
}

// ---------------------------------------------------------------------------
// 1. Task generator
// ---------------------------------------------------------------------------

const generatedTasksSchema = z.object({
  tasks: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        description: z.string().max(2000).optional(),
        priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']),
        estimatedMinutes: z.number().int().positive().max(60000).optional(),
        subtasks: z.array(z.string().min(1).max(300)).max(10).optional(),
      })
    )
    .min(1)
    .max(20),
});

export async function generateTasks(workspaceId: string, projectId: string, prompt: string) {
  return withCredit(workspaceId, async () => {
    const project = await getProjectContext(workspaceId, projectId);
    const raw = await completeJson(
      `You are a senior project manager breaking down work into actionable tasks.
Return JSON: {"tasks":[{"title","description?","priority":"URGENT|HIGH|MEDIUM|LOW|NONE","estimatedMinutes?","subtasks?":["..."]}]}
Generate 3-12 well-scoped tasks. Titles are imperative and specific.`,
      `Project: ${project.name}\nProject description: ${project.description ?? 'n/a'}\n\nFeature/goal to break down:\n${prompt}`
    );
    const parsed = generatedTasksSchema.safeParse(raw);
    if (!parsed.success) throw ApiError.internal('AI returned an unexpected structure');
    return parsed.data;
  });
}

// ---------------------------------------------------------------------------
// 2. Sprint planner
// ---------------------------------------------------------------------------

const sprintPlanSchema = z.object({
  sprintGoal: z.string().max(500),
  rationale: z.string().max(2000),
  taskTitles: z.array(z.string()).max(30),
  risks: z.array(z.string()).max(10),
});

export async function planSprint(
  workspaceId: string,
  projectId: string,
  input: { durationDays: number; capacityHours?: number }
) {
  return withCredit(workspaceId, async () => {
    const project = await getProjectContext(workspaceId, projectId);
    const backlog = project.tasks.filter((t) => t.statusCategory === 'BACKLOG' || t.statusCategory === 'TODO');
    if (backlog.length === 0) throw ApiError.badRequest('No backlog tasks to plan a sprint from');

    const raw = await completeJson(
      `You are an agile coach planning a sprint.
Return JSON: {"sprintGoal","rationale","taskTitles":["exact titles from the backlog to include"],"risks":["..."]}
Select a realistic subset of backlog tasks for the sprint given duration and capacity. Use exact task titles.`,
      `Project: ${project.name}
Sprint duration: ${input.durationDays} days${input.capacityHours ? `\nTeam capacity: ${input.capacityHours} hours` : ''}
Backlog (title | priority | estimateMin | points):
${backlog.map((t) => `- ${t.title} | ${t.priority} | ${t.estimatedMinutes ?? '?'} | ${t.storyPoints ?? '?'}`).join('\n')}`
    );
    const parsed = sprintPlanSchema.safeParse(raw);
    if (!parsed.success) throw ApiError.internal('AI returned an unexpected structure');
    return parsed.data;
  });
}

// ---------------------------------------------------------------------------
// 3. Meeting summary
// ---------------------------------------------------------------------------

const meetingSummarySchema = z.object({
  summary: z.string().max(3000),
  decisions: z.array(z.string()).max(20),
  actionItems: z
    .array(z.object({ task: z.string(), owner: z.string().optional(), due: z.string().optional() }))
    .max(20),
});

export async function summarizeMeeting(workspaceId: string, transcript: string) {
  return withCredit(workspaceId, async () => {
    const raw = await completeJson(
      `You summarize meeting notes for a project management tool.
Return JSON: {"summary","decisions":["..."],"actionItems":[{"task","owner?","due?"}]}`,
      `Meeting notes/transcript:\n${transcript.slice(0, 24000)}`,
      3000
    );
    const parsed = meetingSummarySchema.safeParse(raw);
    if (!parsed.success) throw ApiError.internal('AI returned an unexpected structure');
    return parsed.data;
  });
}

// ---------------------------------------------------------------------------
// 4. Project risk analysis
// ---------------------------------------------------------------------------

const riskAnalysisSchema = z.object({
  overallRisk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  summary: z.string().max(2000),
  risks: z
    .array(
      z.object({
        title: z.string(),
        severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        description: z.string(),
        mitigation: z.string(),
      })
    )
    .max(10),
});

export async function analyzeRisk(workspaceId: string, projectId: string) {
  return withCredit(workspaceId, async () => {
    const project = await getProjectContext(workspaceId, projectId);
    const now = new Date();
    const open = project.tasks.filter((t) => t.statusCategory !== 'DONE');
    const overdue = open.filter((t) => t.dueDate && t.dueDate < now);

    const raw = await completeJson(
      `You are a delivery risk analyst.
Return JSON: {"overallRisk":"LOW|MEDIUM|HIGH|CRITICAL","summary","risks":[{"title","severity","description","mitigation"}]}`,
      `Project: ${project.name} (status ${project.status})
Timeline: ${project.startDate?.toISOString().slice(0, 10) ?? '?'} -> ${project.dueDate?.toISOString().slice(0, 10) ?? '?'}
Today: ${now.toISOString().slice(0, 10)}
Tasks: ${project.tasks.length} total, ${open.length} open, ${overdue.length} overdue
Open tasks sample:
${open.slice(0, 60).map((t) => `- ${t.title} | ${t.priority} | due ${t.dueDate?.toISOString().slice(0, 10) ?? 'none'} | assignees ${t.assignees.map((a) => a.user.name).join('/') || 'none'}`).join('\n')}`
    );
    const parsed = riskAnalysisSchema.safeParse(raw);
    if (!parsed.success) throw ApiError.internal('AI returned an unexpected structure');
    return parsed.data;
  });
}

// ---------------------------------------------------------------------------
// 5. Priority suggestion
// ---------------------------------------------------------------------------

const prioritySchema = z.object({
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW']),
  reasoning: z.string().max(1000),
});

export async function suggestPriority(workspaceId: string, taskId: string) {
  return withCredit(workspaceId, async () => {
    const task = await prisma.task.findFirst({
      where: { id: taskId, workspaceId, deletedAt: null },
      select: {
        title: true,
        description: true,
        dueDate: true,
        statusCategory: true,
        project: { select: { name: true, dueDate: true } },
        dependents: { select: { task: { select: { title: true } } } },
      },
    });
    if (!task) throw ApiError.notFound('Task');

    const raw = await completeJson(
      `You assign a priority to a task. Return JSON: {"priority":"URGENT|HIGH|MEDIUM|LOW","reasoning"}`,
      `Task: ${task.title}
Description: ${task.description?.slice(0, 2000) ?? 'n/a'}
Due: ${task.dueDate?.toISOString().slice(0, 10) ?? 'none'} (today ${new Date().toISOString().slice(0, 10)})
Project: ${task.project.name}, project due ${task.project.dueDate?.toISOString().slice(0, 10) ?? 'none'}
Blocks ${task.dependents.length} other task(s): ${task.dependents.map((d) => d.task.title).slice(0, 5).join('; ')}`
    );
    const parsed = prioritySchema.safeParse(raw);
    if (!parsed.success) throw ApiError.internal('AI returned an unexpected structure');
    return parsed.data;
  });
}

// ---------------------------------------------------------------------------
// 6. Deadline prediction
// ---------------------------------------------------------------------------

const deadlineSchema = z.object({
  predictedCompletionDate: z.string(),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  reasoning: z.string().max(1500),
  recommendations: z.array(z.string()).max(8),
});

export async function predictDeadline(workspaceId: string, projectId: string) {
  return withCredit(workspaceId, async () => {
    const project = await getProjectContext(workspaceId, projectId);
    const done = project.tasks.filter((t) => t.statusCategory === 'DONE');
    const open = project.tasks.filter((t) => t.statusCategory !== 'DONE');

    // Recent throughput: completions in the last 28 days.
    const cutoff = new Date(Date.now() - 28 * 86400_000);
    const recentDone = done.filter((t) => t.completedAt && t.completedAt >= cutoff).length;

    const raw = await completeJson(
      `You forecast project completion from throughput data.
Return JSON: {"predictedCompletionDate":"YYYY-MM-DD","confidence":"LOW|MEDIUM|HIGH","reasoning","recommendations":["..."]}`,
      `Project: ${project.name}
Today: ${new Date().toISOString().slice(0, 10)}
Deadline: ${project.dueDate?.toISOString().slice(0, 10) ?? 'none set'}
Completed tasks: ${done.length}; Open tasks: ${open.length}
Throughput last 28 days: ${recentDone} tasks completed
Open estimates total: ${open.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0)} minutes`
    );
    const parsed = deadlineSchema.safeParse(raw);
    if (!parsed.success) throw ApiError.internal('AI returned an unexpected structure');
    return parsed.data;
  });
}
