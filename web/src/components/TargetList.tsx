import { useEffect, useRef } from 'react';
import type { JobSummary, Resume } from '../types';
import { ago } from '../api';

interface Props {
  jobs: JobSummary[];
  selectedId: string | null;
  resumes: Resume[];
  showStatus: boolean;
  onSelect: (id: string) => void;
}

export const scoreClass = (s: number) => (s >= 80 ? 'score-box score-hi' : s >= 60 ? 'score-box' : 'score-box score-lo');

export function TargetList({ jobs, selectedId, resumes, showStatus, onSelect }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const resumeName = (id: string | null) => resumes.find((r) => r.id === id)?.title ?? id ?? 'no resume';

  // Keep the selected card visible when moving with J/K.
  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <div className="targets" ref={listRef}>
      {jobs.map((j) => (
        <button key={j.id} className="target" aria-current={j.id === selectedId} onClick={() => onSelect(j.id)}>
          <span className={scoreClass(j.score)}>{j.score}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span className="target-title">{j.title}</span>
            <span className="target-meta">
              {j.company} · {showStatus ? <span className={`status status-${j.status}`}>{j.status}</span> : `${ago(j.posted_at || j.fetched_at)} · ${resumeName(j.resume_id)}`}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
