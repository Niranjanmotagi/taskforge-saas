import { WorkspaceRole } from './enums';

/**
 * Fine-grained permission catalog. The backend permission middleware and the
 * frontend UI-gating hooks both derive from this single matrix (DRY).
 */
export const PERMISSIONS = {
  // Workspace
  WORKSPACE_VIEW: 'workspace:view',
  WORKSPACE_UPDATE: 'workspace:update',
  WORKSPACE_DELETE: 'workspace:delete',
  WORKSPACE_TRANSFER: 'workspace:transfer',
  WORKSPACE_BILLING: 'workspace:billing',

  // Members
  MEMBER_VIEW: 'member:view',
  MEMBER_INVITE: 'member:invite',
  MEMBER_REMOVE: 'member:remove',
  MEMBER_ROLE_UPDATE: 'member:role:update',

  // Projects
  PROJECT_VIEW: 'project:view',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_ARCHIVE: 'project:archive',

  // Tasks
  TASK_VIEW: 'task:view',
  TASK_CREATE: 'task:create',
  TASK_UPDATE: 'task:update',
  TASK_DELETE: 'task:delete',
  TASK_ASSIGN: 'task:assign',

  // Comments
  COMMENT_VIEW: 'comment:view',
  COMMENT_CREATE: 'comment:create',
  COMMENT_UPDATE_OWN: 'comment:update:own',
  COMMENT_DELETE_ANY: 'comment:delete:any',

  // Sprints
  SPRINT_VIEW: 'sprint:view',
  SPRINT_MANAGE: 'sprint:manage',

  // Time tracking
  TIME_TRACK: 'time:track',
  TIME_VIEW_ALL: 'time:view:all',

  // Files
  FILE_VIEW: 'file:view',
  FILE_UPLOAD: 'file:upload',
  FILE_DELETE: 'file:delete',

  // Chat
  CHAT_VIEW: 'chat:view',
  CHAT_SEND: 'chat:send',
  CHAT_MANAGE: 'chat:manage',

  // Reports
  REPORT_VIEW: 'report:view',

  // AI
  AI_USE: 'ai:use',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

const MANAGER_PERMISSIONS: Permission[] = [
  PERMISSIONS.WORKSPACE_VIEW,
  PERMISSIONS.MEMBER_VIEW,
  PERMISSIONS.MEMBER_INVITE,
  PERMISSIONS.PROJECT_VIEW,
  PERMISSIONS.PROJECT_CREATE,
  PERMISSIONS.PROJECT_UPDATE,
  PERMISSIONS.PROJECT_ARCHIVE,
  PERMISSIONS.TASK_VIEW,
  PERMISSIONS.TASK_CREATE,
  PERMISSIONS.TASK_UPDATE,
  PERMISSIONS.TASK_DELETE,
  PERMISSIONS.TASK_ASSIGN,
  PERMISSIONS.COMMENT_VIEW,
  PERMISSIONS.COMMENT_CREATE,
  PERMISSIONS.COMMENT_UPDATE_OWN,
  PERMISSIONS.COMMENT_DELETE_ANY,
  PERMISSIONS.SPRINT_VIEW,
  PERMISSIONS.SPRINT_MANAGE,
  PERMISSIONS.TIME_TRACK,
  PERMISSIONS.TIME_VIEW_ALL,
  PERMISSIONS.FILE_VIEW,
  PERMISSIONS.FILE_UPLOAD,
  PERMISSIONS.FILE_DELETE,
  PERMISSIONS.CHAT_VIEW,
  PERMISSIONS.CHAT_SEND,
  PERMISSIONS.CHAT_MANAGE,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.AI_USE,
];

const CONTRIBUTOR_PERMISSIONS: Permission[] = [
  PERMISSIONS.WORKSPACE_VIEW,
  PERMISSIONS.MEMBER_VIEW,
  PERMISSIONS.PROJECT_VIEW,
  PERMISSIONS.TASK_VIEW,
  PERMISSIONS.TASK_CREATE,
  PERMISSIONS.TASK_UPDATE,
  PERMISSIONS.COMMENT_VIEW,
  PERMISSIONS.COMMENT_CREATE,
  PERMISSIONS.COMMENT_UPDATE_OWN,
  PERMISSIONS.SPRINT_VIEW,
  PERMISSIONS.TIME_TRACK,
  PERMISSIONS.FILE_VIEW,
  PERMISSIONS.FILE_UPLOAD,
  PERMISSIONS.CHAT_VIEW,
  PERMISSIONS.CHAT_SEND,
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.AI_USE,
];

/** Role → permission matrix. OWNER/ADMIN get everything except a few owner-only actions. */
export const ROLE_PERMISSIONS: Record<WorkspaceRole, Permission[]> = {
  [WorkspaceRole.OWNER]: ALL_PERMISSIONS,
  [WorkspaceRole.ADMIN]: ALL_PERMISSIONS.filter(
    (p) => p !== PERMISSIONS.WORKSPACE_DELETE && p !== PERMISSIONS.WORKSPACE_TRANSFER
  ),
  [WorkspaceRole.MANAGER]: MANAGER_PERMISSIONS,
  [WorkspaceRole.DEVELOPER]: CONTRIBUTOR_PERMISSIONS,
  [WorkspaceRole.QA]: CONTRIBUTOR_PERMISSIONS,
  [WorkspaceRole.CLIENT]: [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.COMMENT_VIEW,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_UPDATE_OWN,
    PERMISSIONS.FILE_VIEW,
    PERMISSIONS.CHAT_VIEW,
    PERMISSIONS.CHAT_SEND,
    PERMISSIONS.REPORT_VIEW,
  ],
  [WorkspaceRole.GUEST]: [
    PERMISSIONS.WORKSPACE_VIEW,
    PERMISSIONS.PROJECT_VIEW,
    PERMISSIONS.TASK_VIEW,
    PERMISSIONS.COMMENT_VIEW,
    PERMISSIONS.FILE_VIEW,
  ],
};

export function roleHasPermission(role: WorkspaceRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Roles allowed to manage a member holding `target` role (hierarchy guard). */
export const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  [WorkspaceRole.OWNER]: 100,
  [WorkspaceRole.ADMIN]: 80,
  [WorkspaceRole.MANAGER]: 60,
  [WorkspaceRole.DEVELOPER]: 40,
  [WorkspaceRole.QA]: 40,
  [WorkspaceRole.CLIENT]: 20,
  [WorkspaceRole.GUEST]: 10,
};

export function canManageRole(actor: WorkspaceRole, target: WorkspaceRole): boolean {
  return ROLE_HIERARCHY[actor] > ROLE_HIERARCHY[target];
}
