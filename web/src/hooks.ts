import { useEffect, useRef } from 'react';

type Handlers = Record<string, (e: KeyboardEvent) => void>;

// Keys are lower-case `e.key` values, with "mod+" for Ctrl/Cmd (e.g. "mod+k", "j", "escape", "?").
// Single-key shortcuts are ignored while typing in a field; "mod+" combos and Escape always work.
export function useHotkeys(handlers: Handlers, enabled = true) {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.repeat) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = (mod ? 'mod+' : '') + e.key.toLowerCase();
      const typing = (e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]');
      if (typing && !mod && key !== 'escape') return;
      const handler = ref.current[key];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
