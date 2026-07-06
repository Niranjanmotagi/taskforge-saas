import { Queue, Worker } from 'bullmq';
import { queueConnectionOptions } from '@/lib/redis';
import { sendMail, type MailOptions } from '@/lib/mailer';
import { logger } from '@/lib/logger';

export const EMAIL_QUEUE = 'email';

let queue: Queue | null = null;

function getEmailQueue(): Queue {
  if (!queue) {
    queue = new Queue(EMAIL_QUEUE, {
      connection: queueConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 1000 },
      },
    });
  }
  return queue;
}

/** Enqueue an email (preferred over inline sendMail for user-facing flows). */
export async function enqueueEmail(mail: MailOptions): Promise<void> {
  try {
    await getEmailQueue().add('send', mail);
  } catch (err) {
    // Queue down => degrade to inline send rather than dropping the mail.
    logger.warn(`email queue unavailable, sending inline: ${(err as Error).message}`);
    await sendMail(mail).catch((e) => logger.error(`inline email failed: ${e.message}`));
  }
}

export function startEmailWorker(): Worker {
  const worker = new Worker(
    EMAIL_QUEUE,
    async (job) => {
      await sendMail(job.data as MailOptions);
    },
    { connection: queueConnectionOptions(), concurrency: 5 }
  );
  worker.on('failed', (job, err) => {
    logger.error(`email job ${job?.id} failed: ${err.message}`);
  });
  return worker;
}
