import { useState } from 'react';
import api from '../services/api';

interface Submission {
  id: string;
  file_path: string | null;
  note: string | null;
  status: string;
  grade: number | null;
  max_grade: number | null;
  feedback: string | null;
}

interface HomeworkItem {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  subject: { id: string; name: string; code: string };
  assigned_by_user: { id: string; name: string } | null;
  book?: { id: string; title: string; author: string } | null;
  my_submission?: Submission | null;
}

export default function HomeworkList({ homework, interactive = false, onChange }: {
  homework: HomeworkItem[];
  interactive?: boolean;
  onChange?: () => void;
}) {
  const today = new Date().toISOString().split('T')[0];

  const dueBadge = (dueDate: string) => {
    if (dueDate < today) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Past due</span>;
    if (dueDate === today) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Due today</span>;
    const diff = Math.ceil((new Date(dueDate).getTime() - new Date(today).getTime()) / 86400000);
    if (diff <= 2) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Due in {diff} day{diff > 1 ? 's' : ''}</span>;
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Due {dueDate}</span>;
  };

  const upcoming = homework.filter((h) => h.due_date >= today);
  const past = homework.filter((h) => h.due_date < today);

  if (homework.length === 0) {
    return <p className="text-gray-400 text-center py-8">No homework assigned yet</p>;
  }

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          {upcoming.map((hw) => (
            <div key={hw.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-indigo-50 text-indigo-700">{hw.subject.code}</span>
                  <h4 className="font-medium text-gray-900">{hw.title}</h4>
                </div>
                {dueBadge(hw.due_date)}
              </div>
              {hw.description && <p className="text-sm text-gray-600 mt-1">{hw.description}</p>}
              {hw.book && (
                <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" /></svg>
                  <span className="font-medium">{hw.book.title}</span>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {hw.subject.name}{hw.assigned_by_user ? ` • ${hw.assigned_by_user.name}` : ''}
              </p>
              {interactive && <SubmissionControl homeworkId={hw.id} submission={hw.my_submission || null} onChange={onChange} />}
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="group">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600 select-none">
            Past homework ({past.length})
          </summary>
          <div className="space-y-2 mt-2">
            {past.map((hw) => (
              <div key={hw.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-gray-50 text-gray-500">{hw.subject.code}</span>
                    <span className="text-sm text-gray-600">{hw.title}</span>
                  </div>
                  <span className="text-xs text-gray-400">{hw.due_date}</span>
                </div>
                {interactive && <SubmissionControl homeworkId={hw.id} submission={hw.my_submission || null} onChange={onChange} />}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function SubmissionControl({ homeworkId, submission, onChange }: {
  homeworkId: string;
  submission: Submission | null;
  onChange?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const graded = submission?.status === 'graded';

  const submit = async () => {
    setError('');
    if (!file && !note.trim()) { setError('Attach a file or write a note.'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append('file', file);
      if (note.trim()) fd.append('note', note.trim());
      await api.post(`/homework/${homeworkId}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setOpen(false); setFile(null); setNote('');
      onChange?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {graded ? (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <p className="text-sm font-medium text-green-800">
            Graded{submission!.grade !== null ? `: ${submission!.grade}${submission!.max_grade !== null ? `/${submission!.max_grade}` : ''}` : ''}
          </p>
          {submission!.feedback && <p className="text-xs text-green-700 mt-0.5">{submission!.feedback}</p>}
        </div>
      ) : submission ? (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Submitted</span>
            {submission.file_path && (
              <a href={`/uploads/${submission.file_path}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:text-indigo-800 text-xs">View file</a>
            )}
          </div>
          <button onClick={() => setOpen((v) => !v)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
            {open ? 'Cancel' : 'Resubmit'}
          </button>
        </div>
      ) : (
        <button onClick={() => setOpen((v) => !v)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          {open ? 'Cancel' : 'Submit work'}
        </button>
      )}

      {open && !graded && (
        <div className="mt-2 space-y-2">
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a note (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={submit} disabled={busy}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
            {busy ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  );
}
