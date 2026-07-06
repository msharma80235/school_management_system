import { useEffect, useState } from 'react';
import api from '../services/api';
import { TableSearch } from '../components/tableUtils';

interface TermMatch { term: string; category: string; count: number; }
interface ScanResult {
  id: string;
  source_type: string;
  source_id: string;
  title: string;
  file_path: string | null;
  status: 'clean' | 'review' | 'flagged';
  categories: string[];
  matches: TermMatch[];
  note: string | null;
  scanned_at: string;
  resolution: string | null;
  resolved_at: string | null;
}
interface Summary { total: number; flagged: number; review: number; clean: number; unresolved: number; }

const TYPE_LABELS: Record<string, string> = {
  book: 'Book', document: 'Document', exam_paper: 'Exam Paper',
  exam_questions: 'Exam Questions', student_photo: 'Student Photo', org_logo: 'Org Logo',
};

const typeColor: Record<string, string> = {
  book: 'bg-blue-100 text-blue-700', document: 'bg-cyan-100 text-cyan-700',
  exam_paper: 'bg-purple-100 text-purple-700', exam_questions: 'bg-violet-100 text-violet-700',
  student_photo: 'bg-emerald-100 text-emerald-700', org_logo: 'bg-amber-100 text-amber-700',
};

const catColor: Record<string, string> = {
  adult: 'bg-red-100 text-red-700', profanity: 'bg-rose-100 text-rose-700',
  violence: 'bg-orange-100 text-orange-700', substances: 'bg-amber-100 text-amber-700',
};

export default function ContentSafety() {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const fetchResults = async () => {
    const r = await api.get('/content-safety');
    setResults(r.data.results);
    setSummary(r.data.summary);
  };

  useEffect(() => { fetchResults(); }, []);

  const runScan = async () => {
    setScanning(true);
    setError('');
    try {
      const r = await api.post('/content-safety/scan');
      setSuccess(`${r.data.message} — ${r.data.summary.flagged} flagged, ${r.data.summary.review} for review, ${r.data.summary.clean} clean`);
      fetchResults();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const markSafe = async (r: ScanResult) => {
    if (!confirm(`Mark "${r.title}" as safe for kids and students?`)) return;
    try {
      const resp = await api.patch(`/content-safety/${r.id}/safe`);
      setSuccess(resp.data.message);
      fetchResults();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  const filtered = results.filter((r) => {
    const q = search.toLowerCase();
    return (!q || r.title.toLowerCase().includes(q)) &&
      (!statusFilter || r.status === statusFilter) &&
      (!typeFilter || r.source_type === typeFilter);
  });

  const statusBadge = (r: ScanResult) => {
    if (r.resolution === 'marked_safe') {
      return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Marked safe</span>;
    }
    if (r.status === 'flagged') return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Flagged</span>;
    if (r.status === 'review') return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Needs review</span>;
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">Clean</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Content Safety</h1>
          <p className="text-gray-500 text-sm mt-1">
            Every upload in your school, scanned for content inappropriate for kids and students
          </p>
        </div>
        <button onClick={runScan} disabled={scanning}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50">
          <svg className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          {scanning ? 'Scanning...' : 'Scan All Content'}
        </button>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
            <p className="text-xs text-gray-500 mt-0.5">Items scanned</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4">
            <p className="text-2xl font-bold text-red-600">{summary.flagged}</p>
            <p className="text-xs text-gray-500 mt-0.5">Flagged</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-amber-200 p-4">
            <p className="text-2xl font-bold text-amber-600">{summary.review}</p>
            <p className="text-xs text-gray-500 mt-0.5">Need manual review</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-4">
            <p className="text-2xl font-bold text-green-600">{summary.clean}</p>
            <p className="text-xs text-gray-500 mt-0.5">Clean</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <TableSearch value={search} onChange={setSearch} placeholder="Search content..." />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All statuses</option>
          <option value="flagged">Flagged</option>
          <option value="review">Needs review</option>
          <option value="clean">Clean</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {(search || statusFilter || typeFilter) && (
          <span className="text-sm text-gray-400">{filtered.length} of {results.length} shown</span>
        )}
      </div>

      {results.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-gray-400">No scan yet. Click "Scan All Content" to inventory and check every upload.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {filtered.map((r) => (
            <div key={r.id} className={`px-5 py-4 ${r.status === 'flagged' && !r.resolution ? 'bg-red-50/40' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeColor[r.source_type] || 'bg-gray-100 text-gray-600'}`}>
                      {TYPE_LABELS[r.source_type] || r.source_type}
                    </span>
                    <span className="font-medium text-gray-900 text-sm truncate">{r.title}</span>
                    {statusBadge(r)}
                  </div>
                  {r.note && <p className="text-xs text-gray-500 mt-1">{r.note}</p>}
                  {r.matches.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {[...new Set(r.categories)].map((c) => (
                        <span key={c} className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${catColor[c] || 'bg-gray-100 text-gray-600'}`}>{c}</span>
                      ))}
                      <span className="text-xs text-gray-400">
                        matched: {r.matches.slice(0, 5).map((m) => `"${m.term}"×${m.count}`).join(', ')}
                        {r.matches.length > 5 && ` +${r.matches.length - 5} more`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {r.file_path && (
                    <a href={`/uploads/${r.file_path}`} target="_blank" rel="noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">View file</a>
                  )}
                  {r.status !== 'clean' && !r.resolution && (
                    <button onClick={() => markSafe(r)}
                      className="px-3 py-1.5 border border-green-300 text-green-700 rounded-lg text-xs font-medium hover:bg-green-50 transition">
                      Mark Safe
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">No items match your filters</div>
          )}
        </div>
      )}
    </div>
  );
}
