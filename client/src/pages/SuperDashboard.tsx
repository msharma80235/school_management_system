import { useEffect, useState } from 'react';
import api from '../services/api';
import { useSort, SortHeader, TableSearch } from '../components/tableUtils';

interface Org {
  id: string;
  name: string;
  slug: string;
  email: string;
  is_active: boolean;
  created_at: string;
  _count: { users: number; students: number; classes: number };
}

interface OrgAdmin {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface Stats {
  orgs: number; activeOrgs: number; students: number; teachers: number; parents: number; users: number;
}

const emptyAdminForm = { name: '', email: '', password: '' };

export default function SuperDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Manage Admins modal state
  const [manageOrg, setManageOrg] = useState<Org | null>(null);
  const [admins, setAdmins] = useState<OrgAdmin[]>([]);
  const [editingAdmin, setEditingAdmin] = useState<OrgAdmin | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', new_password: '' });
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [addForm, setAddForm] = useState(emptyAdminForm);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  const fetchAll = async () => {
    const [s, o] = await Promise.all([api.get('/super/stats'), api.get('/super/orgs')]);
    setStats(s.data);
    setOrgs(o.data.orgs);
  };

  useEffect(() => { fetchAll(); }, []);

  const filtered = orgs.filter((o) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q) || o.email.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || (statusFilter === 'active' ? o.is_active : !o.is_active);
    return matchesSearch && matchesStatus;
  });
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'name');

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };
  const modalFlash = (msg: string) => { setModalSuccess(msg); setTimeout(() => setModalSuccess(''), 3000); };

  const toggleStatus = async (org: Org) => {
    if (org.is_active && !confirm(
      `Disable "${org.name}"?\n\nEvery user of this organization (admins, teachers, students, parents, volunteers, staff) will be locked out immediately.`)) {
      return;
    }
    try {
      const r = await api.patch(`/super/orgs/${org.id}/status`);
      flash(r.data.message);
      fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  // ----- Admin management -----
  const openManage = async (org: Org) => {
    setManageOrg(org);
    setEditingAdmin(null);
    setShowAddAdmin(false);
    setModalError('');
    setModalSuccess('');
    const r = await api.get(`/super/orgs/${org.id}/admins`);
    setAdmins(r.data.admins);
  };

  const refreshAdmins = async () => {
    if (!manageOrg) return;
    const r = await api.get(`/super/orgs/${manageOrg.id}/admins`);
    setAdmins(r.data.admins);
    fetchAll(); // keep the user counts fresh
  };

  const startEdit = (a: OrgAdmin) => {
    setEditingAdmin(a);
    setEditForm({ name: a.name, email: a.email, new_password: '' });
    setShowAddAdmin(false);
    setModalError('');
  };

  const saveEdit = async () => {
    if (!manageOrg || !editingAdmin) return;
    setModalError('');
    if (!editForm.name.trim() || !editForm.email.trim()) {
      setModalError('Name and email are required');
      return;
    }
    try {
      await api.put(`/super/orgs/${manageOrg.id}/admins/${editingAdmin.id}`, {
        name: editForm.name.trim(),
        email: editForm.email.trim(),
        new_password: editForm.new_password || undefined,
      });
      modalFlash(editForm.new_password ? 'Admin updated (password changed)' : 'Admin updated');
      setEditingAdmin(null);
      refreshAdmins();
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Update failed');
    }
  };

  const addAdmin = async () => {
    if (!manageOrg) return;
    setModalError('');
    if (!addForm.name || !addForm.email || !addForm.password) {
      setModalError('All fields are required');
      return;
    }
    try {
      await api.post(`/super/orgs/${manageOrg.id}/admins`, addForm);
      modalFlash('New admin added');
      setAddForm(emptyAdminForm);
      setShowAddAdmin(false);
      refreshAdmins();
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Failed to add admin');
    }
  };

  const toggleAdmin = async (a: OrgAdmin) => {
    if (!manageOrg) return;
    setModalError('');
    try {
      const r = await api.patch(`/super/orgs/${manageOrg.id}/admins/${a.id}/status`);
      modalFlash(r.data.message);
      refreshAdmins();
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Failed');
    }
  };

  const statCards = stats ? [
    { label: 'Organizations', value: stats.orgs, sub: `${stats.activeOrgs} active`, color: 'bg-amber-500' },
    { label: 'Total Users', value: stats.users, sub: 'across all orgs', color: 'bg-indigo-500' },
    { label: 'Students', value: stats.students, sub: 'active enrollments', color: 'bg-emerald-500' },
    { label: 'Teachers', value: stats.teachers, sub: `${stats.parents} parents`, color: 'bg-purple-500' },
  ] : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Platform Administration</h1>
        <p className="text-gray-500 mt-1">Manage every organization on Education Hub</p>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Platform stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${c.color} rounded-lg flex items-center justify-center`}>
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                <p className="text-xs text-gray-500">{c.label} · {c.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Org filters */}
      <div className="flex items-center gap-3 mb-4">
        <TableSearch value={search} onChange={setSearch} placeholder="Search org, slug, email..." />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-amber-500">
          <option value="">All statuses</option>
          <option value="active">Enabled</option>
          <option value="inactive">Disabled</option>
        </select>
      </div>

      {/* Orgs table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader label="Organization" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Slug" k="slug" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Users" k="_count.users" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Students" k="_count.students" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Classes" k="_count.classes" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Created" k="created_at" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Status" k="is_active" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((org) => (
              <tr key={org.id} className={`hover:bg-gray-50 transition ${!org.is_active ? 'opacity-60' : ''}`}>
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-900">{org.name}</div>
                  <div className="text-xs text-gray-400">{org.email}</div>
                </td>
                <td className="px-5 py-3 text-sm font-mono text-gray-600">{org.slug}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{org._count.users}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{org._count.students}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{org._count.classes}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{new Date(org.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    org.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {org.is_active ? 'Enabled' : 'Disabled'}
                  </span>
                </td>
                <td className="px-5 py-3 text-right space-x-3 whitespace-nowrap">
                  <button onClick={() => openManage(org)}
                    className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Manage Admins</button>
                  <button onClick={() => toggleStatus(org)}
                    className={`text-sm font-medium ${org.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>
                    {org.is_active ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">No organizations found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Manage Admins modal */}
      {manageOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Manage Admins</h2>
                <p className="text-sm text-gray-500 mt-0.5">{manageOrg.name}</p>
              </div>
              <button onClick={() => setManageOrg(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {modalSuccess && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{modalSuccess}</div>}
              {modalError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{modalError}</div>}

              {/* Admin list */}
              <div className="space-y-2">
                {admins.map((a) => (
                  <div key={a.id} className="border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center text-sm font-bold">
                          {a.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 text-sm">{a.name}</p>
                            {!a.is_active && <span className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Inactive</span>}
                          </div>
                          <p className="text-xs text-gray-500">{a.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(a)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Edit</button>
                        <button onClick={() => toggleAdmin(a)}
                          className={`text-xs font-medium ${a.is_active ? 'text-red-600 hover:text-red-800' : 'text-green-600 hover:text-green-800'}`}>
                          {a.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </div>

                    {/* Inline edit form */}
                    {editingAdmin?.id === a.id && (
                      <div className="border-t border-gray-100 p-3 space-y-3 bg-gray-50 rounded-b-lg">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                            <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                            <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">New Password <span className="font-normal">(leave blank to keep current)</span></label>
                          <input type="password" value={editForm.new_password} onChange={(e) => setEditForm({ ...editForm, new_password: e.target.value })}
                            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Min 6 characters" />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingAdmin(null)} className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100">Cancel</button>
                          <button onClick={saveEdit} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">Save Changes</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {admins.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No admin accounts</p>}
              </div>

              {/* Add admin */}
              {showAddAdmin ? (
                <div className="border-2 border-dashed border-indigo-200 rounded-lg p-3 space-y-3 bg-indigo-50/50">
                  <p className="text-sm font-medium text-gray-700">New Admin Account</p>
                  <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Full name" />
                  <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Email" />
                  <input type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Password (min 6 characters)" />
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowAddAdmin(false); setAddForm(emptyAdminForm); }}
                      className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-100">Cancel</button>
                    <button onClick={addAdmin} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">Add Admin</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setShowAddAdmin(true); setEditingAdmin(null); setModalError(''); }}
                  className="w-full border-2 border-dashed border-gray-300 text-gray-500 py-2.5 rounded-lg text-sm font-medium hover:border-indigo-400 hover:text-indigo-600 transition">
                  + Add Admin
                </button>
              )}

              <p className="text-xs text-gray-400">
                To hand the organization to a new admin: add the new account, then deactivate the old one.
                Every organization must keep at least one active admin.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
