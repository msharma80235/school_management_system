import { useEffect, useState } from 'react';
import api from '../services/api';

interface ClassItem { id: string; name: string; section: string; }
interface Assignment {
  id: string;
  assignment_type: string;
  details: string | null;
  class: ClassItem | null;
}
interface StaffMember {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  staff_assignments: Assignment[];
}

const PRESET_TYPES = [
  { value: 'class', label: 'Class Support' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'office', label: 'Office Work' },
  { value: '__custom__', label: 'Custom...' },
];

const typeColor: Record<string, string> = {
  class: 'bg-indigo-100 text-indigo-700',
  laboratory: 'bg-purple-100 text-purple-700',
  office: 'bg-blue-100 text-blue-700',
};

export default function StaffManagement() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '' });
  const [assignTo, setAssignTo] = useState<StaffMember | null>(null);
  const [assignType, setAssignType] = useState('class');
  const [customType, setCustomType] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignDetails, setAssignDetails] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchStaff = async () => {
    const r = await api.get('/users/staff');
    setStaff(r.data.staff);
  };

  useEffect(() => {
    fetchStaff();
    api.get('/classes').then((r) => setClasses(r.data.classes));
  }, []);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!createForm.name || !createForm.email || !createForm.password) {
      setError('All fields are required'); return;
    }
    try {
      await api.post('/users/staff', createForm);
      flash('Staff account created');
      setShowCreate(false);
      setCreateForm({ name: '', email: '', password: '' });
      fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!assignTo) return;
    const finalType = assignType === '__custom__' ? customType.trim() : assignType;
    if (!finalType) { setError('Enter the custom assignment type'); return; }
    if (assignType === 'class' && !assignClassId) { setError('Select the class'); return; }

    try {
      await api.post(`/users/staff/${assignTo.id}/assignments`, {
        assignment_type: finalType,
        class_id: assignType === 'class' ? assignClassId : null,
        details: assignDetails || null,
      });
      flash('Assignment added');
      setAssignTo(null);
      setAssignType('class'); setCustomType(''); setAssignClassId(''); setAssignDetails('');
      fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    await api.delete(`/users/staff/assignments/${assignmentId}`);
    flash('Assignment removed');
    fetchStaff();
  };

  const toggleStatus = async (s: StaffMember) => {
    await api.patch(`/users/staff/${s.id}/status`);
    flash(`Staff member ${s.is_active ? 'deactivated' : 'activated'}`);
    fetchStaff();
  };

  const assignmentLabel = (a: Assignment) => {
    if (a.assignment_type === 'class' && a.class) {
      return `Class: ${a.class.name}${a.class.section ? ' - ' + a.class.section : ''}`;
    }
    return a.assignment_type.charAt(0).toUpperCase() + a.assignment_type.slice(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administrative Staff</h1>
          <p className="text-gray-500 text-sm mt-1">Create staff accounts and assign them to classes, laboratories, office work, or custom duties</p>
        </div>
        <button onClick={() => { setError(''); setShowCreate(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Staff
        </button>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && !showCreate && !assignTo && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="space-y-4">
        {staff.map((s) => (
          <div key={s.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-100 text-cyan-700 rounded-full flex items-center justify-center font-bold">
                  {s.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                    {!s.is_active && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Inactive</span>}
                  </div>
                  <p className="text-sm text-gray-500">{s.email}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setAssignTo(s); setError(''); }} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Assign Duty</button>
                <button onClick={() => toggleStatus(s)}
                  className={`text-sm font-medium ${s.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>
                  {s.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>

            {s.staff_assignments.length > 0 ? (
              <div className="flex flex-wrap gap-2 ml-13">
                {s.staff_assignments.map((a) => (
                  <span key={a.id} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${typeColor[a.assignment_type] || 'bg-emerald-100 text-emerald-700'}`}>
                    {assignmentLabel(a)}
                    {a.details && <span className="opacity-70">— {a.details}</span>}
                    <button onClick={() => handleRemoveAssignment(a.id)} className="ml-1 opacity-50 hover:opacity-100" title="Remove">✕</button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 ml-13">No duties assigned yet</p>
            )}
          </div>
        ))}

        {staff.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-400">No staff accounts yet. Click "Add Staff" to create one.</p>
          </div>
        )}
      </div>

      {/* Create staff modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Add Staff Member</h2>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign duty modal */}
      {assignTo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Assign Duty</h2>
              <p className="text-sm text-gray-500 mt-1">{assignTo.name}</p>
            </div>
            <form onSubmit={handleAssign} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assignment Type</label>
                <select value={assignType} onChange={(e) => setAssignType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                  {PRESET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {assignType === '__custom__' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Type</label>
                  <input type="text" value={customType} onChange={(e) => setCustomType(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                    placeholder="e.g. Library, Transport, Canteen, Security" />
                </div>
              )}

              {assignType === 'class' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select value={assignClassId} onChange={(e) => setAssignClassId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select class...</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Details (optional)</label>
                <textarea value={assignDetails} onChange={(e) => setAssignDetails(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  rows={2} placeholder="e.g. Morning shift, assist with lab equipment setup" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAssignTo(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
