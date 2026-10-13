import type { Stats } from '../types';
import { ago } from '../api';

interface Props {
  stats: Stats | null;
  focus: boolean;
  fetching: boolean;
  onPalette: () => void;
  onFocus: () => void;
  onSweep: () => void;
}

export function TopBar({ stats, focus, fetching, onPalette, onFocus, onSweep }: Props) {
  const last = stats?.lastFetch;
  return (
    <header className="topbar grid-bg">
      <div className="brand">
        <span className="brand-name">KAMSEARCH</span>
        <span className="label" title={last ? `Last sweep ${ago(last.finished_at)} ago` : 'No sweep yet'}>
          Day {String(stats?.dayOfHunt ?? 1).padStart(3, '0')}
        </span>
      </div>

      <button className="cmd-trigger" onClick={onPalette} aria-label="Open command bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span>Search targets or run a command…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <div className="topbar-actions">
        <button className="btn btn-toggle" aria-pressed={focus} onClick={onFocus}>
          {focus ? 'Exit focus' : 'Focus mode'} <kbd>F</kbd>
        </button>
        <button className="btn btn-primary" onClick={onSweep} disabled={fetching}>
          {fetching ? 'Sweeping…' : 'Run sweep'}
        </button>
      </div>
    </header>
  );
}
