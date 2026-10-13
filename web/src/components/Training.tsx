import { useEffect, useState } from 'react';
import type { QuizHistoryRow, QuizQuestion, QuizResult, Stats } from '../types';
import { api, ago } from '../api';

interface Props {
  stats: Stats | null;
  toast: (m: string) => void;
  onDone: () => void;
}

export function Training({ stats, toast, onDone }: Props) {
  const [skill, setSkill] = useState('');
  const [level, setLevel] = useState('intermediate');
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<(string | number | null)[]>([]);
  const [graded, setGraded] = useState<{ score: number; total: number; results: QuizResult[] } | null>(null);
  const [busy, setBusy] = useState<'quiz' | 'grade' | null>(null);
  const [history, setHistory] = useState<QuizHistoryRow[]>([]);

  useEffect(() => {
    api.quizHistory().then(setHistory).catch(() => {});
  }, []);

  const start = async (s: string) => {
    const name = s.trim();
    if (!name) return;
    setSkill(name);
    setQuestions(null);
    setGraded(null);
    setBusy('quiz');
    try {
      const { questions } = await api.quiz(name, level);
      setQuestions(questions);
      setAnswers(questions.map(() => null));
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const grade = async () => {
    if (!questions) return;
    setBusy('grade');
    try {
      setGraded(await api.grade(skill, questions, answers));
      setHistory(await api.quizHistory());
      onDone();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const chip = (d: { skill: string; count: number }) => (
    <button key={d.skill} className="chip" onClick={() => start(d.skill)}>{d.skill} · {d.count}</button>
  );

  return (
    <div className="stack">
      <section className="card">
        <h2 className="label">Gaps employers keep asking for</h2>
        <p className="muted" style={{ margin: 0 }}>Skills in your targets that your resumes don't show. Pick one to drill.</p>
        <div className="chips">{stats?.gaps.length ? stats.gaps.map(chip) : <span className="muted">Run a sweep first.</span>}</div>
        <h2 className="label">Most requested overall</h2>
        <div className="chips">{stats?.demand.map(chip)}</div>
      </section>

      <section className="card">
        <h2 className="label">Drill</h2>
        <form className="row" onSubmit={(e) => { e.preventDefault(); start(skill); }}>
          <input aria-label="Skill" placeholder="Skill, e.g. react hooks, system design" value={skill} onChange={(e) => setSkill(e.target.value)} style={{ flex: '1 1 260px' }} />
          <select aria-label="Level" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="junior">Junior</option>
            <option value="intermediate">Intermediate</option>
            <option value="senior">Senior</option>
          </select>
          <button className="btn btn-primary" disabled={busy !== null}>{busy === 'quiz' ? 'Writing… (~30s)' : 'Start drill'}</button>
        </form>

        {questions && questions.map((q, i) => {
          const r = graded?.results[i];
          return (
            <div className="quiz-q" key={i}>
              <strong>{i + 1}. {q.q}</strong>
              {q.type === 'mcq' ? (
                q.options?.map((o, k) => (
                  <label key={k}>
                    <input type="radio" name={`q${i}`} checked={answers[i] === k} disabled={!!graded} onChange={() => setAnswers(answers.map((a, j) => (j === i ? k : a)))} />
                    <span>{o}</span>
                  </label>
                ))
              ) : (
                <textarea className="input" placeholder="Answer like you would in an interview" value={(answers[i] as string) ?? ''} disabled={!!graded} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
              )}
              {r && (
                <div className="stack" style={{ gap: 4 }}>
                  <span className={r.correct ? 'right' : 'wrong'}>{r.correct ? '✓ Correct' : '✗ Not quite'}</span>
                  <span><span className="muted">Answer: </span>{q.type === 'mcq' ? q.options?.[q.answer as number] : q.answer}</span>
                  {r.feedback && <span className="muted">{r.feedback}</span>}
                </div>
              )}
            </div>
          );
        })}
        {questions && !graded && (
          <div><button className="btn btn-primary" onClick={grade} disabled={busy !== null}>{busy === 'grade' ? 'Grading…' : 'Submit answers'}</button></div>
        )}
        {graded && (
          <p style={{ margin: 0 }}>
            <strong>Score {graded.score}/{graded.total}.</strong>{' '}
            <span className="muted">{graded.score < graded.total ? 'Drill this again in a couple of days.' : 'Clean run.'}</span>
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="label">History</h2>
        {history.length ? (
          <table>
            <thead><tr><th>SKILL</th><th>SCORE</th><th>WHEN</th></tr></thead>
            <tbody>{history.map((h) => <tr key={h.id}><td>{h.skill}</td><td>{h.score}/{h.total}</td><td>{ago(h.taken_at)} ago</td></tr>)}</tbody>
          </table>
        ) : <span className="muted">No drills yet.</span>}
      </section>
    </div>
  );
}
