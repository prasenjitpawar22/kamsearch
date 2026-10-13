import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type View } from './api';
import type { FetchState, Job, JobSummary, Resume, Stats, Status } from './types';
import { useHotkeys } from './hooks';
import { DESKS, Rail, type Desk } from './components/Rail';
import { TopBar } from './components/TopBar';
import { TargetList } from './components/TargetList';
import { Dossier } from './components/Dossier';
import { FocusMode } from './components/FocusMode';
import { CommandPalette, type Command } from './components/CommandPalette';
import { FetchLog, Toast, type ToastState } from './components/Overlays';
import { Training } from './components/Training';
import { Config } from './components/Config';

type ListDesk = 'targets' | 'stash' | 'operations';
const VIEW: Record<ListDesk, View> = { targets: 'feed', stash: 'saved', operations: 'tracker' };
const STAYS: Record<ListDesk, Status[]> = {
  targets: ['new'],
  stash: ['saved'],
  operations: ['applied', 'interview', 'offer', 'rejected'],
};
const TITLES: Record<ListDesk, string> = { targets: 'TARGETS', stash: 'STASH', operations: 'OPERATIONS' };
const EMPTY: Record<ListDesk, string> = {
  targets: 'No new targets. Run a sweep, or loosen the filters in Config.',
  stash: 'Nothing stashed. Press S on a target to keep it for later.',
  operations: 'No applications yet. Targets you apply to show up here.',
};
const isList = (d: Desk): d is ListDesk => d in VIEW;

