import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { PERMISSIONS, roleHasPermission } from '@taskforge/shared-types';
import { asyncHandler } from '@/utils/async-handler';
import { authenticate, authorize, heavyLimiter, idParam, tenantScope, validate, workspaceIdParam } from '@/middlewares';
import { ok, created } from '@/utils/response';
import { ApiError } from '@/utils/api-error';
import * as fileService from './file.service';

export const fileRouter = Router();

const auth = [authenticate] as const;

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file

const BLOCKED_MIME_PREFIXES = ['application/x-msdownload', 'application/x-sh'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (BLOCKED_MIME_PREFIXES.some((p) => file.mimetype.startsWith(p))) {
      cb(ApiError.badRequest('This file type is not allowed'));
      return;
    }
    cb(null, true);
  },
});

/**
 * @openapi
 * /workspaces/{workspaceId}/files:
 *   get: { summary: Browse folder contents (root when no folderId), tags: [Files] }
 *   post:
 *     summary: Upload a file (multipart; quota enforced; optional task/folder/version)
 *     tags: [Files]
 */
fileRouter.get(
  '/workspaces/:workspaceId/files',
  ...auth,
  validate({ params: workspaceIdParam, query: z.object({ folderId: z.string().uuid().optional() }) }),
  tenantScope,
  authorize(PERMISSIONS.FILE_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await fileService.listFolderContents(req.workspace!.id, req.query.folderId as string | undefined));
  })
);

fileRouter.post(
  '/workspaces/:workspaceId/files',
  ...auth,
  heavyLimiter,
  validate({ params: workspaceIdParam }),
  tenantScope,
  authorize(PERMISSIONS.FILE_UPLOAD),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw ApiError.badRequest('A file is required (multipart field "file")');
    const options = z
      .object({
        taskId: z.string().uuid().optional(),
        folderId: z.string().uuid().optional(),
        replacesAttachmentId: z.string().uuid().optional(),
      })
      .parse(req.body);
    created(res, await fileService.uploadAttachment(req.workspace!.id, req.user!.id, req.file, options));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/folders:
 *   post: { summary: Create a folder, tags: [Files] }
 */
fileRouter.post(
  '/workspaces/:workspaceId/folders',
  ...auth,
  validate({
    params: workspaceIdParam,
    body: z.object({ name: z.string().trim().min(1).max(120), parentId: z.string().uuid().optional() }),
  }),
  tenantScope,
  authorize(PERMISSIONS.FILE_UPLOAD),
  asyncHandler(async (req: Request, res: Response) => {
    created(res, await fileService.createFolder(req.workspace!.id, req.body));
  })
);

fileRouter.patch(
  '/workspaces/:workspaceId/folders/:folderId',
  ...auth,
  validate({
    params: idParam('workspaceId', 'folderId'),
    body: z.object({ name: z.string().trim().min(1).max(120) }),
  }),
  tenantScope,
  authorize(PERMISSIONS.FILE_UPLOAD),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await fileService.renameFolder(req.workspace!.id, req.params.folderId, req.body.name));
  })
);

fileRouter.delete(
  '/workspaces/:workspaceId/folders/:folderId',
  ...auth,
  validate({ params: idParam('workspaceId', 'folderId') }),
  tenantScope,
  authorize(PERMISSIONS.FILE_DELETE),
  asyncHandler(async (req: Request, res: Response) => {
    await fileService.deleteFolder(req.workspace!.id, req.params.folderId);
    ok(res, null);
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/tasks/{taskId}/attachments:
 *   get: { summary: Attachments on a task, tags: [Files] }
 */
fileRouter.get(
  '/workspaces/:workspaceId/tasks/:taskId/attachments',
  ...auth,
  validate({ params: idParam('workspaceId', 'taskId') }),
  tenantScope,
  authorize(PERMISSIONS.FILE_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await fileService.listTaskAttachments(req.workspace!.id, req.params.taskId));
  })
);

/**
 * @openapi
 * /workspaces/{workspaceId}/attachments/{attachmentId}/versions:
 *   get: { summary: Version chain (newest first), tags: [Files] }
 */
fileRouter.get(
  '/workspaces/:workspaceId/attachments/:attachmentId/versions',
  ...auth,
  validate({ params: idParam('workspaceId', 'attachmentId') }),
  tenantScope,
  authorize(PERMISSIONS.FILE_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    ok(res, await fileService.getVersionHistory(req.workspace!.id, req.params.attachmentId));
  })
);

fileRouter.delete(
  '/workspaces/:workspaceId/attachments/:attachmentId',
  ...auth,
  validate({ params: idParam('workspaceId', 'attachmentId') }),
  tenantScope,
  authorize(PERMISSIONS.FILE_VIEW),
  asyncHandler(async (req: Request, res: Response) => {
    const canDeleteAny = roleHasPermission(req.workspace!.role, PERMISSIONS.FILE_DELETE);
    await fileService.deleteAttachment(req.workspace!.id, req.params.attachmentId, req.user!.id, canDeleteAny);
    ok(res, null);
  })
);
