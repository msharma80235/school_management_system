import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  roll_number: string;
  class?: { name: string; section: string };
  is_active?: boolean;
}

interface Parent {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  has_active_students: boolean;
  students: Student[];
}

export default function ParentManagement() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState<Parent | null>(null);
  const [linkStudentId, setLinkStudentId] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', student_ids: [] as string[] });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchParents = async () => {
    const res = await api.get('/parents');
    setParents(res.data.parents);
    setTotal(res.data.pagination.total);
  };

  const fetchStudents = async () => {
    const res = await api.get('/students?limit=200');
    setAllStudents(res.data.students);
  };

  useEffect(() => { fetchParents(); fetchStudents(); }, []);

  const resetForm = () => { setForm({ name: '', email: '', password: '', student_ids: [] }); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (!form.name || !form.email || !form.password) {
        setError('Name, email, and password are required');
        return;
      }
      await api.post('/parents', form);
      setSuccess('Parent account created');
      setShowModal(false);
      resetForm();
      fetchParents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const handleLink = async () => {
    if (!showLinkModal || !linkStudentId) return;
    try {
      await api.post(`/parents/${showLinkModal.id}/link`, { student_id: linkStudentId });
      setSuccess('Student linked');
      setShowLinkModal(null);
      setLinkStudentId('');
      fetchParents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Link failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleUnlink = async (parentId: string, studentId: string) => {
    try {
      await api.delete(`/parents/${parentId}/unlink/${studentId}`);
      setSuccess('Student unlinked');
      fetchParents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Unlink failed');
    }
  };

  const toggleStudentSelection = (id: string) => {
    setForm((prev) => ({
      ...prev,
      student_ids: prev.student_ids.includes(id)
        ? prev.student_ids.filter((s) => s !== id)
        : [...prev.student_ids, id],
    }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parent Accounts</h1>
          <p className="text-gray-500 text-sm mt-1">{total} parent{total !== 1 ? 's' : ''} registered</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Parent
        </button>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && !showModal && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="space-y-4">
        {parents.map((p) => (
          // Parents with no active enrolled student are greyed out
          <div key={p.id} className={`rounded-xl shadow-sm border p-5 ${p.has_active_students ? 'bg-white border-gray-200' : 'bg-gray-100 border-gray-200 opacity-75'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${p.has_active_students ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-500'}`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <Link to={`/admin/parents/${p.id}`} className={`hover:underline ${p.has_active_students ? 'text-gray-900 hover:text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>{p.name}</Link>
                    {!p.has_active_students && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">No active enrolled student</span>
                    )}
                  </h3>
                  <p className={`text-sm ${p.has_active_students ? 'text-gray-500' : 'text-gray-400'}`}>{p.email}</p>
                </div>
              </div>
              <button onClick={() => { setShowLinkModal(p); setLinkStudentId(''); }}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                Link Student
              </button>
            </div>

            {p.students.length > 0 ? (
              <div className="ml-13">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Linked Children</p>
                <div className="space-y-2">
                  {p.students.map((s) => (
                    <div key={s.id} className={`flex items-center justify-between rounded-lg px-4 py-2 ${s.is_active === false ? 'bg-gray-100' : 'bg-gray-50'}`}>
                      <div>
                        <span className={`font-medium ${s.is_active === false ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{s.first_name} {s.last_name}</span>
                        <span className="text-sm text-gray-500 ml-2">({s.roll_number})</span>
                        {s.class && <span className="text-sm text-gray-400 ml-2">- {s.class.name} {s.class.section}</span>}
                        {s.is_active === false && (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">Not enrolled</span>
                        )}
                      </div>
                      <button onClick={() => handleUnlink(p.id, s.id)} className="text-xs text-red-500 hover:text-red-700">Unlink</button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 ml-13">No children linked yet — no active enrolled student under this parent</p>
            )}
          </div>
        ))}

        {parents.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-400">No parent accounts yet. Create one and link students to it.</p>
          </div>
        )}
      </div>

      {/* Create Parent Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Add Parent Account</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Link Students (optional)</label>
                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {allStudents.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox" checked={form.student_ids.includes(s.id)} onChange={() => toggleStudentSelection(s.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700">{s.first_name} {s.last_name} ({s.roll_number})</span>
                    </label>
                  ))}
                  {allStudents.length === 0 && <p className="text-sm text-gray-400 text-center py-2">No students available</p>}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link Student Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Link Student to {showLinkModal.name}</h2>
            </div>
            <div className="p-6 space-y-4">
              <select value={linkStudentId} onChange={(e) => setLinkStudentId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900">
                <option value="">Select a student...</option>
                {allStudents
                  .filter((s) => !showLinkModal.students.some((ps) => ps.id === s.id))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.roll_number})</option>
                  ))}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setShowLinkModal(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                <button onClick={handleLink} disabled={!linkStudentId} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50">Link</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
