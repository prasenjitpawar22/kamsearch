import { useEffect, useRef } from 'react';

export interface ToastState {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

export function Toast({ toast, onDone }: { toast: ToastState; onDone: () => void }) {
  const timer = useRef<number>(undefined);
  useEffect(() => {
    // Pause the countdown while the tab is hidden so a toast is never missed.
    const start = () => (timer.current = window.setTimeout(onDone, toast.action ? 6000 : 3200));
    const onVisibility = () => (document.hidden ? clearTimeout(timer.current) : start());
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [toast, onDone]);

  return (
    <div className="toast" role="status" key={toast.id}>
      <span>{toast.message}</span>
      {toast.action && (
        <button onClick={() => { toast.action!.run(); onDone(); }}>{toast.action.label}</button>
      )}
    </div>
  );
}

export function FetchLog({ log, running, onClose }: { log: string[]; running: boolean; onClose: () => void }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log]);
  return (
    <section className="log-panel" aria-label="Sweep log">
      <header>
        <span className="label">{running ? 'Sweep running…' : 'Sweep log'}</span>
        <button className="btn btn-small" onClick={onClose}>Close</button>
      </header>
      <pre ref={ref}>{log.join('\n') || 'Starting…'}</pre>
    </section>
  );
}
