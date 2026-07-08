import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Question {
  id: string;
  order: number;
  question_type: string;
  question_text: string;
  options: string[] | null;
  marks: number;
}

interface ResultQuestion extends Question {
  correct_answer: string | null;
  your_answer: string | null;
  is_correct: boolean | null;
  awarded: number;
}

export default function QuizTake() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'take' | 'result'>('take');
  const [examName, setExamName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ score: number; max_score: number; questions: ResultQuestion[] } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submittedRef = useRef(false);

  const loadResult = async () => {
    const r = await api.get(`/exams/${examId}/quiz/result`);
    setResult(r.data);
    setExamName(r.data.exam.name);
    setMode('result');
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(`/exams/${examId}/quiz`);
        setExamName(r.data.exam.name);
        setQuestions(r.data.questions);
        if (r.data.exam.time_limit_min && r.data.started_at) {
          const deadline = new Date(r.data.started_at).getTime() + r.data.exam.time_limit_min * 60000;
          setTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
        }
      } catch (err: any) {
        if (err.response?.data?.submitted) {
          await loadResult();
        } else {
          setError(err.response?.data?.error || 'Could not load quiz');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  const submit = async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true);
    setError('');
    try {
      await api.post(`/exams/${examId}/quiz/submit`, {
        answers: Object.entries(answers).map(([question_id, answer]) => ({ question_id, answer })),
      });
      await loadResult();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Submission failed');
      submittedRef.current = false;
    } finally {
      setBusy(false);
    }
  };

  // Countdown → auto-submit at zero
  useEffect(() => {
    if (timeLeft === null || mode !== 'take') return;
    if (timeLeft <= 0) { submit(); return; }
    const t = setTimeout(() => setTimeLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, mode]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  if (error && mode === 'take' && questions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-gray-500">{error}</p>
        <button onClick={() => navigate('/student/dashboard')} className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium">Back to dashboard</button>
      </div>
    );
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (mode === 'result' && result) {
    const pct = result.max_score ? Math.round((result.score / result.max_score) * 100) : 0;
    return (
      <div className="max-w-3xl mx-auto">
        <button onClick={() => navigate('/student/dashboard')} className="text-sm text-gray-500 hover:text-gray-700 mb-4">← Back to dashboard</button>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6 text-center">
          <h1 className="text-xl font-bold text-gray-900">{examName}</h1>
          <p className="text-4xl font-bold text-indigo-600 mt-3">{result.score} / {result.max_score}</p>
          <p className="text-gray-500 mt-1">{pct}%</p>
        </div>
        <div className="space-y-3">
          {result.questions.map((q) => {
            const correct = q.is_correct === true;
            const wrong = q.is_correct === false;
            return (
              <div key={q.id} className={`bg-white rounded-xl border p-4 ${correct ? 'border-green-200' : wrong ? 'border-red-200' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-gray-900 text-sm">{q.order}. {q.question_text}</p>
                  <span className="text-xs text-gray-500 shrink-0">{q.awarded}/{q.marks}</span>
                </div>
                <p className={`text-sm mt-2 ${correct ? 'text-green-700' : wrong ? 'text-red-700' : 'text-gray-600'}`}>
                  Your answer: {q.your_answer || <span className="italic text-gray-400">blank</span>}
                </p>
                {wrong && q.correct_answer && <p className="text-sm text-green-700">Correct answer: {q.correct_answer}</p>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <button onClick={() => navigate('/student/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          <h1 className="text-xl font-bold text-gray-900 mt-1">{examName}</h1>
        </div>
        {timeLeft !== null && (
          <span className={`px-3 py-1.5 rounded-lg font-mono text-sm font-medium ${timeLeft < 60 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
            ⏱ {mmss(timeLeft)}
          </span>
        )}
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="font-medium text-gray-900 text-sm">{q.order}. {q.question_text}</p>
              <span className="text-xs text-gray-400 shrink-0">{q.marks} mark{q.marks > 1 ? 's' : ''}</span>
            </div>
            {q.options ? (
              <div className="space-y-2">
                {q.options.map((opt) => (
                  <label key={opt} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${answers[q.id] === opt ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                      className="text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-gray-800">{opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <input type="text" value={answers[q.id] || ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder="Your answer"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      <div className="mt-6 flex justify-end">
        <button onClick={submit} disabled={busy}
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50">
          {busy ? 'Submitting…' : 'Submit quiz'}
        </button>
      </div>
    </div>
  );
}
