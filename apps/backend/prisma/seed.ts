/**
 * Idempotent seed: plan catalog, feature flags, and a super-admin account.
 * Safe to run repeatedly (upserts only).
 *
 * Demo data (workspace, projects, tasks) is only created when SEED_DEMO=true.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const GB = 1024 * 1024 * 1024;

const PLANS = [
  {
    tier: 'FREE' as const,
    name: 'Free',
    description: 'For individuals and small teams getting started',
    priceMonthlyCents: 0,
    priceYearlyCents: 0,
    maxMembers: 5,
    maxProjects: 3,
    storageLimitBytes: BigInt(1 * GB),
    aiCreditsPerMonth: 10,
    features: ['Up to 5 members', '3 projects', 'Kanban board', 'Basic reports', '1 GB storage'],
  },
  {
    tier: 'STARTER' as const,
    name: 'Starter',
    description: 'For growing teams that need more room',
    priceMonthlyCents: 900,
    priceYearlyCents: 9000,
    maxMembers: 15,
    maxProjects: 15,
    storageLimitBytes: BigInt(10 * GB),
    aiCreditsPerMonth: 100,
    features: [
      'Up to 15 members',
      '15 projects',
      'Sprints & Gantt',
      'Time tracking',
      'Chat',
      '10 GB storage',
    ],
  },
  {
    tier: 'PROFESSIONAL' as const,
    name: 'Professional',
    description: 'Advanced management for serious product teams',
    priceMonthlyCents: 2400,
    priceYearlyCents: 24000,
    maxMembers: 50,
    maxProjects: -1,
    storageLimitBytes: BigInt(100 * GB),
    aiCreditsPerMonth: 1000,
    features: [
      'Up to 50 members',
      'Unlimited projects',
      'AI features',
      'Custom fields',
      'Advanced reports',
      'Priority support',
      '100 GB storage',
    ],
  },
  {
    tier: 'ENTERPRISE' as const,
    name: 'Enterprise',
    description: 'Security, control, and scale for large organizations',
    priceMonthlyCents: 9900,
    priceYearlyCents: 99000,
    maxMembers: -1,
    maxProjects: -1,
    storageLimitBytes: BigInt(1024 * GB),
    aiCreditsPerMonth: 10000,
    features: [
      'Unlimited members',
      'Unlimited projects',
      'Audit logs',
      'SSO (roadmap)',
      'Dedicated support',
      '1 TB storage',
    ],
  },
];

const FEATURE_FLAGS = [
  { key: 'ai-features', description: 'AI task generation, planning, and analysis', isEnabled: true },
  { key: 'live-cursors', description: 'Realtime cursor presence on boards', isEnabled: true },
  { key: 'gantt-critical-path', description: 'Critical path highlighting on Gantt', isEnabled: true },
];

async function main(): Promise<void> {
  // Plan catalog
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { tier: plan.tier },
      create: plan,
      update: plan,
    });
  }
  console.log(`✓ seeded ${PLANS.length} plans`);

  // Feature flags
  for (const flag of FEATURE_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: flag.key },
      create: flag,
      update: { description: flag.description },
    });
  }
  console.log(`✓ seeded ${FEATURE_FLAGS.length} feature flags`);

  // Super-admin (credentials via env, dev defaults otherwise)
  const adminEmail = process.env.SUPERADMIN_EMAIL ?? 'admin@taskforge.local';
  const adminPassword = process.env.SUPERADMIN_PASSWORD ?? 'ChangeMe123!';
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: 'Platform Admin',
      systemRole: 'SUPER_ADMIN',
      emailVerifiedAt: new Date(),
      passwordHash: await bcrypt.hash(adminPassword, 12),
    },
    update: { systemRole: 'SUPER_ADMIN' },
  });
  console.log(`✓ super-admin ready (${adminEmail})`);

  if (process.env.SEED_DEMO === 'true') {
    await seedDemo();
  }
}

/** Demo workspace with a realistic project, board, tasks, and sprint. */
async function seedDemo(): Promise<void> {
  const password = await bcrypt.hash('Demo1234!', 12);
  const demoUsers = await Promise.all(
    [
      { email: 'demo@taskforge.local', name: 'Demo Owner' },
      { email: 'sam@taskforge.local', name: 'Sam Rivera' },
      { email: 'priya@taskforge.local', name: 'Priya Patel' },
    ].map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        create: { ...u, passwordHash: password, emailVerifiedAt: new Date() },
        update: {},
      })
    )
  );
  const [owner, sam, priya] = demoUsers;

  const existing = await prisma.workspace.findUnique({ where: { slug: 'demo-workspace' } });
  if (existing) {
    console.log('✓ demo workspace already present');
    return;
  }

  const freePlan = await prisma.plan.findUniqueOrThrow({ where: { tier: 'FREE' } });

  const workspace = await prisma.workspace.create({
    data: {
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      description: 'Explore TaskForge with sample data',
      ownerId: owner.id,
      members: {
        create: [
          { userId: owner.id, role: 'OWNER' },
          { userId: sam.id, role: 'MANAGER' },
          { userId: priya.id, role: 'DEVELOPER' },
        ],
      },
      labels: {
        create: [
          { name: 'Bug', color: '#ef4444' },
          { name: 'Feature', color: '#6366f1' },
          { name: 'Design', color: '#ec4899' },
        ],
      },
      subscription: { create: { planId: freePlan.id, status: 'ACTIVE' } },
    },
    include: { labels: true },
  });

  await prisma.channel.create({
    data: {
      workspaceId: workspace.id,
      type: 'WORKSPACE',
      name: 'general',
      createdById: owner.id,
      members: { create: demoUsers.map((u) => ({ userId: u.id, isAdmin: u.id === owner.id })) },
    },
  });

  const columns = [
    { name: 'Backlog', category: 'BACKLOG' as const, color: '#94a3b8' },
    { name: 'Todo', category: 'TODO' as const, color: '#64748b' },
    { name: 'In Progress', category: 'IN_PROGRESS' as const, color: '#3b82f6' },
    { name: 'Review', category: 'REVIEW' as const, color: '#8b5cf6' },
    { name: 'Testing', category: 'TESTING' as const, color: '#f59e0b' },
    { name: 'Completed', category: 'DONE' as const, color: '#10b981' },
  ];

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: 'Website Redesign',
      key: 'WEB',
      description: 'Complete overhaul of the marketing site and docs',
      color: '#6366f1',
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 14 * 86400_000),
      dueDate: new Date(Date.now() + 45 * 86400_000),
      budgetCents: 2_500_000,
      clientName: 'Internal',
      leadId: owner.id,
      members: { create: demoUsers.map((u) => ({ userId: u.id })) },
      columns: { create: columns.map((c, i) => ({ ...c, position: i })) },
    },
    include: { columns: true },
  });

  const col = (name: string) => project.columns.find((c) => c.name === name)!;
  const labelIds = workspace.labels.map((l) => l.id);
  const ranks = ['f', 'i', 'l', 'o', 'r', 'u', 'x'];

  const demoTasks = [
    { title: 'Audit current site content', column: 'Completed', assignee: sam.id, priority: 'MEDIUM', points: 3, done: true },
    { title: 'Design new homepage hero', column: 'Review', assignee: priya.id, priority: 'HIGH', points: 5, label: 2 },
    { title: 'Implement responsive navigation', column: 'In Progress', assignee: priya.id, priority: 'HIGH', points: 5, label: 1 },
    { title: 'Migrate blog to MDX', column: 'In Progress', assignee: sam.id, priority: 'MEDIUM', points: 8 },
    { title: 'Fix broken pricing table on mobile', column: 'Todo', assignee: priya.id, priority: 'URGENT', points: 2, label: 0 },
    { title: 'Set up analytics events', column: 'Todo', assignee: sam.id, priority: 'LOW', points: 3 },
    { title: 'Write launch announcement', column: 'Backlog', assignee: owner.id, priority: 'NONE', points: 2 },
  ];

  let counter = 0;
  for (const [i, t] of demoTasks.entries()) {
    counter += 1;
    await prisma.task.create({
      data: {
        workspaceId: workspace.id,
        projectId: project.id,
        columnId: col(t.column).id,
        number: counter,
        title: t.title,
        priority: t.priority as never,
        statusCategory: col(t.column).category,
        position: ranks[i],
        storyPoints: t.points,
        dueDate: new Date(Date.now() + (i + 2) * 3 * 86400_000),
        completedAt: t.done ? new Date(Date.now() - 2 * 86400_000) : null,
        creatorId: owner.id,
        assignees: { create: [{ userId: t.assignee }] },
        watchers: { create: [{ userId: t.assignee }, ...(t.assignee === owner.id ? [] : [{ userId: owner.id }])] },
        ...(t.label !== undefined ? { labels: { create: [{ labelId: labelIds[t.label] }] } } : {}),
      },
    });
  }
  await prisma.project.update({ where: { id: project.id }, data: { taskCounter: counter } });

  await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: 'Sprint 1 — Foundation',
      goal: 'Ship the new homepage and navigation',
      status: 'ACTIVE',
      startDate: new Date(Date.now() - 3 * 86400_000),
      endDate: new Date(Date.now() + 11 * 86400_000),
    },
  });

  console.log('✓ demo workspace seeded (demo@taskforge.local / Demo1234!)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
