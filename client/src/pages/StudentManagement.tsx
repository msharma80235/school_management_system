import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useSort, SortHeader } from '../components/tableUtils';

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  roll_number: string;
  date_of_birth: string;
  gender: string;
  class_id: string;
  parent_name: string;
  parent_phone: string;
  address: string | null;
  user_id: string | null;
  photo_path: string | null;
  class: { id: string; name: string; section: string };
  parents: { id: string; name: string; email: string; is_active: boolean }[];
}

interface ClassItem {
  id: string;
  name: string;
  section: string;
  academic_year: string;
}

const emptyForm = {
  first_name: '', last_name: '', roll_number: '', date_of_birth: '',
  gender: '', parent_name: '', parent_phone: '', address: '',
};

export default function StudentManagement() {
  const { classId } = useParams();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [classInfo, setClassInfo] = useState<ClassItem | null>(null);
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [showTransfer, setShowTransfer] = useState<Student | null>(null);
  const [transferClassId, setTransferClassId] = useState('');
  const [showLoginModal, setShowLoginModal] = useState<Student | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [showPhotoModal, setShowPhotoModal] = useState<Student | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { sorted, sortKey, sortDir, toggleSort } = useSort(students, 'roll_number');

  const fetchStudents = async () => {
    const params = new URLSearchParams({ page: String(page), limit: '200' });
    if (classId) params.set('class_id', classId);
    if (search) params.set('search', search);
    const res = await api.get(`/students?${params}`);
    setStudents(res.data.students);
    setTotal(res.data.pagination.total);
    setTotalPages(res.data.pagination.totalPages);
  };

  const fetchClassInfo = async () => {
    if (classId) {
      const res = await api.get(`/classes/${classId}`);
      setClassInfo(res.data.class);
    }
  };

  const fetchAllClasses = async () => {
    const res = await api.get('/classes');
    setAllClasses(res.data.classes);
  };

  useEffect(() => { fetchClassInfo(); fetchAllClasses(); }, [classId]);
  useEffect(() => { fetchStudents(); }, [classId, page, search]);

  const resetForm = () => { setForm(emptyForm); setEditing(null); setError(''); };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = (s: Student) => {
    setEditing(s);
    setForm({
      first_name: s.first_name, last_name: s.last_name, roll_number: s.roll_number,
      date_of_birth: s.date_of_birth, gender: s.gender,
      parent_name: s.parent_name, parent_phone: s.parent_phone, address: s.address || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api.put(`/students/${editing.id}`, {
          first_name: form.first_name, last_name: form.last_name,
          date_of_birth: form.date_of_birth, gender: form.gender,
          parent_name: form.parent_name, parent_phone: form.parent_phone,
          address: form.address || null,
        });
        setSuccess('Student updated successfully');
      } else {
        await api.post('/students', { ...form, class_id: classId, address: form.address || null });
        setSuccess('Student added successfully');
      }
      setShowModal(false);
      resetForm();
      fetchStudents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (s: Student) => {
    if (!confirm(`Remove ${s.first_name} ${s.last_name}?`)) return;
    try {
      await api.delete(`/students/${s.id}`);
      setSuccess('Student removed');
      fetchStudents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Remove failed');
    }
  };

  const handleTransfer = async () => {
    if (!showTransfer || !transferClassId) return;
    try {
      await api.patch(`/students/${showTransfer.id}/transfer`, { class_id: transferClassId });
      setSuccess(`${showTransfer.first_name} transferred successfully`);
      setShowTransfer(null);
      setTransferClassId('');
      fetchStudents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Transfer failed');
    }
  };

  const handleUploadPhoto = async () => {
    if (!showPhotoModal || !photoFile) return;
    try {
      setPhotoUploading(true);
      const fd = new FormData();
      fd.append('photo', photoFile);
      await api.post(`/students/${showPhotoModal.id}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess(`Photo saved for ${showPhotoModal.first_name} — it will print on the marksheet`);
      setShowPhotoModal(null);
      setPhotoFile(null);
      fetchStudents();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Photo upload failed');
      setTimeout(() => setError(''), 3000);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!showPhotoModal) return;
    try {
      await api.delete(`/students/${showPhotoModal.id}/photo`);
      setSuccess('Photo removed');
      setShowPhotoModal(null);
      fetchStudents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove photo');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleCreateLogin = async () => {
    if (!showLoginModal || !loginForm.email || !loginForm.password) return;
    try {
      await api.post(`/student-account/${showLoginModal.id}/account`, loginForm);
      setSuccess(`Login account created for ${showLoginModal.first_name}`);
      setShowLoginModal(null);
      setLoginForm({ email: '', password: '' });
      fetchStudents();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create login');
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <button onClick={() => navigate('/admin/classes')} className="hover:text-indigo-600">Classes</button>
        <span>/</span>
        <span className="text-gray-900 font-medium">
          {classInfo ? `${classInfo.name} - ${classInfo.section}` : 'All Students'}
        </span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {classInfo ? `${classInfo.name} - ${classInfo.section} Students` : 'All Students'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{total} student{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search by name or roll..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm text-gray-900"
          />
          {classId && (
            <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Student
            </button>
          )}
        </div>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && !showModal && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader label="Roll #" k="roll_number" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Name" k="first_name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Gender" k="gender" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="DOB" k="date_of_birth" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Parent" k="parent_name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Phone</th>
              {!classId && <SortHeader label="Class" k="class.name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />}
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition">
                <td className="px-5 py-3 text-sm font-mono text-gray-700">{s.roll_number}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    {s.photo_path ? (
                      <img src={`/uploads/${s.photo_path}`} alt=""
                        className="w-8 h-8 rounded-full object-cover border border-gray-200 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                      </div>
                    )}
                    <span className="font-medium text-gray-900">{s.first_name} {s.last_name}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-gray-600 capitalize">{s.gender}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{s.date_of_birth}</td>
                <td className="px-5 py-3 text-sm text-gray-600">
                  {s.parents.length > 0 ? (
                    // Every linked parent account, each a link to their detail page
                    s.parents.map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && <span className="text-gray-300">, </span>}
                        <Link to={`/admin/parents/${p.id}`}
                          className="text-indigo-600 hover:text-indigo-800 hover:underline font-medium">
                          {p.name}
                        </Link>
                      </span>
                    ))
                  ) : (
                    <span title="No parent login account linked">{s.parent_name}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-sm text-gray-600">{s.parent_phone}</td>
                {!classId && <td className="px-5 py-3 text-sm text-gray-600">{s.class.name} - {s.class.section}</td>}
                <td className="px-5 py-3 text-right space-x-2">
                  <button onClick={() => openEdit(s)} className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">Edit</button>
                  <button onClick={() => { setShowPhotoModal(s); setPhotoFile(null); }} className="text-teal-600 hover:text-teal-900 text-sm font-medium">Photo</button>
                  <button onClick={() => { setShowTransfer(s); setTransferClassId(''); }} className="text-amber-600 hover:text-amber-900 text-sm font-medium">Transfer</button>
                  {!s.user_id ? (
                    <button onClick={() => { setShowLoginModal(s); setLoginForm({ email: '', password: '' }); }} className="text-emerald-600 hover:text-emerald-900 text-sm font-medium">Login</button>
                  ) : (
                    <span className="text-xs text-gray-400" title="Login account exists">Has Login</span>
                  )}
                  <button onClick={() => handleDelete(s)} className="text-red-600 hover:text-red-900 text-sm font-medium">Remove</button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={classId ? 7 : 8} className="px-5 py-12 text-center text-gray-400">
                  {search ? 'No students match your search.' : 'No students in this class. Click "Add Student" to enroll one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="space-x-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50">Previous</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Student Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Student' : 'Add New Student'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
                </div>
              </div>

              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Roll Number</label>
                  <input type="text" value={form.roll_number} onChange={(e) => setForm({ ...form, roll_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                    placeholder="e.g. 2026-5A-001" required />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required>
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parent/Guardian Name</label>
                  <input type="text" value={form.parent_name} onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parent Phone</label>
                  <input type="tel" value={form.parent_phone} onChange={(e) => setForm({ ...form, parent_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address (optional)</label>
                <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" rows={2} />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">{editing ? 'Update' : 'Add Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Transfer Student</h2>
              <p className="text-sm text-gray-500 mt-1">{showTransfer.first_name} {showTransfer.last_name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transfer to Class</label>
                <select value={transferClassId} onChange={(e) => setTransferClassId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900">
                  <option value="">Select class...</option>
                  {allClasses.filter((c) => c.id !== showTransfer.class_id).map((c) => (
                    <option key={c.id} value={c.id}>{c.name} - {c.section} ({c.academic_year})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowTransfer(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                <button onClick={handleTransfer} disabled={!transferClassId} className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium disabled:opacity-50">Transfer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Photo Modal */}
      {showPhotoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Student Photo</h2>
              <p className="text-sm text-gray-500 mt-1">
                {showPhotoModal.first_name} {showPhotoModal.last_name} — optional; prints on the marksheet when set
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-center">
                {photoFile ? (
                  <img src={URL.createObjectURL(photoFile)} alt="Preview"
                    className="w-28 h-36 object-cover rounded-lg border-2 border-indigo-300" />
                ) : showPhotoModal.photo_path ? (
                  <img src={`/uploads/${showPhotoModal.photo_path}`} alt="Current photo"
                    className="w-28 h-36 object-cover rounded-lg border-2 border-gray-200" />
                ) : (
                  <div className="w-28 h-36 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-300">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span className="text-xs mt-1">No photo</span>
                  </div>
                )}
              </div>

              <label className="cursor-pointer flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                {photoFile ? 'Choose a different photo' : 'Choose photo (JPG/PNG, max 5MB)'}
                <input type="file" accept=".jpg,.jpeg,.png" className="hidden"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} />
              </label>

              <div className="flex gap-3">
                <button onClick={() => { setShowPhotoModal(null); setPhotoFile(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                {showPhotoModal.photo_path && !photoFile && (
                  <button onClick={handleRemovePhoto}
                    className="flex-1 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium">Remove</button>
                )}
                <button onClick={handleUploadPhoto} disabled={!photoFile || photoUploading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50">
                  {photoUploading ? 'Saving...' : 'Save Photo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Create Student Login</h2>
              <p className="text-sm text-gray-500 mt-1">{showLoginModal.first_name} {showLoginModal.last_name} ({showLoginModal.roll_number})</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="student@example.com" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="Min 6 characters" required />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowLoginModal(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                <button onClick={handleCreateLogin} disabled={!loginForm.email || !loginForm.password}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium disabled:opacity-50">Create Login</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
