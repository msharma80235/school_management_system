import { useEffect, useState } from 'react';
import api from '../services/api';
import { useSort, SortHeader, TableSearch } from '../components/tableUtils';

interface Grade {
  id: string;
  name: string;
  display_order: number;
}

export default function GradeManagement() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [form, setForm] = useState({ name: '', display_order: 0 });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [search, setSearch] = useState('');
  const filtered = grades.filter((g) => !search || g.name.toLowerCase().includes(search.toLowerCase()));
  const { sorted, sortKey, sortDir, toggleSort } = useSort(filtered, 'display_order');

  const fetchGrades = async () => {
    const res = await api.get('/grades');
    setGrades(res.data.grades);
  };

  useEffect(() => { fetchGrades(); }, []);

  const resetForm = () => { setForm({ name: '', display_order: 0 }); setEditing(null); setError(''); };

  const openCreate = () => {
    resetForm();
    setForm({ name: '', display_order: grades.length });
    setShowModal(true);
  };

  const openEdit = (g: Grade) => {
    setEditing(g);
    setForm({ name: g.name, display_order: g.display_order });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api.put(`/grades/${editing.id}`, form);
        setSuccess('Grade level updated');
      } else {
        if (!form.name.trim()) { setError('Name is required'); return; }
        await api.post('/grades', form);
        setSuccess('Grade level created');
      }
      setShowModal(false);
      resetForm();
      fetchGrades();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (g: Grade) => {
    if (!confirm(`Delete "${g.name}"?`)) return;
    try {
      await api.delete(`/grades/${g.id}`);
      setSuccess('Grade level deleted');
      fetchGrades();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Delete failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grade Levels</h1>
          <p className="text-gray-500 text-sm mt-1">Customize grade/level names for your organization</p>
        </div>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Grade Level
        </button>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && !showModal && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="mb-4"><TableSearch value={search} onChange={setSearch} placeholder="Search grade levels..." /></div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader label="Order" k="display_order" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Grade Name" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((g) => (
              <tr key={g.id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 text-sm text-gray-500">{g.display_order + 1}</td>
                <td className="px-6 py-4 font-medium text-gray-900">{g.name}</td>
                <td className="px-6 py-4 text-right space-x-3">
                  <button onClick={() => openEdit(g)} className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">Edit</button>
                  <button onClick={() => handleDelete(g)} className="text-red-600 hover:text-red-900 text-sm font-medium">Delete</button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                  No grade levels configured. Add custom grade levels for your organization.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <strong>Tip:</strong> Grade levels you create here will appear as options when creating classes.
        Examples: "Nursery", "Grade 1", "Year 7", "Level A", "Beginner", "Advanced", etc.
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Grade Level' : 'Add Grade Level'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="e.g. Grade 1, Year 7, Beginner" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                <input type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">{editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
