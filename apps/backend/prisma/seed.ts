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
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
