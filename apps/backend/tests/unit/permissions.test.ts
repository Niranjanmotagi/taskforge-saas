import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  WorkspaceRole,
  canManageRole,
  roleHasPermission,
} from '@taskforge/shared-types';

describe('RBAC permission matrix', () => {
  it('grants OWNER every permission', () => {
    for (const permission of Object.values(PERMISSIONS)) {
      expect(roleHasPermission(WorkspaceRole.OWNER, permission)).toBe(true);
    }
  });

  it('denies ADMIN owner-only permissions', () => {
    expect(roleHasPermission(WorkspaceRole.ADMIN, PERMISSIONS.WORKSPACE_DELETE)).toBe(false);
    expect(roleHasPermission(WorkspaceRole.ADMIN, PERMISSIONS.WORKSPACE_TRANSFER)).toBe(false);
    expect(roleHasPermission(WorkspaceRole.ADMIN, PERMISSIONS.WORKSPACE_BILLING)).toBe(true);
  });

  it('keeps GUEST read-only', () => {
    const guest = ROLE_PERMISSIONS[WorkspaceRole.GUEST];
    expect(guest).not.toContain(PERMISSIONS.TASK_CREATE);
    expect(guest).not.toContain(PERMISSIONS.TASK_UPDATE);
    expect(guest).not.toContain(PERMISSIONS.COMMENT_CREATE);
    expect(guest).toContain(PERMISSIONS.TASK_VIEW);
  });

  it('lets CLIENT comment but not modify tasks', () => {
    expect(roleHasPermission(WorkspaceRole.CLIENT, PERMISSIONS.COMMENT_CREATE)).toBe(true);
    expect(roleHasPermission(WorkspaceRole.CLIENT, PERMISSIONS.TASK_UPDATE)).toBe(false);
    expect(roleHasPermission(WorkspaceRole.CLIENT, PERMISSIONS.TASK_DELETE)).toBe(false);
  });

  it('enforces the management hierarchy', () => {
    expect(canManageRole(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)).toBe(true);
    expect(canManageRole(WorkspaceRole.ADMIN, WorkspaceRole.MANAGER)).toBe(true);
    expect(canManageRole(WorkspaceRole.ADMIN, WorkspaceRole.OWNER)).toBe(false);
    expect(canManageRole(WorkspaceRole.MANAGER, WorkspaceRole.MANAGER)).toBe(false);
    expect(canManageRole(WorkspaceRole.DEVELOPER, WorkspaceRole.QA)).toBe(false);
  });
});
