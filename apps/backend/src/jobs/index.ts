import { logger } from '@/lib/logger';

/**
 * Placeholder cron bootstrap — replaced by the jobs module (due-date
 * reminders, recurring task spawner, digests).
 */
export function startCronJobs(): void {
  logger.debug('jobs: no cron jobs registered yet');
}
