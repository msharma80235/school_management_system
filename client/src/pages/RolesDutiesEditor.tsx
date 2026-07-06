import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Section {
  heading: string;
  note?: string;
  duties: string[];
}

// Duties are edited as one textarea per section, one duty per line
interface EditSection {
  heading: string;
  note: string;
  dutiesText: string;
}

const ROLES = [
  { value: 'teacher', label: 'Teachers' },
  { value: 'student', label: 'Students' },
  { value: 'parent', label: 'Parents' },
  { value: 'volunteer', label: 'Volunteers' },
  { value: 'staff', label: 'Admin Staff' },
];

export default function RolesDutiesEditor() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('Roles & Responsibilities');
  const [sections, setSections] = useState<EditSection[]>([]);
  const [audience, setAudience] = useState<string[]>([]);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/roles-document').then((r) => {
      setTitle(r.data.title);
      setSections(r.data.sections.map((s: Section) => ({
        heading: s.heading,
        note: s.note || '',
        dutiesText: s.duties.join('\n'),
      })));
      setAudience(r.data.audience.split(','));
      setFilePath(r.data.file_path);
      setUpdatedAt(r.data.updated_at);
    }).finally(() => setLoading(false));
  }, []);

  const updateSection = (i: number, patch: Partial<EditSection>) => {
    setSections((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  };

  const moveSection = (i: number, dir: -1 | 1) => {
    setSections((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const removeSection = (i: number) => setSections((prev) => prev.filter((_, idx) => idx !== i));

  const addSection = () => setSections((prev) => [...prev, { heading: '', note: '', dutiesText: '' }]);

  const toggleRole = (role: string) => {
    setAudience((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) { setError('Title is required'); return; }
    if (audience.length === 0) { setError('Select at least one audience'); return; }

    const payload = {
      title: title.trim(),
      audience: audience.join(','),
      sections: sections.map((s) => ({
        heading: s.heading.trim(),
        note: s.note.trim() || undefined,
        duties: s.dutiesText.split('\n').map((d) => d.trim()).filter(Boolean),
      })).filter((s) => s.heading && s.duties.length > 0),
    };

    if (payload.sections.length === 0) {
      setError('Add at least one section with a heading and duties');
      return;
    }

    try {
      setSaving(true);
      const r = await api.put('/roles-document', payload);
      setFilePath(r.data.file_path);
      setUpdatedAt(new Date().toISOString());
      setSuccess('Saved — the published PDF has been regenerated');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <button onClick={() => navigate('/admin/documents')} className="hover:text-indigo-600">Documents</button>
        <span>/</span>
        <span className="text-gray-900 font-medium">Roles & Duties Editor</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Roles & Duties</h1>
          <p className="text-gray-500 text-sm mt-1">
            Changes regenerate the published PDF instantly.
            {updatedAt && <span> Last saved {new Date(updatedAt).toLocaleString()}.</span>}
          </p>
        </div>
        <div className="flex gap-3">
          {filePath && (
            <a href={`/uploads/${filePath}`} target="_blank" rel="noreferrer"
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition">
              View Current PDF
            </a>
          )}
          <button onClick={handleSave} disabled={saving}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50">
            {saving ? 'Publishing...' : 'Save & Publish'}
          </button>
        </div>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Title + audience */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Document Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Visible to</label>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <label key={r.value} className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg cursor-pointer text-sm transition ${
                audience.includes(r.value) ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
                <input type="checkbox" checked={audience.includes(r.value)} onChange={() => toggleRole(r.value)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                {r.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((s, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase">Section {i + 1}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => moveSection(i, -1)} disabled={i === 0}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30 rounded" title="Move up">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 disabled:opacity-30 rounded" title="Move down">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <button onClick={() => removeSection(i)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Remove section">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <input type="text" value={s.heading} onChange={(e) => updateSection(i, { heading: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900 font-semibold"
                placeholder="Role name — e.g. Class Teacher" />
              <input type="text" value={s.note} onChange={(e) => updateSection(i, { note: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-600 text-sm italic"
                placeholder="Optional note shown under the heading" />
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Duties — one per line</label>
                <textarea value={s.dutiesText} onChange={(e) => updateSection(i, { dutiesText: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900 text-sm font-mono"
                  rows={Math.max(4, s.dutiesText.split('\n').length)} placeholder={"Maintain daily attendance\nEnter exam marks on time"} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addSection}
        className="mt-4 w-full border-2 border-dashed border-gray-300 text-gray-500 py-3 rounded-xl text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 transition">
        + Add Section
      </button>
    </div>
  );
}
