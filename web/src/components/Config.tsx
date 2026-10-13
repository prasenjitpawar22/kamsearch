import { useEffect, useState } from 'react';
import type { Profile, Resume, Search } from '../types';
import { api } from '../api';

const SOURCES = ['linkedin', 'naukri', 'greenhouse', 'lever', 'ashby'];
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

interface Props {
  resumes: Resume[];
  toast: (m: string) => void;
  onSaved: () => void;
}

export function Config({ resumes, toast, onSaved }: Props) {
  const [p, setP] = useState<Profile | null>(null);
  const [text, setText] = useState({ exclude: '', require: '', locIn: '', locOut: '' });
  const [blockInput, setBlockInput] = useState('');

  useEffect(() => {
    api.profile().then((profile) => {
      setP(profile);
      setText({
        exclude: (profile.excludeTitleWords || []).join(', '),
        require: (profile.requireTitleWords || []).join(', '),
        locIn: (profile.locationInclude || []).join(', '),
        locOut: (profile.locationExclude || []).join(', '),
      });
    }).catch((err) => toast(err.message));
  }, [toast]);

  if (!p) return <p className="muted">Loading…</p>;

  const set = (patch: Partial<Profile>) => setP({ ...p, ...patch });
  const setMe = (patch: NonNullable<Profile['me']>) => set({ me: { ...p.me, ...patch } });
  const setSearch = (i: number, patch: Partial<Search>) => set({ searches: p.searches.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const num = (v: string) => Math.max(0, Number(v) || 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.saveProfile({
        ...p,
        searches: p.searches.filter((s) => s.keywords.trim()),
        excludeTitleWords: list(text.exclude),
        requireTitleWords: list(text.require),
        locationInclude: list(text.locIn),
        locationExclude: list(text.locOut),
      });
      toast('Config saved');
      onSaved();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const addBlock = () => {
    const name = blockInput.trim();
    if (name) set({ blockedCompanies: [...(p.blockedCompanies || []), name] });
    setBlockInput('');
  };

  return (
    <form className="stack" onSubmit={save}>
      <section className="card">
        <h2 className="label">Operator</h2>
        <div className="grid3">
          <label className="field"><span>Name</span><input value={p.me?.name ?? ''} onChange={(e) => setMe({ name: e.target.value })} /></label>
          <label className="field"><span>Years of experience</span><input type="number" min={0} value={p.me?.experienceYears ?? 0} onChange={(e) => setMe({ experienceYears: num(e.target.value) })} /></label>
          <label className="field"><span>Hunt started</span><input type="date" value={p.me?.huntStartedOn ?? ''} onChange={(e) => setMe({ huntStartedOn: e.target.value })} /></label>
        </div>
        <label className="field"><span>Your pitch</span><textarea value={p.me?.pitch ?? ''} onChange={(e) => setMe({ pitch: e.target.value })} /><span className="hint">One or two lines in your own words. Used when drafting messages.</span></label>
      </section>

      <section className="card">
        <h2 className="label">Sweep</h2>
        {p.searches.map((s, i) => (
          <div className="search-row" key={i}>
            <input aria-label="Keywords" placeholder="Keywords, e.g. react developer" value={s.keywords} onChange={(e) => setSearch(i, { keywords: e.target.value })} />
            <input aria-label="Location" placeholder="Location, e.g. Pune, Maharashtra, India" value={s.location} onChange={(e) => setSearch(i, { location: e.target.value })} />
            <label className="check"><input type="checkbox" checked={!!s.remote} onChange={(e) => setSearch(i, { remote: e.target.checked || undefined })} /> Remote</label>
            <button type="button" className="btn btn-small" onClick={() => set({ searches: p.searches.filter((_, j) => j !== i) })}>Remove</button>
          </div>
        ))}
        <div><button type="button" className="btn btn-small" onClick={() => set({ searches: [...p.searches, { keywords: '', location: '' }] })}>+ Add search</button></div>
        <div className="row">
          {SOURCES.map((src) => (
            <label key={src} className="check">
              <input type="checkbox" checked={p.sources?.[src] !== false} onChange={(e) => set({ sources: { ...p.sources, [src]: e.target.checked } })} /> {src}
            </label>
          ))}
        </div>
        <div className="grid3">
          <label className="field"><span>Auto-sweep every (hours)</span><input type="number" min={0} value={p.fetchEveryHours ?? 0} onChange={(e) => set({ fetchEveryHours: num(e.target.value) })} /><span className="hint">0 = off</span></label>
          <label className="field"><span>Max job age (days)</span><input type="number" min={1} value={p.maxAgeDays ?? 3} onChange={(e) => set({ maxAgeDays: num(e.target.value) })} /></label>
          <label className="field"><span>Pages per search</span><input type="number" min={1} value={p.pagesPerSearch ?? 2} onChange={(e) => set({ pagesPerSearch: Math.max(1, num(e.target.value)) })} /></label>
          <label className="field"><span>Daily apply goal</span><input type="number" min={1} value={p.dailyGoal ?? 5} onChange={(e) => set({ dailyGoal: Math.max(1, num(e.target.value)) })} /></label>
          <label className="field"><span>Hide targets under</span><input type="number" min={0} max={100} value={p.minScore ?? 0} onChange={(e) => set({ minScore: num(e.target.value) })} /></label>
        </div>
      </section>

      <section className="card">
        <h2 className="label">Filters</h2>
        <div className="field">
          <span>Never show these companies</span>
          <div className="chips">
            {(p.blockedCompanies || []).map((c) => (
              <button type="button" key={c} className="chip" aria-label={`Unblock ${c}`} onClick={() => set({ blockedCompanies: p.blockedCompanies!.filter((x) => x !== c) })}>{c} ×</button>
            ))}
          </div>
          <div className="row">
            <input aria-label="Company to block" placeholder="Company name" value={blockInput} onChange={(e) => setBlockInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBlock(); } }} />
            <button type="button" className="btn btn-small" onClick={addBlock}>Block</button>
          </div>
        </div>
        <label className="field"><span>Skip titles containing</span><input value={text.exclude} onChange={(e) => setText({ ...text, exclude: e.target.value })} /><span className="hint">Comma separated</span></label>
        <label className="field"><span>Only titles containing</span><input value={text.require} onChange={(e) => setText({ ...text, require: e.target.value })} /><span className="hint">Optional, comma separated</span></label>
        <label className="field"><span>Career-board locations to keep</span><input value={text.locIn} onChange={(e) => setText({ ...text, locIn: e.target.value })} /></label>
        <label className="field"><span>Career-board locations to drop</span><input value={text.locOut} onChange={(e) => setText({ ...text, locOut: e.target.value })} /></label>
      </section>

      <div><button className="btn btn-primary">Save config</button></div>

      <section className="card">
        <h2 className="label">Loadouts (resumes)</h2>
        <p className="muted" style={{ margin: 0 }}>Edit resumes/resumes.json to add resumes or change their keywords, then rescore.</p>
        <table>
          <thead><tr><th>RESUME</th><th>FILE</th><th>TEXT COPY</th><th>KEYWORDS</th></tr></thead>
          <tbody>
            {resumes.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.hasFile ? '✓' : <span className="wrong">missing {r.file}</span>}</td>
                <td>{r.hasText ? '✓' : <span className="wrong">missing {r.textFile}</span>}</td>
                <td className="muted">{r.keywords.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <button type="button" className="btn btn-small" onClick={async () => toast(`Rescored ${(await api.rescore()).rescored} targets`)}>Rescore all targets</button>
        </div>
      </section>
    </form>
  );
}
