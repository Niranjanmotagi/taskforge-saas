import winston from 'winston';
import { env } from '@/config/env';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss.SSS' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${level}: ${stack ?? message}${metaStr}`;
  })
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'taskforge-api' },
  transports: [new winston.transports.Console()],
  silent: env.isTest,
});

/** Child logger carrying request context. */
export function requestLogger(requestId: string, userId?: string) {
  return logger.child({ requestId, userId });
}
