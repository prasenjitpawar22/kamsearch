import { useMemo, useState } from 'react';
import type { JobSummary } from '../types';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

interface Props {
  commands: Command[];
  jobs: JobSummary[];
  onPickJob: (id: string) => void;
  onClose: () => void;
}

type Item = { key: string; label: string; hint?: string; group: 'Commands' | 'Targets'; run: () => void };

export function CommandPalette({ commands, jobs, onPickJob, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();
    const hit = (text: string) => !q || text.toLowerCase().includes(q);
    const cmds: Item[] = commands.filter((c) => hit(c.label)).map((c) => ({ key: c.id, label: c.label, hint: c.hint, group: 'Commands', run: c.run }));
    const targets: Item[] = jobs
      .filter((j) => q && hit(`${j.title} ${j.company} ${j.matched.join(' ')}`))
      .slice(0, 8)
      .map((j) => ({ key: j.id, label: `${j.title} · ${j.company}`, hint: String(j.score), group: 'Targets', run: () => onPickJob(j.id) }));
    return [...targets, ...cmds];
  }, [query, commands, jobs, onPickJob]);

  const choose = (item?: Item) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  let lastGroup = '';
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command bar">
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Search targets or type a command…"
          aria-label="Search targets or commands"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
        />
        <ul id="palette-list" role="listbox">
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={item.key}>
                {header && <div className="label group">{header}</div>}
                <button role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => choose(item)}>
                  <span>{item.label}</span>
                  {item.hint && <kbd>{item.hint}</kbd>}
                </button>
              </li>
            );
          })}
          {!items.length && <li className="muted" style={{ padding: 12 }}>Nothing matches.</li>}
        </ul>
      </div>
    </div>
  );
}
