import { prisma } from '@/lib/prisma';
import { ApiError } from '@/utils/api-error';
import { deleteAsset, isCloudinaryConfigured, uploadBuffer } from '@/lib/cloudinary';
import { assertStorageAvailable } from '@/services/plan-limits.service';
import { recordActivity } from '@/services/activity.service';

const ATTACHMENT_INCLUDE = {
  uploader: { select: { id: true, name: true, avatarUrl: true } },
  task: { select: { id: true, title: true, number: true } },
} as const;

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

export async function listFolderContents(workspaceId: string, folderId?: string) {
  if (folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, workspaceId, deletedAt: null },
    });
    if (!folder) throw ApiError.notFound('Folder');
  }

  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { workspaceId, parentId: folderId ?? null, deletedAt: null },
      orderBy: { name: 'asc' },
      include: { _count: { select: { attachments: { where: { deletedAt: null } }, children: true } } },
    }),
    prisma.attachment.findMany({
      where: { workspaceId, folderId: folderId ?? null, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: ATTACHMENT_INCLUDE,
    }),
  ]);

  return { folders, files };
}

export async function createFolder(workspaceId: string, input: { name: string; parentId?: string }) {
  if (input.parentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: input.parentId, workspaceId, deletedAt: null },
    });
    if (!parent) throw ApiError.notFound('Parent folder');
  }
  return prisma.folder.create({
    data: { workspaceId, name: input.name, parentId: input.parentId },
  });
}

export async function renameFolder(workspaceId: string, folderId: string, name: string) {
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, workspaceId, deletedAt: null },
  });
  if (!folder) throw ApiError.notFound('Folder');
  return prisma.folder.update({ where: { id: folderId }, data: { name } });
}

export async function deleteFolder(workspaceId: string, folderId: string): Promise<void> {
  const folder = await prisma.folder.findFirst({
    where: { id: folderId, workspaceId, deletedAt: null },
  });
  if (!folder) throw ApiError.notFound('Folder');
  // Soft delete folder; contents move to root to stay reachable.
  await prisma.$transaction([
    prisma.attachment.updateMany({ where: { folderId }, data: { folderId: null } }),
    prisma.folder.updateMany({ where: { parentId: folderId }, data: { parentId: folder.parentId } }),
    prisma.folder.update({ where: { id: folderId }, data: { deletedAt: new Date() } }),
  ]);
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export async function uploadAttachment(
  workspaceId: string,
  uploaderId: string,
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  options: { taskId?: string; folderId?: string; replacesAttachmentId?: string }
) {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, 'File storage is not configured on this server');
  }

  await assertStorageAvailable(workspaceId, file.size);

  if (options.taskId) {
    const task = await prisma.task.findFirst({
      where: { id: options.taskId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!task) throw ApiError.notFound('Task');
  }
  if (options.folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: options.folderId, workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!folder) throw ApiError.notFound('Folder');
  }

  // Version chain: replacing an existing attachment bumps version.
  let version = 1;
  let previousVersionId: string | undefined;
  if (options.replacesAttachmentId) {
    const previous = await prisma.attachment.findFirst({
      where: { id: options.replacesAttachmentId, workspaceId, deletedAt: null },
    });
    if (!previous) throw ApiError.notFound('Previous version');
    version = previous.version + 1;
    previousVersionId = previous.id;
  }

  const uploaded = await uploadBuffer(file.buffer, {
    workspaceId,
    filename: file.originalname,
    mimeType: file.mimetype,
  });

  const [attachment] = await prisma.$transaction([
    prisma.attachment.create({
      data: {
        workspaceId,
        taskId: options.taskId,
        folderId: options.folderId,
        uploaderId,
        name: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: uploaded.sizeBytes,
        url: uploaded.url,
        thumbnailUrl: uploaded.thumbnailUrl,
        publicId: uploaded.publicId,
        version,
        previousVersionId,
      },
      include: ATTACHMENT_INCLUDE,
    }),
    prisma.workspace.update({
      where: { id: workspaceId },
      data: { storageUsedBytes: { increment: uploaded.sizeBytes } },
    }),
  ]);

  recordActivity({
    workspaceId,
    actorId: uploaderId,
    action: 'UPLOADED',
    entityType: 'attachment',
    entityId: attachment.id,
    entityLabel: attachment.name,
  });

  return attachment;
}

export async function listTaskAttachments(workspaceId: string, taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!task) throw ApiError.notFound('Task');
  return prisma.attachment.findMany({
    where: { taskId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: ATTACHMENT_INCLUDE,
  });
}

export async function getVersionHistory(workspaceId: string, attachmentId: string) {
  const head = await prisma.attachment.findFirst({
    where: { id: attachmentId, workspaceId, deletedAt: null },
    include: ATTACHMENT_INCLUDE,
  });
  if (!head) throw ApiError.notFound('Attachment');

  const chain = [head];
  let cursor = head.previousVersionId;
  while (cursor && chain.length < 50) {
    const prev: (typeof head) | null = await prisma.attachment.findFirst({
      where: { id: cursor },
      include: ATTACHMENT_INCLUDE,
    });
    if (!prev) break;
    chain.push(prev);
    cursor = prev.previousVersionId;
  }
  return chain;
}

export async function deleteAttachment(
  workspaceId: string,
  attachmentId: string,
  actorId: string,
  canDeleteAny: boolean
): Promise<void> {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, workspaceId, deletedAt: null },
  });
  if (!attachment) throw ApiError.notFound('Attachment');
  if (attachment.uploaderId !== actorId && !canDeleteAny) {
    throw ApiError.forbidden('You can only delete files you uploaded');
  }

  await prisma.$transaction([
    prisma.attachment.update({ where: { id: attachmentId }, data: { deletedAt: new Date() } }),
    prisma.workspace.update({
      where: { id: workspaceId },
      data: { storageUsedBytes: { decrement: attachment.sizeBytes } },
    }),
  ]);

  // Cloud cleanup is best-effort; DB stays the source of truth.
  void deleteAsset(attachment.publicId).catch(() => undefined);
}
