import type { Stats } from '../types';

export type Desk = 'targets' | 'stash' | 'operations' | 'training' | 'config';

export const DESKS: { id: Desk; label: string; key: string }[] = [
  { id: 'targets', label: 'Targets', key: '1' },
  { id: 'stash', label: 'Stash', key: '2' },
  { id: 'operations', label: 'Operations', key: '3' },
  { id: 'training', label: 'Training', key: '4' },
  { id: 'config', label: 'Config', key: '5' },
];

function deskCount(id: Desk, stats: Stats | null) {
  if (!stats) return 0;
  const c = stats.counts;
  if (id === 'targets') return c.new;
  if (id === 'stash') return c.saved;
  if (id === 'operations') return c.applied + c.interview + c.offer + c.rejected;
  return 0;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function Rail({ desk, stats, onDesk }: { desk: Desk; stats: Stats | null; onDesk: (d: Desk) => void }) {
  const goal = stats?.dailyGoal ?? 5;
  const sent = stats?.appliedToday ?? 0;

  return (
    <aside className="rail grid-bg">
      <nav aria-label="Desks">
        {DESKS.map((d) => {
          const count = deskCount(d.id, stats);
          return (
            <button key={d.id} className="rail-link" aria-current={desk === d.id ? 'page' : undefined} onClick={() => onDesk(d.id)}>
              <span>{d.label.toUpperCase()}</span>
              <span className="rail-link-meta">
                {count > 0 && <span className="count">{pad(count)}</span>}
                <kbd>{d.key}</kbd>
              </span>
            </button>
          );
        })}
      </nav>

      <section className="orders" aria-label="Today's orders">
        <h2 className="label">Today's orders</h2>
        <div>
          <div className="order-row">
            <span>Apply to {goal}</span>
            <span style={{ color: 'var(--accent)' }}>{Math.min(sent, goal)}/{goal}</span>
          </div>
          <div className="pips" aria-hidden="true">
            {Array.from({ length: goal }, (_, i) => <div key={i} className={i < sent ? 'pip on' : 'pip'} />)}
          </div>
        </div>
        <div className="order-row">
          <span>Follow-ups</span>
          <span style={{ color: stats?.followUps.length ? 'var(--accent)' : 'var(--ok)' }}>{stats?.followUps.length ?? 0} due</span>
        </div>
        {stats?.drill && (
          <button className="order-row" onClick={() => onDesk('training')} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
            <span>Drill: {stats.drill.skill}</span>
            <span style={{ color: stats.drill.done ? 'var(--ok)' : 'var(--accent)' }}>{stats.drill.done ? '1/1' : '0/1'}</span>
          </button>
        )}
      </section>

      <section className="hints" aria-label="Keyboard shortcuts">
        <span><kbd>J</kbd> <kbd>K</kbd> move</span>
        <span><kbd>A</kbd> apply</span>
        <span><kbd>S</kbd> stash · <kbd>X</kbd> skip</span>
        <span><kbd>B</kbd> block company</span>
        <span><kbd>F</kbd> focus mode</span>
        <span><kbd>Ctrl</kbd> <kbd>K</kbd> commands</span>
      </section>
    </aside>
  );
}
