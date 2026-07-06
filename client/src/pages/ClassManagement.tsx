import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface ClassItem {
  id: string;
  name: string;
  section: string;
  academic_year: string;
  teachers: { id: string; name: string; email: string; subject: string | null }[];
  _count: { students: number };
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  subject: string | null;
}

export default function ClassManagement() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [gradeOptions, setGradeOptions] = useState<string[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ClassItem | null>(null);
  const [form, setForm] = useState({ name: '', section: '', academic_year: '2026-2027', teacher_ids: [] as string[] });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const fetchClasses = async () => {
    const res = await api.get('/classes');
    setClasses(res.data.classes);
  };

  const fetchTeachers = async () => {
    const res = await api.get('/users/teachers?limit=100');
    setTeachers(res.data.teachers.filter((t: Teacher & { is_active: boolean }) => t.is_active));
  };

  const fetchGrades = async () => {
    const res = await api.get('/grades');
    const names = res.data.grades.map((g: any) => g.name);
    setGradeOptions(names);
  };

  useEffect(() => {
    fetchClasses();
    fetchTeachers();
    fetchGrades();
  }, []);

  const resetForm = () => {
    setForm({ name: '', section: '', academic_year: '2026-2027', teacher_ids: [] });
    setEditing(null);
    setError('');
  };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = (cls: ClassItem) => {
    setEditing(cls);
    setForm({
      name: cls.name,
      section: cls.section,
      academic_year: cls.academic_year,
      teacher_ids: cls.teachers.map((t) => t.id),
    });
    setShowModal(true);
  };

  const toggleTeacher = (id: string) => {
    setForm((prev) => ({
      ...prev,
      teacher_ids: prev.teacher_ids.includes(id)
        ? prev.teacher_ids.filter((t) => t !== id)
        : [...prev.teacher_ids, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api.put(`/classes/${editing.id}`, form);
        setSuccess('Class updated successfully');
      } else {
        if (!form.name || !form.academic_year) {
          setError('Grade and academic year are required');
          return;
        }
        await api.post('/classes', form);
        setSuccess('Class created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchClasses();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (cls: ClassItem) => {
    if (cls._count.students > 0) {
      setSuccess('');
      setError('Cannot delete class with enrolled students');
      setTimeout(() => setError(''), 3000);
      return;
    }
    try {
      await api.delete(`/classes/${cls.id}`);
      setSuccess('Class deleted successfully');
      fetchClasses();
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
          <h1 className="text-2xl font-bold text-gray-900">Classes</h1>
          <p className="text-gray-500 text-sm mt-1">{classes.length} class{classes.length !== 1 ? 'es' : ''} configured</p>
        </div>
        <button onClick={openCreate} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Class
        </button>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && !showModal && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map((cls) => (
          <div key={cls.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">{cls.name}{cls.section ? ` - ${cls.section}` : ''}</h3>
                <p className="text-sm text-gray-500">{cls.academic_year}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(cls)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => handleDelete(cls)} className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-sm text-gray-600 mb-3">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {cls.teachers.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {cls.teachers.map((t) => (
                    <span key={t.id} className="inline-flex px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                      {t.name}
                    </span>
                  ))}
                </div>
              ) : (
                'No teachers assigned'
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197V21" />
                </svg>
                {cls._count.students} student{cls._count.students !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate(`/admin/schedules?class=${cls.id}`)}
                  className="text-sm text-teal-600 hover:text-teal-800 font-medium"
                >
                  Schedule
                </button>
                <button
                  onClick={() => navigate(`/admin/classes/${cls.id}/students`)}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  View Students
                </button>
              </div>
            </div>
          </div>
        ))}

        {classes.length === 0 && (
          <div className="col-span-full bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p className="text-gray-400">No classes yet. Click "Add Class" to create one.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Class' : 'Add New Class'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Grade Level</label>
                {gradeOptions.length > 0 ? (
                  <>
                    <select
                      value={gradeOptions.includes(form.name) ? form.name : '__custom__'}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setForm({ ...form, name: '' });
                        } else {
                          setForm({ ...form, name: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                    >
                      <option value="">Select grade...</option>
                      {gradeOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                      <option value="__custom__">-- Enter custom name --</option>
                    </select>
                    {(!gradeOptions.includes(form.name) && form.name !== '') || (gradeOptions.length > 0 && !gradeOptions.includes(form.name) && form.name === '') ? null : null}
                    {!gradeOptions.includes(form.name) && (
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                        placeholder="e.g. Foundation, Year 7, Level A"
                        required
                      />
                    )}
                  </>
                ) : (
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                    placeholder="Enter grade/level name"
                    required
                  />
                )}
                <p className="mt-1 text-xs text-gray-400">Choose from your grade levels or enter a custom name</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Section <span className="text-gray-400 font-normal">(optional)</span></label>
                <select
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                >
                  <option value="">No section</option>
                  {['A', 'B', 'C', 'D', 'E'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Academic Year</label>
                <input
                  type="text"
                  value={form.academic_year}
                  onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="2026-2027"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teachers <span className="text-gray-400 font-normal">(optional — select one or more, even for the same subject)</span>
                </label>
                <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                  {teachers.map((t) => (
                    <label key={t.id} className="flex items-center gap-3 px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <input type="checkbox" checked={form.teacher_ids.includes(t.id)} onChange={() => toggleTeacher(t.id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-gray-900">{t.name}</span>
                      {t.subject && <span className="text-xs text-gray-400">{t.subject}</span>}
                    </label>
                  ))}
                  {teachers.length === 0 && <p className="text-sm text-gray-400 text-center py-2">No teachers available</p>}
                </div>
                {form.teacher_ids.length > 0 && (
                  <p className="mt-1 text-xs text-indigo-600">{form.teacher_ids.length} teacher{form.teacher_ids.length > 1 ? 's' : ''} selected</p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
                  {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
