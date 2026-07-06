import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      commandOpen: false,
      setCommandOpen: (commandOpen) => set({ commandOpen }),
    }),
    { name: 'tf-ui', partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed }) }
  )
);
