import { useEffect, useState } from 'react';
import type { Drafts, Job, Resume, Status } from '../types';
import { PIPELINE } from '../types';
import { api, ago } from '../api';

type Tab = 'brief' | 'posting' | 'comms';
const TABS: { id: Tab; label: string }[] = [
  { id: 'brief', label: 'BRIEF' },
  { id: 'posting', label: 'POSTING' },
  { id: 'comms', label: 'COMMS' },
];

interface Props {
  job: Job;
  resumes: Resume[];
  resumeId: string;
  confirming: boolean;
  onResume: (id: string) => void;
  onApply: () => void;
  onConfirmApplied: () => void;
  onCancelConfirm: () => void;
  onStash: () => void;
  onSkip: () => void;
  onBlock: () => void;
  onStatus: (status: Status, notes?: string) => void;
  toast: (msg: string) => void;
}

export function Meter({ score }: { score: number }) {
  const on = Math.round(score / 10);
  return (
    <div className="meter" role="img" aria-label={`Match ${score} out of 100`}>
      {Array.from({ length: 10 }, (_, i) => <span key={i} className={i < on ? 'on' : undefined} />)}
    </div>
  );
}

export function Dossier(props: Props) {
  const { job, resumes, resumeId, confirming } = props;
  const [tab, setTab] = useState<Tab>('brief');
  const inPipeline = PIPELINE.includes(job.status);
  const resume = resumes.find((r) => r.id === resumeId);

  return (
    <section className="dossier" aria-label="Target dossier">
      <div className="dossier-head">
        <div className="dossier-title-row">
          <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h2 className="dossier-title">{job.title}</h2>
            <span className="muted">
              {job.company} · {job.location || 'Location not listed'}{job.remote ? ' · Remote' : ''} · {job.source}, {ago(job.posted_at) || 'recently'} ago ·{' '}
              <a href={job.url} target="_blank" rel="noopener noreferrer">open posting ↗</a>
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <span className="label">Match <strong style={{ color: 'var(--accent)' }}>{job.score}</strong></span>
            <Meter score={job.score} />
          </div>
        </div>
        <div className="tabs" role="tablist" aria-label="Dossier sections">
          {TABS.map((t) => (
            <button key={t.id} role="tab" className="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="dossier-body">
        {confirming && (
          <div className="confirm" role="alert">
            <span style={{ flex: '1 1 200px' }}>Did you apply with the <strong>{resume?.title ?? 'selected'}</strong> resume?</span>
            <button className="btn btn-primary btn-small" onClick={props.onConfirmApplied}>Yes, mark applied <kbd>Y</kbd></button>
            <button className="btn btn-small" onClick={props.onCancelConfirm}>Not yet <kbd>N</kbd></button>
          </div>
        )}
        {tab === 'brief' && <Brief {...props} inPipeline={inPipeline} />}
        {tab === 'posting' && <Posting job={job} />}
        {tab === 'comms' && <Comms job={job} resumeId={resumeId} toast={props.toast} />}
      </div>

      {inPipeline ? (
        <div className="actionbar">
          <label className="row">
            <span className="label">Status</span>
            <select className="status-select" value={job.status} onChange={(e) => props.onStatus(e.target.value as Status)}>
              {PIPELINE.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <span className="muted" style={{ alignSelf: 'center' }}>Applied {ago(job.applied_at)} ago</span>
        </div>
      ) : (
        <div className="actionbar">
          <button className="btn btn-primary" onClick={props.onApply}>Apply ↗ <kbd>A</kbd></button>
          {job.status !== 'saved' && <button className="btn" onClick={props.onStash}>Stash <kbd>S</kbd></button>}
          <button className="btn" onClick={props.onSkip}>Skip <kbd>X</kbd></button>
          <button className="btn btn-danger push" onClick={props.onBlock}>Block {job.company} <kbd>B</kbd></button>
        </div>
      )}
    </section>
  );
}

function Brief({ job, resumes, resumeId, onResume, onStatus, inPipeline }: Props & { inPipeline: boolean }) {
  const [notes, setNotes] = useState(job.notes || '');
  useEffect(() => setNotes(job.notes || ''), [job.id, job.notes]);
  const resume = resumes.find((r) => r.id === resumeId);

  return (
    <>
      <div className="readout" aria-label="Skill match">
        {job.matched.map((s) => <span key={s} className="have">+ {s}</span>)}
        {job.missing.map((s) => <span key={s} className="gap">− {s} <span className="muted">→ drill in Training</span></span>)}
        {!job.matched.length && !job.missing.length && <span className="muted">No known skills found in the description.</span>}
      </div>

      {(job.extra?.experience || job.extra?.salary) && (
        <div className="row muted">
          {job.extra.experience && <span>Experience: <span style={{ color: 'var(--text)' }}>{job.extra.experience}</span></span>}
          {job.extra.salary && <span>Salary: <span style={{ color: 'var(--text)' }}>{job.extra.salary}</span></span>}
        </div>
      )}

      <div className="loadout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" />
        </svg>
        <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          Loadout
          <select value={resumeId} onChange={(e) => onResume(e.target.value)} disabled={inPipeline}>
            {resumes.map((r) => <option key={r.id} value={r.id}>{r.title} resume</option>)}
          </select>
        </label>
        {resume?.hasFile && <a href={`/resumes/${encodeURIComponent(resume.id)}`}>download</a>}
      </div>

      {inPipeline && (
        <div className="field">
          <span>Notes</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Who you talked to, interview dates, salary discussed…" />
          <div><button className="btn btn-small" onClick={() => onStatus(job.status, notes)}>Save notes</button></div>
        </div>
      )}

      <Contacts job={job} />
    </>
  );
}

function Contacts({ job, drafts }: { job: Job; drafts?: Drafts }) {
  const mailto = (email: string) => {
    const p = new URLSearchParams();
    if (drafts?.email?.subject) p.set('subject', drafts.email.subject);
    if (drafts?.email?.body) p.set('body', drafts.email.body);
    return `mailto:${email}?${p.toString().replace(/\+/g, '%20')}`;
  };
  return (
    <div className="stack" style={{ gap: 10 }}>
      <span className="label">Contacts</span>
      {job.contacts?.emails?.length ? (
        <div className="chips">{job.contacts.emails.map((e) => <a key={e} className="chip" href={mailto(e)}>{e}</a>)}</div>
      ) : (
        <span className="muted">No email in the posting. Search instead:</span>
      )}
      <div className="chips">
        {(job.contacts?.links || []).map((l) => (
          <a key={l.url} className="chip" href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>
        ))}
      </div>
    </div>
  );
}

function Posting({ job }: { job: Job }) {
  if (!job.description) {
    return <p className="muted">No description was fetched. <a href={job.url} target="_blank" rel="noopener noreferrer">Read it on the site ↗</a></p>;
  }
  return (
    <>
      <span className="label">
        <span style={{ color: 'var(--have)' }}>your skills</span> · <span style={{ color: 'var(--accent)' }}>gaps</span>
      </span>
      <div className="reading">
        {job.segments.map((s, i) =>
          s.kind ? <span key={i} className={s.kind === 'have' ? 'seg-have' : 'seg-gap'}>{s.t}</span> : s.t,
        )}
      </div>
    </>
  );
}

function Comms({ job, resumeId, toast }: { job: Job; resumeId: string; toast: (m: string) => void }) {
  const [drafts, setDrafts] = useState<Drafts>(job.drafts || {});
  const [busy, setBusy] = useState<'draft' | 'tailor' | null>(null);
  useEffect(() => setDrafts(job.drafts || {}), [job.id, job.drafts]);

  const run = async (kind: 'draft' | 'tailor') => {
    setBusy(kind);
    try {
      if (kind === 'draft') setDrafts({ ...drafts, ...(await api.draft(job.id, resumeId)) });
      else setDrafts({ ...drafts, tailoring: (await api.tailor(job.id, resumeId)).advice });
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  };

  const blocks: [string, string | undefined][] = [
    ['Cover note', drafts.coverNote],
    [`LinkedIn note · ${drafts.linkedinNote?.length ?? 0}/300`, drafts.linkedinNote],
    [`Email · ${drafts.email?.subject ?? ''}`, drafts.email?.body],
    ['Follow-up · send after 7 days', drafts.followUp],
  ];

  return (
    <>
      <div className="row">
        <button className="btn btn-soft" onClick={() => run('draft')} disabled={busy !== null}>
          {busy === 'draft' ? 'Writing… (~30s)' : drafts.coverNote ? 'Rewrite messages' : 'Draft messages'}
        </button>
        <button className="btn btn-soft" onClick={() => run('tailor')} disabled={busy !== null}>
          {busy === 'tailor' ? 'Reviewing… (~30s)' : 'Tailor my resume'}
        </button>
      </div>

      {drafts.coverNote && blocks.map(([title, text]) => text && (
        <div className="draft" key={title}>
          <div className="draft-head">
            <span className="label">{title}</span>
            <button className="btn btn-small" onClick={() => copy(text)}>Copy</button>
          </div>
          <div className="reading">{text}</div>
        </div>
      ))}

      {drafts.tailoring && (
        <div className="draft">
          <span className="label">Resume tailoring</span>
          <div className="reading">{drafts.tailoring}</div>
        </div>
      )}

      <Contacts job={job} drafts={drafts} />
    </>
  );
}
