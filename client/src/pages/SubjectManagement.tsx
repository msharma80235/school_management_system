import { useEffect, useState } from 'react';
import api from '../services/api';

interface Subject { id: string; name: string; code: string; }
interface ClassItem { id: string; name: string; section: string; }

export default function SubjectManagement() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showAssign, setShowAssign] = useState<ClassItem | null>(null);
  const [classSubjects, setClassSubjects] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', code: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetch = async () => {
    const [sRes, cRes] = await Promise.all([api.get('/subjects'), api.get('/classes')]);
    setSubjects(sRes.data.subjects);
    setClasses(cRes.data.classes);
  };
  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!form.name || !form.code) { setError('Name and code required'); return; }
    try {
      await api.post('/subjects', form);
      setSuccess('Subject created'); setShowModal(false); setForm({ name: '', code: '' }); fetch();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.error || 'Failed'); }
  };

  const handleDelete = async (s: Subject) => {
    if (!confirm(`Delete "${s.name}"?`)) return;
    try {
      await api.delete(`/subjects/${s.id}`); setSuccess('Subject deleted'); fetch();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.error || 'Failed'); setTimeout(() => setError(''), 3000); }
  };

  const openAssign = async (cls: ClassItem) => {
    setShowAssign(cls);
    const res = await api.get(`/subjects/class/${cls.id}`);
    setClassSubjects(res.data.subjects.map((s: Subject) => s.id));
  };

  const handleAssign = async () => {
    if (!showAssign) return;
    try {
      await api.post('/subjects/assign', { class_id: showAssign.id, subject_ids: classSubjects });
      setSuccess('Subjects assigned'); setShowAssign(null); setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.error || 'Failed'); }
  };

  const toggleSubject = (id: string) => {
    setClassSubjects((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
          <p className="text-gray-500 text-sm mt-1">Manage subjects and assign them to classes</p>
        </div>
        <button onClick={() => { setForm({ name: '', code: '' }); setShowModal(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Subject
        </button>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && !showModal && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subjects List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">All Subjects</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {subjects.map((s) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <span className="font-medium text-gray-900">{s.name}</span>
                  <span className="ml-2 text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{s.code}</span>
                </div>
                <button onClick={() => handleDelete(s)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
              </div>
            ))}
            {subjects.length === 0 && <div className="px-5 py-8 text-center text-gray-400">No subjects yet</div>}
          </div>
        </div>

        {/* Assign to Classes */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Assign Subjects to Classes</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {classes.map((c: any) => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <span className="font-medium text-gray-900">{c.name}{c.section ? ` - ${c.section}` : ''}</span>
                <button onClick={() => openAssign(c)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Manage Subjects</button>
              </div>
            ))}
            {classes.length === 0 && <div className="px-5 py-8 text-center text-gray-400">No classes yet</div>}
          </div>
        </div>
      </div>

      {/* Create Subject Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">Add Subject</h2></div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="e.g. Mathematics" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Code</label>
                <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900 font-mono"
                  placeholder="e.g. MATH" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Subjects Modal */}
      {showAssign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Assign Subjects</h2>
              <p className="text-sm text-gray-500">{showAssign.name}{showAssign.section ? ` - ${showAssign.section}` : ''}</p>
            </div>
            <div className="p-6 space-y-2 max-h-80 overflow-y-auto">
              {subjects.map((s) => (
                <label key={s.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <input type="checkbox" checked={classSubjects.includes(s.id)} onChange={() => toggleSubject(s.id)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-900">{s.name}</span>
                  <span className="text-xs font-mono text-gray-400">{s.code}</span>
                </label>
              ))}
              {subjects.length === 0 && <p className="text-gray-400 text-center py-4">Create subjects first</p>}
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowAssign(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
              <button onClick={handleAssign} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
