import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from '@/modules/auth/auth.routes';
import { workspaceRouter } from '@/modules/workspaces/workspace.routes';
import { projectRouter } from '@/modules/projects/project.routes';
import { taskRouter } from '@/modules/tasks/task.routes';

/**
 * API v1 route registry. Each domain module self-registers its router here.
 */
export const apiV1 = Router();

apiV1.use(healthRouter);
apiV1.use(authRouter);
apiV1.use(workspaceRouter);
apiV1.use(projectRouter);
apiV1.use(taskRouter);
