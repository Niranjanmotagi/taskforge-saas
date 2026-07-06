import { create } from 'zustand';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  systemRole: 'SUPER_ADMIN' | 'USER';
  emailVerified?: boolean;
}

interface AuthState {
  /** Access token lives in memory only — refresh cookie restores it. */
  accessToken: string | null;
  user: SessionUser | null;
  /** True once the initial silent refresh attempt has settled. */
  hydrated: boolean;
  setSession: (token: string, user?: SessionUser | null) => void;
  setUser: (user: SessionUser | null) => void;
  setHydrated: () => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  hydrated: false,
  setSession: (accessToken, user) =>
    set((s) => ({ accessToken, user: user === undefined ? s.user : user })),
  setUser: (user) => set({ user }),
  setHydrated: () => set({ hydrated: true }),
  clear: () => set({ accessToken: null, user: null }),
}));
