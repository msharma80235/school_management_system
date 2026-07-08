import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { TableSearch } from '../components/tableUtils';

interface Actor { id: string; name: string; email: string; }
interface LogEntry {
  id: string;
  org_id: string | null;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor: Actor | null;
}

// Colour by the action's domain prefix (user.*, org.*, content.*, account.*)
const domainColor: Record<string, string> = {
  user: 'bg-blue-100 text-blue-700',
  org: 'bg-purple-100 text-purple-700',
  content: 'bg-emerald-100 text-emerald-700',
  account: 'bg-amber-100 text-amber-700',
};

function domainOf(action: string) {
  return action.split('.')[0];
}

export default function AuditLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [domainFilter, setDomainFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const r = await api.get('/audit');
      setLogs(r.data.logs);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const domains = useMemo(() => [...new Set(logs.map((l) => domainOf(l.action)))].sort(), [logs]);

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    const haystack = `${l.action} ${l.summary || ''} ${l.actor?.name || ''} ${l.actor?.email || ''}`.toLowerCase();
    return (!q || haystack.includes(q)) && (!domainFilter || domainOf(l.action) === domainFilter);
  });

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-gray-500 text-sm mt-1">
            An append-only record of privileged actions — approvals, password resets, account and organization changes, and content-safety decisions.
          </p>
        </div>
        <button onClick={fetchLogs} disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50">
          <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <TableSearch value={search} onChange={setSearch} placeholder="Search actions, people..." />
        <select value={domainFilter} onChange={(e) => setDomainFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All categories</option>
          {domains.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {(search || domainFilter) && (
          <span className="text-sm text-gray-400">{filtered.length} of {logs.length} shown</span>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-400">No privileged actions recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
          {filtered.map((l) => (
            <div key={l.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${domainColor[domainOf(l.action)] || 'bg-gray-100 text-gray-600'}`}>
                    {domainOf(l.action)}
                  </span>
                  <span className="font-mono text-xs text-gray-500">{l.action}</span>
                </div>
                <p className="text-sm text-gray-900 mt-1">{l.summary || '—'}</p>
                {l.metadata && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{JSON.stringify(l.metadata)}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-gray-700">{l.actor?.name || 'Unknown / removed'}</p>
                {l.actor_role && <p className="text-[11px] text-gray-400 capitalize">{l.actor_role}</p>}
                <p className="text-[11px] text-gray-400 mt-0.5">{fmt(l.created_at)}</p>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">No entries match your filters</div>
          )}
        </div>
      )}
    </div>
  );
}
