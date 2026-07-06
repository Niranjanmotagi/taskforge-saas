import { prisma } from '@/lib/prisma';
import { computeProjectHealth } from '@/modules/projects/project.service';
import { logger } from '@/lib/logger';

/** Daily: recompute derived health for all active projects. */
export async function refreshAllProjectHealth(): Promise<void> {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null, status: { in: ['PLANNING', 'ACTIVE'] } },
    select: { id: true },
    take: 2000,
  });

  let updated = 0;
  for (const project of projects) {
    const health = await computeProjectHealth(project.id);
    await prisma.project.update({ where: { id: project.id }, data: { health } });
    updated += 1;
  }
  logger.info(`project-health: refreshed ${updated} projects`);
}
