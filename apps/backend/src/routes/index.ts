import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from '@/modules/auth/auth.routes';

/**
 * API v1 route registry. Each domain module self-registers its router here.
 */
export const apiV1 = Router();

apiV1.use(healthRouter);
apiV1.use(authRouter);
