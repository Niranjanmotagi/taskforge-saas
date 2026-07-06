import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

/** Monthly: reset per-workspace AI credit usage counters. */
export async function resetMonthlyAiCredits(): Promise<void> {
  const result = await prisma.workspace.updateMany({
    where: { aiCreditsUsed: { gt: 0 } },
    data: { aiCreditsUsed: 0 },
  });
  logger.info(`ai-credit-reset: reset ${result.count} workspaces`);
}
