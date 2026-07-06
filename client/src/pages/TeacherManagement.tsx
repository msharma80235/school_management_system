import { useEffect, useState } from 'react';
import api from '../services/api';
import type { User } from '../types';
import { useSort, SortHeader, TableSearch } from '../components/tableUtils';

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', subject: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchTeachers = async () => {
    const res = await api.get(`/users/teachers?page=${page}&limit=200`);
    setTeachers(res.data.teachers);
    setTotal(res.data.pagination.total);
    setTotalPages(res.data.pagination.totalPages);
  };

  useEffect(() => { fetchTeachers(); }, [page]);

  const filtered = teachers.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q);
    const matchesStatus = !statusFilter || (statusFilter === 'active' ? t.is_active : !t.is_active);
    return matchesSearch && matchesStatus;
  });
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'name');

  const resetForm = () => {
    setForm({ name: '', email: '', password: '', subject: '' });
    setEditingTeacher(null);
    setError('');
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (teacher: User) => {
    setEditingTeacher(teacher);
    setForm({ name: teacher.name, email: teacher.email, password: '', subject: teacher.subject || '' });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingTeacher) {
        await api.put(`/users/teachers/${editingTeacher.id}`, {
          name: form.name,
          subject: form.subject || null,
        });
        setSuccess('Teacher updated successfully');
      } else {
        if (!form.name || !form.email || !form.password) {
          setError('Name, email, and password are required');
          return;
        }
        await api.post('/users/teachers', form);
        setSuccess('Teacher created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchTeachers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed');
    }
  };

  const toggleStatus = async (teacher: User) => {
    await api.patch(`/users/teachers/${teacher.id}/status`);
    fetchTeachers();
    setSuccess(`Teacher ${teacher.is_active ? 'deactivated' : 'activated'} successfully`);
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Management</h1>
          <p className="text-gray-500 text-sm mt-1">{total} teacher{total !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Teacher
        </button>
      </div>

      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <TableSearch value={search} onChange={setSearch} placeholder="Search name, email, subject..." />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {(search || statusFilter) && (
          <span className="text-sm text-gray-400">{sorted.length} of {teachers.length} shown</span>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader label="Name" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Email" k="email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Subject" k="subject" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Status" k="is_active" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((teacher) => (
              <tr key={teacher.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-sm font-bold">
                      {teacher.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-gray-900">{teacher.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600">{teacher.email}</td>
                <td className="px-6 py-4 text-gray-600">{teacher.subject || '-'}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    teacher.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {teacher.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right space-x-2">
                  <button
                    onClick={() => openEdit(teacher)}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleStatus(teacher)}
                    className={`text-sm font-medium ${
                      teacher.is_active
                        ? 'text-red-600 hover:text-red-900'
                        : 'text-green-600 hover:text-green-900'
                    }`}
                  >
                    {teacher.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  No teachers found. Click "Add Teacher" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="space-x-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  required
                />
              </div>
              {!editingTeacher && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                      required
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="e.g. Mathematics"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium"
                >
                  {editingTeacher ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
