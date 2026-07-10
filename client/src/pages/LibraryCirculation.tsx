import { useEffect, useState } from 'react';
import api from '../services/api';

interface Loan {
  id: string;
  due_date: string;
  issued_at: string;
  returned_at: string | null;
  fine: number;
  fine_paid: boolean;
  overdue_days: number;
  current_fine: number;
  book: { id: string; title: string; author: string };
  student: { id: string; first_name: string; last_name: string; roll_number: string };
}
interface Summary { outstanding: number; overdue: number; unpaid_fine_total: number; }
interface BookOpt { id: string; title: string; author: string; approval_status: string; }
interface StudentOpt { id: string; first_name: string; last_name: string; roll_number: string; }

const isoPlus = (d: number) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };

export default function LibraryCirculation() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState('active');
  const [books, setBooks] = useState<BookOpt[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [form, setForm] = useState({ book_id: '', student_id: '', due_date: isoPlus(14) });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async () => {
    const r = await api.get(`/library/loans${status ? `?status=${status}` : ''}`);
    setLoans(r.data.loans);
    setSummary(r.data.summary);
  };

  useEffect(() => { load(); }, [status]);
  useEffect(() => {
    api.get('/books').then((r) => setBooks(r.data.books.filter((b: BookOpt) => b.approval_status === 'approved'))).catch(() => {});
    api.get('/students?limit=1000').then((r) => setStudents(r.data.students)).catch(() => {});
  }, []);

  const flash = (m: string) => { setSuccess(m); setTimeout(() => setSuccess(''), 3000); };
  const fail = (m: string) => { setError(m); setTimeout(() => setError(''), 3500); };

  const issue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const r = await api.post('/library/issue', form);
      flash(r.data.message);
      setForm({ book_id: '', student_id: '', due_date: isoPlus(14) });
      load();
    } catch (err: any) {
      fail(err.response?.data?.error || 'Could not issue book');
    }
  };

  const returnBook = async (l: Loan) => {
    try { const r = await api.post(`/library/loans/${l.id}/return`); flash(r.data.message); load(); }
    catch (err: any) { fail(err.response?.data?.error || 'Failed'); }
  };
  const payFine = async (l: Loan) => {
    try { await api.patch(`/library/loans/${l.id}/pay-fine`); flash('Fine marked paid'); load(); }
    catch (err: any) { fail(err.response?.data?.error || 'Failed'); }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Library</h1>
        <p className="text-gray-500 text-sm mt-1">Issue and return books, track due dates and fines</p>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4"><p className="text-2xl font-bold text-gray-900">{summary.outstanding}</p><p className="text-xs text-gray-500 mt-0.5">Books out</p></div>
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4"><p className="text-2xl font-bold text-red-600">{summary.overdue}</p><p className="text-xs text-gray-500 mt-0.5">Overdue</p></div>
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-4"><p className="text-2xl font-bold text-amber-600">{summary.unpaid_fine_total}</p><p className="text-xs text-gray-500 mt-0.5">Unpaid fines</p></div>
        </div>
      )}

      {/* Issue form */}
      <form onSubmit={issue} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Book</label>
          <select value={form.book_id} onChange={(e) => setForm({ ...form, book_id: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Select book…</option>
            {books.map((b) => <option key={b.id} value={b.id}>{b.title} — {b.author}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">Student</label>
          <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Select student…</option>
            {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.roll_number})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Due date</label>
          <input type="date" value={form.due_date} min={today} onChange={(e) => setForm({ ...form, due_date: e.target.value })} required className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Issue</button>
      </form>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-4">
        {['active', 'overdue', 'returned', ''].map((s) => (
          <button key={s || 'all'} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${status === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="py-2.5 px-4 font-medium">Book</th>
              <th className="py-2.5 px-4 font-medium">Student</th>
              <th className="py-2.5 px-4 font-medium">Due</th>
              <th className="py-2.5 px-4 font-medium">Status</th>
              <th className="py-2.5 px-4 font-medium">Fine</th>
              <th className="py-2.5 px-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loans.map((l) => {
              const overdue = !l.returned_at && l.due_date < today;
              return (
                <tr key={l.id} className="border-b border-gray-50">
                  <td className="py-2.5 px-4"><span className="font-medium text-gray-900">{l.book.title}</span></td>
                  <td className="py-2.5 px-4 text-gray-700">{l.student.first_name} {l.student.last_name} <span className="text-gray-400 font-mono text-xs">{l.student.roll_number}</span></td>
                  <td className={`py-2.5 px-4 ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{l.due_date}{overdue && ` (${l.overdue_days}d late)`}</td>
                  <td className="py-2.5 px-4">
                    {l.returned_at ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">Returned</span>
                      : overdue ? <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Overdue</span>
                      : <span className="inline-flex px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Out</span>}
                  </td>
                  <td className="py-2.5 px-4">
                    {(l.returned_at ? l.fine : l.current_fine) > 0
                      ? <span className={l.fine_paid ? 'text-gray-400 line-through' : 'text-amber-700 font-medium'}>{l.returned_at ? l.fine : l.current_fine}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    {!l.returned_at && <button onClick={() => returnBook(l)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">Return</button>}
                    {l.returned_at && l.fine > 0 && !l.fine_paid && <button onClick={() => payFine(l)} className="text-amber-700 hover:text-amber-900 text-sm font-medium">Mark paid</button>}
                  </td>
                </tr>
              );
            })}
            {loans.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-400">No loans here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
