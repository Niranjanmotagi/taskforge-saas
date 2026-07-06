import cron from 'node-cron';
import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import { dueDateReminders } from './due-date-reminders.job';
import { spawnRecurringTasks } from './recurring-tasks.job';
import { refreshAllProjectHealth } from './project-health.job';
import { resetMonthlyAiCredits } from './ai-credits.job';

interface JobDef {
  name: string;
  schedule: string;
  run: () => Promise<void>;
}

const JOBS: JobDef[] = [
  { name: 'due-date-reminders', schedule: '0 * * * *', run: dueDateReminders }, // hourly
  { name: 'recurring-tasks', schedule: '15 * * * *', run: spawnRecurringTasks }, // hourly at :15
  { name: 'project-health', schedule: '30 2 * * *', run: refreshAllProjectHealth }, // daily 02:30
  { name: 'ai-credit-reset', schedule: '0 0 1 * *', run: resetMonthlyAiCredits }, // monthly
];

/** Register cron jobs. Each run is wrapped so one failure never kills the scheduler. */
export function startCronJobs(): void {
  if (env.isTest) return;

  for (const job of JOBS) {
    cron.schedule(job.schedule, () => {
      job
        .run()
        .then(() => logger.debug(`cron ${job.name}: done`))
        .catch((err) => logger.error(`cron ${job.name} failed: ${err.message}`));
    });
  }
  logger.info(`jobs: ${JOBS.length} cron jobs scheduled`);
}
