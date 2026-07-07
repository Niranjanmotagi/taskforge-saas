'use client';

import { useEffect } from 'react';

/**
 * Content protection: blocks copy / cut / context-menu (right-click) and the
 * common "select all" shortcut across the app, while still allowing them
 * inside form fields so sign-in and search stay usable.
 */
function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function ContentGuard() {
  useEffect(() => {
    const block = (e: Event) => {
      if (!isEditable(e.target)) e.preventDefault();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd+A selects all page text — allow only inside inputs.
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isEditable(e.target)) {
        e.preventDefault();
      }
    };

    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('contextmenu', block);
    document.addEventListener('dragstart', block);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('dragstart', block);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return null;
}
