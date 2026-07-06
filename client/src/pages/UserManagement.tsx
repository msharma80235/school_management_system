import { useEffect, useState } from 'react';
import api from '../services/api';
import { useSort, SortHeader, TableSearch } from '../components/tableUtils';

interface OrgUser {
  id: string;
  name: string;
  email: string;
  role: string;
  subject: string | null;
  is_active: boolean;
  is_locked: boolean;
  is_moderator: boolean;
  has_active_students?: boolean; // only present for parents
  created_at: string;
}

const roleColor: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  teacher: 'bg-blue-100 text-blue-700',
  student: 'bg-emerald-100 text-emerald-700',
  parent: 'bg-amber-100 text-amber-700',
  volunteer: 'bg-teal-100 text-teal-700',
  staff: 'bg-cyan-100 text-cyan-700',
};

export default function UserManagement() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [meId, setMeId] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [resetUser, setResetUser] = useState<OrgUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [modalError, setModalError] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    const r = await api.get('/org-users');
    setUsers(r.data.users);
    setMeId(r.data.me);
  };

  useEffect(() => { fetchUsers(); }, []);

  const statusOf = (u: OrgUser) => (u.is_locked ? 'locked' : u.is_active ? 'active' : 'inactive');

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRole = !roleFilter || u.role === roleFilter;
    const matchesStatus = !statusFilter || statusOf(u) === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'role');

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
  const fail = (msg: string) => { setError(msg); setTimeout(() => setError(''), 4000); };

  const toggleActive = async (u: OrgUser) => {
    if (u.is_active && !confirm(`Deactivate ${u.name}? They will be signed out immediately and unable to log in.`)) return;
    try {
      const r = await api.patch(`/org-users/${u.id}/status`);
      flash(r.data.message);
      fetchUsers();
    } catch (err: any) { fail(err.response?.data?.error || 'Failed'); }
  };

  const toggleModerator = async (u: OrgUser) => {
    try {
      const r = await api.patch(`/org-users/${u.id}/moderator`);
      flash(r.data.message);
      fetchUsers();
    } catch (err: any) { fail(err.response?.data?.error || 'Failed'); }
  };

  const toggleLock = async (u: OrgUser) => {
    if (!u.is_locked && !confirm(`Lock ${u.name}'s account? They will be signed out immediately until unlocked.`)) return;
    try {
      const r = await api.patch(`/org-users/${u.id}/lock`);
      flash(r.data.message);
      fetchUsers();
    } catch (err: any) { fail(err.response?.data?.error || 'Failed'); }
  };

  const handleReset = async () => {
    if (!resetUser) return;
    setModalError('');
    try {
      const r = await api.post(`/org-users/${resetUser.id}/reset-password`, { new_password: newPassword });
      flash(r.data.message);
      setResetUser(null);
      setNewPassword('');
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Reset failed');
    }
  };

  const counts = {
    total: users.length,
    active: users.filter((u) => statusOf(u) === 'active').length,
    inactive: users.filter((u) => statusOf(u) === 'inactive').length,
    locked: users.filter((u) => u.is_locked).length,
    moderators: users.filter((u) => u.is_moderator).length,
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-1">
          Every account in your organization — {counts.total} users ({counts.active} active
          {counts.inactive > 0 && `, ${counts.inactive} inactive`}
          {counts.locked > 0 && `, ${counts.locked} locked`})
          {counts.moderators > 0 && ` · ${counts.moderators} moderator${counts.moderators > 1 ? 's' : ''}`}
        </p>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <TableSearch value={search} onChange={setSearch} placeholder="Search name or email..." />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All roles</option>
          <option value="admin">Admins</option>
          <option value="teacher">Teachers</option>
          <option value="student">Students</option>
          <option value="parent">Parents</option>
          <option value="volunteer">Volunteers</option>
          <option value="staff">Admin Staff</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="locked">Locked</option>
        </select>
        {(search || roleFilter || statusFilter) && (
          <span className="text-sm text-gray-400">{sorted.length} of {users.length} shown</span>
        )}
      </div>

      {/* Users table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader label="Name" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Email" k="email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Role" k="role" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Joined" k="created_at" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Status" k="is_active" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((u) => {
              const isMe = u.id === meId;
              const status = statusOf(u);
              const orphanParent = u.role === 'parent' && u.has_active_students === false;
              return (
                <tr key={u.id} className={`hover:bg-gray-50 transition ${status !== 'active' || orphanParent ? 'opacity-60 bg-gray-50' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${roleColor[u.role] || 'bg-gray-100 text-gray-600'}`}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 text-sm">
                        {u.name} {isMe && <span className="text-xs text-gray-400 font-normal">(you)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${roleColor[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role === 'staff' ? 'admin staff' : u.role}
                    </span>
                    {u.is_moderator && (
                      <span className="ml-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                        Moderator
                      </span>
                    )}
                    {u.role === 'parent' && u.has_active_students === false && (
                      <span className="ml-1.5 inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600"
                        title="No active enrolled student under this parent">No active enrolled student</span>
                    )}
                    {u.subject && <span className="ml-1.5 text-xs text-gray-400">{u.subject}</span>}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    {status === 'locked' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        Locked
                      </span>
                    ) : status === 'active' ? (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                    ) : (
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Inactive</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right space-x-3 whitespace-nowrap">
                    {!isMe && (
                      <>
                        <button onClick={() => { setResetUser(u); setNewPassword(''); setModalError(''); }}
                          className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Reset Password</button>
                        {u.role !== 'admin' && (
                          <button onClick={() => toggleModerator(u)}
                            className={`text-xs font-medium ${u.is_moderator ? 'text-gray-500 hover:text-gray-700' : 'text-violet-600 hover:text-violet-800'}`}>
                            {u.is_moderator ? 'Remove Moderator' : 'Make Moderator'}
                          </button>
                        )}
                        <button onClick={() => toggleLock(u)}
                          className={`text-xs font-medium ${u.is_locked ? 'text-green-600 hover:text-green-800' : 'text-orange-600 hover:text-orange-800'}`}>
                          {u.is_locked ? 'Unlock' : 'Lock'}
                        </button>
                        <button onClick={() => toggleActive(u)}
                          className={`text-xs font-medium ${u.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No users match your filters</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reset password modal */}
      {resetUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Reset Password</h2>
              <p className="text-sm text-gray-500 mt-0.5">{resetUser.name} · {resetUser.email}</p>
            </div>
            <div className="p-6 space-y-4">
              {modalError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{modalError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="Min 6 characters" />
                <p className="mt-1 text-xs text-gray-400">Share the new password with the user securely</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setResetUser(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button onClick={handleReset} disabled={newPassword.length < 6}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50">Reset</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
