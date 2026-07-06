import { useEffect, useState } from 'react';
import api from '../services/api';
import { useSort, SortHeader, TableSearch } from '../components/tableUtils';

interface Volunteer {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export default function VolunteerManagement() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const filtered = volunteers.filter((v) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || v.name.toLowerCase().includes(q) || v.email.toLowerCase().includes(q);
    const matchesStatus = !statusFilter || (statusFilter === 'active' ? v.is_active : !v.is_active);
    return matchesSearch && matchesStatus;
  });
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'name');

  const fetchVolunteers = async () => {
    const res = await api.get('/users/volunteers');
    setVolunteers(res.data.volunteers);
    setTotal(res.data.pagination.total);
  };

  useEffect(() => { fetchVolunteers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) {
      setError('All fields are required');
      return;
    }
    try {
      await api.post('/users/volunteers', form);
      setSuccess('Volunteer account created');
      setShowModal(false);
      setForm({ name: '', email: '', password: '' });
      fetchVolunteers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const toggleStatus = async (v: Volunteer) => {
    await api.patch(`/users/volunteers/${v.id}/status`);
    setSuccess(`Volunteer ${v.is_active ? 'deactivated' : 'activated'}`);
    fetchVolunteers();
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Volunteers</h1>
          <p className="text-gray-500 text-sm mt-1">{total} volunteer{total !== 1 ? 's' : ''} — can mark attendance and view marksheets & homework</p>
        </div>
        <button onClick={() => { setForm({ name: '', email: '', password: '' }); setError(''); setShowModal(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Volunteer
        </button>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      <div className="flex items-center gap-3 mb-4">
        <TableSearch value={search} onChange={setSearch} placeholder="Search name or email..." />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader label="Name" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Email" k="email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Status" k="is_active" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">
                      {v.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{v.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{v.email}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    v.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {v.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => toggleStatus(v)}
                    className={`text-sm font-medium ${v.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`}>
                    {v.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                  No volunteers yet. Click "Add Volunteer" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Add Volunteer</h2>
              <p className="text-sm text-gray-500 mt-1">Volunteers can mark attendance and view marksheets & homework (read-only)</p>
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="Min 6 characters" required />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
