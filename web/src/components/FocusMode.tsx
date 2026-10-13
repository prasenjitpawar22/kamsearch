import type { Job, Resume } from '../types';
import { ago } from '../api';

interface Props {
  job: Job | null;
  position: number;
  total: number;
  sentToday: number;
  goal: number;
  resumes: Resume[];
  resumeId: string;
  confirming: boolean;
  onApply: () => void;
  onConfirmApplied: () => void;
  onCancelConfirm: () => void;
  onStash: () => void;
  onSkip: () => void;
}

// One target at a time, for quickly working through new jobs.
export function FocusMode(p: Props) {
  if (!p.job) {
    return (
      <div className="focus">
        <div className="focus-inner"><p className="empty">No targets left. Run a sweep, or press F to leave focus mode.</p></div>
      </div>
    );
  }
  const { job } = p;
  const preview = job.description.split(/\n\s*\n/).find((para) => para.trim().length > 80)?.trim() ?? job.description.slice(0, 600);
  const resume = p.resumes.find((r) => r.id === p.resumeId);

  return (
    <div className="focus">
      <section className="focus-inner" aria-label="Focus mode">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="label">Focus mode · target {p.position} of {p.total}</span>
          <span className="label">{p.sentToday}/{p.goal} sent today</span>
        </div>
        <div className="progress"><div style={{ width: `${(p.position / Math.max(p.total, 1)) * 100}%` }} /></div>

        <article className="focus-card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
            <div style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="muted">{job.company} · {job.location} · {job.source}, {ago(job.posted_at) || 'recently'} ago</span>
              <h1 className="focus-title">{job.title}</h1>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span className="focus-score">{job.score}</span>
              <span className="label">Match</span>
            </div>
          </div>
          <div className="chips">
            {job.matched.map((s) => <span key={s} className="chip chip-have">+ {s}</span>)}
            {job.missing.map((s) => <span key={s} className="chip chip-gap">− {s}</span>)}
          </div>
          {preview && <p className="reading" style={{ margin: 0, maxHeight: '10.5em', overflow: 'hidden' }}>{preview}</p>}
          <div className="muted">
            Sending <strong style={{ color: 'var(--text)' }}>{resume?.title ?? '—'} resume</strong> ·{' '}
            <a href={job.url} target="_blank" rel="noopener noreferrer">read full posting ↗</a>
          </div>
        </article>

        {p.confirming ? (
          <div className="confirm" role="alert">
            <span style={{ flex: '1 1 200px' }}>Did you apply with the <strong>{resume?.title}</strong> resume?</span>
            <button className="btn btn-primary" onClick={p.onConfirmApplied}>Yes <kbd>Y</kbd></button>
            <button className="btn" onClick={p.onCancelConfirm}>Not yet <kbd>N</kbd></button>
          </div>
        ) : (
          <div className="focus-actions">
            <button className="btn" onClick={p.onSkip}>Skip <kbd>X</kbd></button>
            <button className="btn" onClick={p.onStash}>Stash <kbd>S</kbd></button>
            <button className="btn btn-primary" onClick={p.onApply}>Apply ↗ <kbd>A</kbd></button>
          </div>
        )}
      </section>
    </div>
  );
}
