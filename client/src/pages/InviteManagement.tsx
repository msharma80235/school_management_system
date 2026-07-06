import { useEffect, useState } from 'react';
import api from '../services/api';
import { useSort, SortHeader, TableSearch } from '../components/tableUtils';

interface StudentRef { id: string; first_name: string; last_name: string; roll_number: string; user_id?: string | null; }
interface Invite {
  id: string; code: string; role: string; email: string | null; name: string | null;
  subject: string | null; state: string; expires_at: string; created_at: string;
  student: StudentRef | null;
  creator: { id: string; name: string } | null;
}

const ROLES = [
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'staff', label: 'Admin Staff' },
];

const roleColor: Record<string, string> = {
  teacher: 'bg-blue-100 text-blue-700', student: 'bg-emerald-100 text-emerald-700',
  parent: 'bg-amber-100 text-amber-700', volunteer: 'bg-teal-100 text-teal-700',
  staff: 'bg-cyan-100 text-cyan-700',
};

const stateColor: Record<string, string> = {
  pending: 'bg-indigo-100 text-indigo-700', accepted: 'bg-green-100 text-green-700',
  revoked: 'bg-gray-100 text-gray-500', expired: 'bg-red-100 text-red-700',
};

export default function InviteManagement() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [students, setStudents] = useState<StudentRef[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ role: 'teacher', name: '', email: '', subject: '', student_id: '' });
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedId, setCopiedId] = useState('');

  const fetchInvites = async () => {
    const r = await api.get('/invites');
    setInvites(r.data.invites);
  };

  useEffect(() => {
    fetchInvites();
    api.get('/students?limit=200').then((r) => setStudents(r.data.students));
  }, []);

  const filtered = invites.filter((i) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || i.code.toLowerCase().includes(q) || (i.name || '').toLowerCase().includes(q)
      || (i.email || '').toLowerCase().includes(q) || i.role.includes(q);
    const matchesState = !stateFilter || i.state === stateFilter;
    return matchesSearch && matchesState;
  });
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'created_at', 'desc');

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.role === 'student' && !form.student_id) { setError('Select the student this invite is for'); return; }
    try {
      await api.post('/invites', {
        role: form.role,
        name: form.name || undefined,
        email: form.email || undefined,
        subject: form.role === 'teacher' ? form.subject || undefined : undefined,
        student_id: ['student', 'parent'].includes(form.role) ? form.student_id || undefined : undefined,
      });
      flash('Invitation created');
      setShowModal(false);
      setForm({ role: 'teacher', name: '', email: '', subject: '', student_id: '' });
      fetchInvites();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create invitation');
    }
  };

  const copyLink = (invite: Invite) => {
    const link = `${window.location.origin}/join/${invite.code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const handleRevoke = async (invite: Invite) => {
    if (!confirm(`Revoke the ${invite.role} invitation ${invite.code}?`)) return;
    await api.delete(`/invites/${invite.id}`);
    flash('Invitation revoked');
    fetchInvites();
  };

  const loginlessStudents = students.filter((s) => !s.user_id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invitations</h1>
          <p className="text-gray-500 text-sm mt-1">Registration is invite-only — create an invite and share the link or code</p>
        </div>
        <button onClick={() => { setError(''); setShowModal(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          New Invitation
        </button>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && !showModal && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="flex items-center gap-3 mb-4">
        <TableSearch value={search} onChange={setSearch} placeholder="Search code, name, email, role..." />
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All states</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader label="Code" k="code" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Role" k="role" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="For" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Expires" k="expires_at" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Status" k="state" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-mono text-sm font-bold text-gray-900">{inv.code}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${roleColor[inv.role]}`}>{inv.role}</span>
                  {inv.subject && <span className="ml-1 text-xs text-gray-400">{inv.subject}</span>}
                </td>
                <td className="px-5 py-3 text-sm text-gray-600">
                  {inv.name || <span className="text-gray-300">anyone</span>}
                  {inv.email && <div className="text-xs text-gray-400">{inv.email}</div>}
                  {inv.student && <div className="text-xs text-indigo-500">↳ {inv.student.first_name} {inv.student.last_name} ({inv.student.roll_number})</div>}
                </td>
                <td className="px-5 py-3 text-sm text-gray-600">{new Date(inv.expires_at).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${stateColor[inv.state]}`}>{inv.state}</span>
                </td>
                <td className="px-5 py-3 text-right space-x-3 whitespace-nowrap">
                  {inv.state === 'pending' && (
                    <>
                      <button onClick={() => copyLink(inv)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                        {copiedId === inv.id ? 'Copied!' : 'Copy Link'}
                      </button>
                      <button onClick={() => handleRevoke(inv)} className="text-red-600 hover:text-red-800 text-sm font-medium">Revoke</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No invitations yet. Create one to onboard teachers, students, parents, volunteers, or staff.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create invite modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">New Invitation</h2>
              <p className="text-sm text-gray-500 mt-0.5">Valid for 7 days. Share the link or the code.</p>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value, student_id: '' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {form.role === 'teacher' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                    placeholder="e.g. Mathematics" />
                </div>
              )}

              {form.role === 'student' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Student <span className="text-red-500">*</span></label>
                  <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select student without a login...</option>
                    {loginlessStudents.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.roll_number})</option>)}
                  </select>
                </div>
              )}

              {form.role === 'parent' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link to child <span className="text-gray-400 font-normal">(optional)</span></label>
                  <select value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">No child linked (link later)</option>
                    {students.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} ({s.roll_number})</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invitee Name <span className="text-gray-400 font-normal">(optional, prefilled for them)</span></label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lock to Email <span className="text-gray-400 font-normal">(optional — only this email can accept)</span></label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Create Invite</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
