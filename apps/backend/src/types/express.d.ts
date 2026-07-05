import type { WorkspaceRole, SystemRole } from '@taskforge/shared-types';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      /** Set by authenticate middleware. */
      user?: {
        id: string;
        email: string;
        systemRole: SystemRole;
        sessionId: string;
      };
      /** Set by tenant middleware after membership verification. */
      workspace?: {
        id: string;
        role: WorkspaceRole;
        memberId: string;
      };
    }
  }
}

export {};
