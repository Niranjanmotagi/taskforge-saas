import { logger } from '@/lib/logger';

/**
 * Placeholder queue bootstrap — replaced by the queues module (BullMQ workers
 * for email, notifications, recurring tasks).
 */
export function startWorkers(): void {
  logger.debug('queues: no workers registered yet');
}
