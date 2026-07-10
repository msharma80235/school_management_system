import { useEffect, useState } from 'react';
import api from '../services/api';

interface ExtraTerm { term: string; category: string; severity: 'flagged' | 'review'; }
interface Settings { extra_terms: ExtraTerm[]; muted_categories: string[]; block_review_uploads: boolean; updated_at: string | null; }
interface Adapters { malware: boolean; image: boolean; }
interface Report {
  scan: { total: number; flagged: number; review: number; clean: number; unresolved: number; malware_detected: number; last_scanned: string | null };
  adapters: Adapters;
  recent_exports: { id: string; scope: string; record_count: number; byte_size: number; created_at: string }[];
  recent_events: { action: string; summary: string; actor_role: string; at: string }[];
}

const fmtKB = (b: number) => `${Math.max(1, Math.round(b / 1024))} KB`;
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString() : '—');

export default function SafetySettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [adapters, setAdapters] = useState<Adapters>({ malware: false, image: false });
  const [report, setReport] = useState<Report | null>(null);
  const [newTerm, setNewTerm] = useState('');
  const [newSeverity, setNewSeverity] = useState<'flagged' | 'review'>('flagged');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [s, r] = await Promise.all([api.get('/safety/settings'), api.get('/safety/report')]);
    setSettings(s.data.settings);
    setCategories(s.data.categories);
    setAdapters(s.data.adapters);
    setReport(r.data);
  };
  useEffect(() => { load(); }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000); };

  const save = async (next: Settings) => {
    setSaving(true); setError('');
    try {
      const r = await api.put('/safety/settings', {
        extra_terms: next.extra_terms,
        muted_categories: next.muted_categories,
        block_review_uploads: next.block_review_uploads,
      });
      setSettings(r.data.settings);
      flash('Safety settings saved');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Save failed');
    } finally { setSaving(false); }
  };

  const addTerm = () => {
    if (!settings) return;
    const term = newTerm.trim().toLowerCase();
    if (!term) return;
    if (settings.extra_terms.some((t) => t.term === term)) { setError('That term is already in the list'); return; }
    save({ ...settings, extra_terms: [...settings.extra_terms, { term, category: 'custom', severity: newSeverity }] });
    setNewTerm('');
  };
  const removeTerm = (term: string) => {
    if (!settings) return;
    save({ ...settings, extra_terms: settings.extra_terms.filter((t) => t.term !== term) });
  };
  const toggleMute = (cat: string) => {
    if (!settings) return;
    const muted = settings.muted_categories.includes(cat)
      ? settings.muted_categories.filter((c) => c !== cat)
      : [...settings.muted_categories, cat];
    save({ ...settings, muted_categories: muted });
  };
  const toggleStrict = () => { if (settings) save({ ...settings, block_review_uploads: !settings.block_review_uploads }); };

  const exportData = async () => {
    setExporting(true); setError('');
    try {
      const res = await api.post('/safety/export', {}, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const a = document.createElement('a');
      const disp = res.headers['content-disposition'] || '';
      a.href = url;
      a.download = /filename="(.+?)"/.exec(disp)?.[1] || 'export.json';
      a.click();
      URL.revokeObjectURL(url);
      flash('Export downloaded');
      load();
    } catch {
      setError('Export failed');
    } finally { setExporting(false); }
  };

  if (!settings) return <div className="p-8 text-gray-400">Loading…</div>;

  const AdapterPill = ({ on, label, hint }: { on: boolean; label: string; hint: string }) => (
    <div className={`rounded-xl border p-4 ${on ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${on ? 'bg-green-500' : 'bg-gray-300'}`} />
        <span className="font-medium text-gray-900 text-sm">{label}</span>
        <span className={`ml-auto text-xs font-semibold ${on ? 'text-green-700' : 'text-gray-400'}`}>{on ? 'Active' : 'Not configured'}</span>
      </div>
      <p className="text-xs text-gray-500 mt-1.5">{hint}</p>
    </div>
  );

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Safety & Privacy</h1>
        <p className="text-gray-500 text-sm mt-1">
          Tune content safety for your school, see your protection posture, and export the data you own.
        </p>
      </div>

      {msg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{msg}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Protection posture */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Protection posture</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <AdapterPill on label="Upload content scanning" hint="Every upload is scanned for inappropriate text before it is saved." />
          <AdapterPill on={adapters.malware} label="Malware scanning" hint="Set AV_SCAN_CMD (e.g. ClamAV) to scan every uploaded file for viruses." />
          <AdapterPill on={adapters.image} label="Image analysis" hint="Set IMAGE_SCAN_CMD to auto-analyze uploaded images; otherwise they queue for review." />
          <AdapterPill on={settings.block_review_uploads} label="Strict uploads" hint="When on, borderline (review-level) uploads are blocked, not just queued." />
        </div>
        {report && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            {[
              { n: report.scan.total, l: 'Items scanned' },
              { n: report.scan.flagged, l: 'Flagged', c: 'text-red-600' },
              { n: report.scan.unresolved, l: 'Unresolved', c: 'text-amber-600' },
              { n: report.scan.malware_detected, l: 'Malware found', c: 'text-red-600' },
            ].map((s) => (
              <div key={s.l} className="bg-white rounded-xl border border-gray-200 p-3">
                <p className={`text-xl font-bold ${s.c || 'text-gray-900'}`}>{s.n}</p>
                <p className="text-xs text-gray-500">{s.l}</p>
              </div>
            ))}
          </div>
        )}
        {report?.scan.last_scanned && (
          <p className="text-xs text-gray-400 mt-2">Last content scan: {fmtDate(report.scan.last_scanned)}</p>
        )}
      </section>

      {/* Custom wordlist */}
      <section className="mb-8 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900">Custom blocked words</h2>
        <p className="text-sm text-gray-500 mt-1 mb-3">
          Add terms specific to your school. "Block" rejects uploads containing them; "Review" lets them through but queues them on Content Safety.
        </p>
        <div className="flex gap-2 flex-wrap mb-3">
          <input value={newTerm} onChange={(e) => setNewTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTerm()}
            placeholder="Add a word or phrase…"
            className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
          <select value={newSeverity} onChange={(e) => setNewSeverity(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="flagged">Block</option>
            <option value="review">Review</option>
          </select>
          <button onClick={addTerm} disabled={saving}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Add</button>
        </div>
        {settings.extra_terms.length === 0 ? (
          <p className="text-sm text-gray-400">No custom terms yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {settings.extra_terms.map((t) => (
              <span key={t.term} className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-sm ${t.severity === 'flagged' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                {t.term}
                <span className="text-[10px] uppercase font-semibold opacity-60">{t.severity === 'flagged' ? 'block' : 'review'}</span>
                <button onClick={() => removeTerm(t.term)} className="hover:bg-black/10 rounded-full w-4 h-4 flex items-center justify-center">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Category tuning + strict toggle */}
      <section className="mb-8 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900">Category tuning</h2>
        <p className="text-sm text-gray-500 mt-1 mb-3">Mute a built-in category if it fires on legitimate lesson material for your context.</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((c) => {
            const muted = settings.muted_categories.includes(c);
            return (
              <button key={c} onClick={() => toggleMute(c)} disabled={saving}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${muted ? 'bg-gray-100 text-gray-400 border-gray-200 line-through' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                {c}{muted ? ' (muted)' : ''}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={settings.block_review_uploads} onChange={toggleStrict} disabled={saving} className="w-4 h-4 accent-indigo-600" />
          <span className="text-sm text-gray-700">Block review-level uploads too (strict mode)</span>
        </label>
      </section>

      {/* Data export */}
      <section className="mb-8 bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-gray-900">Your data, exportable</h2>
            <p className="text-sm text-gray-500 mt-1">Download a full JSON backup of your school's records at any time. Passwords are never included.</p>
          </div>
          <button onClick={exportData} disabled={exporting}
            className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
            {exporting ? 'Exporting…' : 'Export all data'}
          </button>
        </div>
        {report && report.recent_exports.length > 0 && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent exports</p>
            <ul className="text-sm text-gray-600 space-y-1">
              {report.recent_exports.map((e) => (
                <li key={e.id} className="flex justify-between">
                  <span>{fmtDate(e.created_at)}</span>
                  <span className="text-gray-400">{e.record_count} records · {fmtKB(e.byte_size)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Safety audit trail */}
      {report && report.recent_events.length > 0 && (
        <section className="mb-8 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Recent safety activity</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            {report.recent_events.map((e, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate">{e.summary || e.action}</span>
                <span className="text-gray-400 shrink-0">{fmtDate(e.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
