import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { env } from '@/config/env';
import { swaggerSpec } from '@/config/swagger';
import { apiV1 } from '@/routes';
import {
  apiLimiter,
  errorHandler,
  notFoundHandler,
  requestContext,
} from '@/middlewares';

/**
 * Build the Express application. Exported as a factory so integration tests
 * can create isolated instances without binding a port.
 */
export function createApp(): Express {
  const app = express();

  // Behind nginx in production — trust the first proxy for correct req.ip.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // Prisma BigInt columns (storage byte counts) must serialize as numbers.
  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? Number(value) : value
  );

  app.use(requestContext);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    })
  );
  app.use(compression());

  // Stripe webhooks need the raw body for signature verification — mounted
  // before the JSON parser inside the billing router (express.raw there).
  app.use((req, res, next) => {
    if (req.originalUrl === '/api/v1/billing/webhook') return next();
    express.json({ limit: '1mb' })(req, res, next);
  });
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  app.use('/api', apiLimiter);
  app.use('/api/v1', apiV1);

  if (!env.isProduction) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'TaskForge API' }));
    app.get('/api/docs.json', (_req, res) => {
      res.json(swaggerSpec);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