export function App() {
  const [desk, setDesk] = useState<Desk>('targets');
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [resumeId, setResumeId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [focus, setFocus] = useState(false);
  const [palette, setPalette] = useState(false);
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [fetchState, setFetchState] = useState<FetchState | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const deskRef = useRef(desk);
  deskRef.current = desk;

  const toast = useCallback((message: string, action?: ToastState['action']) => setToastState({ id: Date.now(), message, action }), []);
  const clearToast = useCallback(() => setToastState(null), []);
  const refreshStats = useCallback(() => api.stats().then(setStats).catch(() => {}), []);

  const loadList = useCallback(async (d: Desk, keepId?: string | null) => {
    if (!isList(d)) return;
    try {
      const list = await api.jobs(VIEW[d]);
      if (deskRef.current !== d) return;
      setJobs(list);
      setSelectedId((cur) => {
        const want = keepId ?? cur;
        return list.some((j) => j.id === want) ? want : (list[0]?.id ?? null);
      });
    } catch (err) {
      toast((err as Error).message);
    }
  }, [toast]);

  // ---------- data loading ----------

  useEffect(() => {
    api.resumes().then(setResumes).catch(() => {});
    refreshStats();
    const timer = setInterval(refreshStats, 60000);
    return () => clearInterval(timer);
  }, [refreshStats]);

  useEffect(() => {
    if (isList(desk)) loadList(desk);
    else setFocus(false);
  }, [desk, loadList]);

  useEffect(() => {
    setConfirming(false);
    if (!selectedId) return setJob(null);
    let cancelled = false;
    api.job(selectedId).then((j) => {
      if (cancelled) return;
      setJob(j);
      setResumeId(j.resume_id ?? resumes[0]?.id ?? '');
    }).catch((err) => toast(err.message));
    return () => {
      cancelled = true;
    };
    // Resumes load once at start; re-running on them would reset a manual loadout pick.
  }, [selectedId, toast]);

  // ---------- sweeping ----------

  const poll = useCallback(async () => {
    try {
      const s = await api.fetchState();
      setFetchState(s);
      if (s.running) setTimeout(poll, 2000);
      else {
        refreshStats();
        loadList(deskRef.current);
      }
    } catch {
      /* server restarting; the next manual sweep will reconnect */
    }
  }, [refreshStats, loadList]);

  useEffect(() => {
    api.fetchState().then((s) => {
      setFetchState(s);
      if (s.running) {
        setLogOpen(true);
        poll();
      }
    }).catch(() => {});
  }, [poll]);

  const sweep = async () => {
    try {
      await api.startFetch();
      setLogOpen(true);
      poll();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  // ---------- job actions ----------

  const selectedIndex = jobs.findIndex((j) => j.id === selectedId);
  const actionable = job && job.id === selectedId && (job.status === 'new' || job.status === 'saved') ? job : null;

  const moveOn = (id: string) => {
    const i = jobs.findIndex((j) => j.id === id);
    const next = jobs.filter((j) => j.id !== id);
    setJobs(next);
    setSelectedId(next[i]?.id ?? next[i - 1]?.id ?? null);
  };

  const changeStatus = async (status: Status, extra: { resumeId?: string; notes?: string } = {}) => {
    if (!job) return false;
    const id = job.id;
    try {
      const updated = await api.setStatus(id, status, extra);
      if (isList(desk) && STAYS[desk].includes(status)) {
        setJobs((list) => list.map((j) => (j.id === id ? updated : j)));
        setJob((j) => (j && j.id === id ? { ...j, ...updated } : j));
      } else {
        moveOn(id);
      }
      refreshStats();
      return true;
    } catch (err) {
      toast((err as Error).message);
      return false;
    }
  };

  const undoTo = (id: string, prev: Status) => async () => {
    await api.setStatus(id, prev);
    await loadList(deskRef.current, id);
    refreshStats();
  };

  const triage = async (status: 'saved' | 'skipped') => {
    if (!actionable || actionable.status === status) return;
    const { id, status: prev } = actionable;
    if (await changeStatus(status)) toast(status === 'saved' ? 'Stashed for later' : 'Skipped', { label: 'Undo', run: undoTo(id, prev) });
  };

  const apply = () => {
    if (!actionable) return;
    window.open(actionable.apply_url || actionable.url, '_blank', 'noopener,noreferrer');
    setConfirming(true);
  };

  const confirmApplied = async () => {
    if (!confirming) return;
    setConfirming(false);
    if (await changeStatus('applied', { resumeId })) toast('Marked applied. Follow-up reminder in 7 days.');
  };

  const block = async () => {
    if (!actionable) return;
    const company = actionable.company;
    try {
      const before = (await api.profile()).blockedCompanies || [];
      await api.blockCompany(company);
      await loadList(desk);
      refreshStats();
      toast(`${company} blocked`, {
        label: 'Undo',
        run: async () => {
          const profile = await api.profile();
          await api.saveProfile({ ...profile, blockedCompanies: before });
          loadList(deskRef.current);
          refreshStats();
        },
      });
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const move = (step: number) => {
    if (!jobs.length) return;
    const i = selectedIndex < 0 ? 0 : Math.min(jobs.length - 1, Math.max(0, selectedIndex + step));
    setSelectedId(jobs[i].id);
  };

  const goDesk = (d: Desk) => {
    setPalette(false);
    setDesk(d);
  };

  // ---------- keyboard ----------

  useHotkeys(
    {
      'mod+k': () => setPalette(true),
      escape: () => (confirming ? setConfirming(false) : logOpen ? setLogOpen(false) : focus ? setFocus(false) : undefined),
      ...Object.fromEntries(DESKS.map((d) => [d.key, () => goDesk(d.id)])),
      j: () => move(1),
      k: () => move(-1),
      arrowdown: () => isList(desk) && move(1),
      arrowup: () => isList(desk) && move(-1),
      a: apply,
      s: () => triage('saved'),
      x: () => triage('skipped'),
      b: block,
      y: confirmApplied,
      n: () => setConfirming(false),
      f: () => isList(desk) && setFocus((v) => !v),
    },
    !palette,
  );

  const commands = useMemo<Command[]>(
    () => [
      ...DESKS.map((d) => ({ id: `go-${d.id}`, label: `Go to ${d.label}`, hint: d.key, run: () => goDesk(d.id) })),
      { id: 'sweep', label: 'Run sweep now', run: sweep },
      { id: 'focus', label: focus ? 'Exit focus mode' : 'Enter focus mode', hint: 'F', run: () => { if (!isList(deskRef.current)) setDesk('targets'); setFocus(!focus); } },
      { id: 'log', label: 'Show sweep log', run: () => setLogOpen(true) },
      { id: 'rescore', label: 'Rescore all targets', run: async () => { toast(`Rescored ${(await api.rescore()).rescored} targets`); loadList(deskRef.current); } },
    ],
    [focus],
  );

  // ---------- render ----------

  const fetching = Boolean(fetchState?.running);
  const current = job && job.id === selectedId ? job : null;

  return (
    <div className="app">
      <TopBar
        stats={stats}
        focus={focus}
        fetching={fetching}
        onPalette={() => setPalette(true)}
        onFocus={() => { if (!isList(desk)) setDesk('targets'); setFocus(!focus); }}
        onSweep={sweep}
      />
      <div className="body">
        <Rail desk={desk} stats={stats} onDesk={goDesk} />
        <main className="desk">
          {isList(desk) && focus && (
            <FocusMode
              job={current}
              position={selectedIndex + 1}
              total={jobs.length}
              sentToday={stats?.appliedToday ?? 0}
              goal={stats?.dailyGoal ?? 5}
              resumes={resumes}
              resumeId={resumeId}
              confirming={confirming}
              onApply={apply}
              onConfirmApplied={confirmApplied}
              onCancelConfirm={() => setConfirming(false)}
              onStash={() => triage('saved')}
              onSkip={() => triage('skipped')}
            />
          )}

          {isList(desk) && !focus && (
            <>
              <div className="desk-head">
                <h1 className="desk-title">{TITLES[desk]}</h1>
                <span className="label">{jobs.length} {desk === 'targets' ? 'by match' : 'jobs'}{desk === 'targets' && stats?.blockedCount ? ` · ${stats.blockedCount} blocked` : ''}</span>
              </div>
              {desk === 'operations' && !!stats?.followUps.length && (
                <div className="followups">
                  <strong>{stats.followUps.length} application(s) over a week old. Follow up:</strong>
                  {stats.followUps.map((f) => (
                    <button key={f.id} className="chip" onClick={() => setSelectedId(f.id)}>{f.company}</button>
                  ))}
                </div>
              )}
              {jobs.length ? (
                <div className="split">
                  <TargetList jobs={jobs} selectedId={selectedId} resumes={resumes} showStatus={desk === 'operations'} onSelect={setSelectedId} />
                  {current ? (
                    <Dossier
                      job={current}
                      resumes={resumes}
                      resumeId={resumeId}
                      confirming={confirming}
                      onResume={setResumeId}
                      onApply={apply}
                      onConfirmApplied={confirmApplied}
                      onCancelConfirm={() => setConfirming(false)}
                      onStash={() => triage('saved')}
                      onSkip={() => triage('skipped')}
                      onBlock={block}
                      onStatus={(status, notes) => changeStatus(status, { notes })}
                      toast={toast}
                    />
                  ) : (
                    <section className="dossier"><p className="empty">Loading dossier…</p></section>
                  )}
                </div>
              ) : (
                <p className="empty">{EMPTY[desk]}</p>
              )}
            </>
          )}

          {!isList(desk) && (
            <div className="desk-head"><h1 className="desk-title">{desk.toUpperCase()}</h1></div>
          )}
          {desk === 'training' && <Training stats={stats} toast={toast} onDone={refreshStats} />}
          {desk === 'config' && <Config resumes={resumes} toast={toast} onSaved={refreshStats} />}
        </main>
      </div>

      {palette && <CommandPalette commands={commands} jobs={jobs} onPickJob={(id) => { setFocus(false); setSelectedId(id); }} onClose={() => setPalette(false)} />}
      {logOpen && <FetchLog log={fetchState?.log ?? []} running={fetching} onClose={() => setLogOpen(false)} />}
      {toastState && <Toast key={toastState.id} toast={toastState} onDone={clearToast} />}
    </div>
  );
}
