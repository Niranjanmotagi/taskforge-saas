import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from '@/modules/auth/auth.routes';
import { workspaceRouter } from '@/modules/workspaces/workspace.routes';
import { projectRouter } from '@/modules/projects/project.routes';
import { taskRouter } from '@/modules/tasks/task.routes';
import { sprintRouter } from '@/modules/sprints/sprint.routes';
import { timeRouter } from '@/modules/time/time.routes';
import { reportRouter } from '@/modules/reports/report.routes';
import { notificationRouter } from '@/modules/notifications/notification.routes';
import { chatRouter } from '@/modules/chat/chat.routes';
import { fileRouter } from '@/modules/files/file.routes';
import { searchRouter } from '@/modules/search/search.routes';
import { billingRouter } from '@/modules/billing/billing.routes';
import { aiRouter } from '@/modules/ai/ai.routes';
import { adminRouter } from '@/modules/admin/admin.routes';

/**
 * API v1 route registry. Each domain module self-registers its router here.
 */
export const apiV1 = Router();

apiV1.use(healthRouter);
apiV1.use(authRouter);
apiV1.use(workspaceRouter);
apiV1.use(projectRouter);
apiV1.use(taskRouter);
apiV1.use(sprintRouter);
apiV1.use(timeRouter);
apiV1.use(reportRouter);
apiV1.use(notificationRouter);
apiV1.use(chatRouter);
apiV1.use(fileRouter);
apiV1.use(searchRouter);
apiV1.use(billingRouter);
apiV1.use(aiRouter);
apiV1.use(adminRouter);
