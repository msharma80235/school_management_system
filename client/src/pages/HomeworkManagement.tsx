import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Subject { id: string; name: string; code: string; }
interface ClassItem { id: string; name: string; section: string; }
interface BookRef { id: string; title: string; author: string; }
interface BookOption extends BookRef {
  subject: Subject | null;
  class: ClassItem | null;
  approval_status: string;
}
interface Homework {
  id: string; title: string; description: string | null; due_date: string;
  subject: Subject; class: ClassItem;
  assigned_by_user: { id: string; name: string } | null;
  book: BookRef | null;
  created_at: string;
}

const emptyForm = { title: '', description: '', class_id: '', subject_id: '', due_date: '', book_id: '' };

export default function HomeworkManagement() {
  const { user } = useAuth();
  const readOnly = user?.role === 'volunteer';
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Homework | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [allBooks, setAllBooks] = useState<BookOption[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/classes').then((r) => setClasses(r.data.classes));
    // Only approved books can be attached to homework
    api.get('/books').then((r) => setAllBooks(r.data.books.filter((b: BookOption) => b.approval_status === 'approved'))).catch(() => {});
  }, []);

  // Books matching the selected subject, and either the selected class or available to all classes
  const matchingBooks = allBooks.filter((b) =>
    b.subject?.id === form.subject_id &&
    (!b.class || b.class.id === form.class_id)
  );

  const fetchHomework = async () => {
    const params = new URLSearchParams();
    if (filterClass) params.set('class_id', filterClass);
    if (showUpcoming) params.set('upcoming', 'true');
    const r = await api.get(`/homework?${params}`);
    setHomework(r.data.homework);
  };

  useEffect(() => { fetchHomework(); }, [filterClass, showUpcoming]);

  // Load subjects when class changes in the form
  const loadSubjectsForClass = async (classId: string) => {
    if (!classId) { setSubjects([]); return; }
    const r = await api.get(`/subjects/class/${classId}`);
    setSubjects(r.data.subjects);
  };

  const resetForm = () => { setForm(emptyForm); setEditing(null); setError(''); };

  const openCreate = () => {
    resetForm();
    if (filterClass) {
      setForm({ ...emptyForm, class_id: filterClass });
      loadSubjectsForClass(filterClass);
    }
    setShowModal(true);
  };

  const openEdit = (hw: Homework) => {
    setEditing(hw);
    setForm({
      title: hw.title, description: hw.description || '',
      class_id: hw.class.id, subject_id: hw.subject.id, due_date: hw.due_date,
      book_id: hw.book?.id || '',
    });
    loadSubjectsForClass(hw.class.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title || !form.class_id || !form.subject_id || !form.due_date) {
      setError('Title, class, subject, and due date are required');
      return;
    }
    try {
      if (editing) {
        await api.put(`/homework/${editing.id}`, {
          title: form.title, description: form.description,
          subject_id: form.subject_id, due_date: form.due_date,
          book_id: form.book_id,
        });
        setSuccess('Homework updated');
      } else {
        await api.post('/homework', form);
        setSuccess('Homework assigned');
      }
      setShowModal(false);
      resetForm();
      fetchHomework();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (hw: Homework) => {
    if (!confirm(`Remove homework "${hw.title}"?`)) return;
    try {
      await api.delete(`/homework/${hw.id}`);
      setSuccess('Homework removed');
      fetchHomework();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Delete failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const dueBadge = (dueDate: string) => {
    if (dueDate < today) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Past due</span>;
    if (dueDate === today) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Due today</span>;
    const diff = Math.ceil((new Date(dueDate).getTime() - new Date(today).getTime()) / 86400000);
    if (diff <= 2) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Due in {diff} day{diff > 1 ? 's' : ''}</span>;
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Due {dueDate}</span>;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Homework</h1>
          <p className="text-gray-500 text-sm mt-1">
            {readOnly ? 'View homework assignments for all classes and subjects' : 'Assign and manage homework for all classes and subjects'}
          </p>
        </div>
        {!readOnly && (
          <button onClick={openCreate}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Assign Homework
          </button>
        )}
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && !showModal && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={showUpcoming} onChange={(e) => setShowUpcoming(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          Upcoming only
        </label>
      </div>

      {/* Homework cards */}
      <div className="space-y-3">
        {homework.map((hw) => (
          <div key={hw.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-gray-900">{hw.title}</h3>
                  {dueBadge(hw.due_date)}
                </div>
                {hw.description && <p className="text-sm text-gray-600 mb-2">{hw.description}</p>}
                {hw.book && (
                  <div className="inline-flex items-center gap-1.5 mb-2 px-2 py-1 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" /></svg>
                    <span className="font-medium">{hw.book.title}</span>
                    <span className="text-indigo-400">by {hw.book.author}</span>
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" /></svg>
                    {hw.class.name}{hw.class.section ? ` - ${hw.class.section}` : ''}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" /></svg>
                    {hw.subject.name}
                  </span>
                  {hw.assigned_by_user && <span>By {hw.assigned_by_user.name}</span>}
                </div>
              </div>
              {!readOnly && (
                <div className="flex gap-2 ml-4">
                  <button onClick={() => openEdit(hw)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Edit</button>
                  <button onClick={() => handleDelete(hw)} className="text-red-600 hover:text-red-800 text-sm font-medium">Remove</button>
                </div>
              )}
            </div>
          </div>
        ))}

        {homework.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400">{readOnly ? 'No homework found.' : 'No homework found. Click "Assign Homework" to create one.'}</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Homework' : 'Assign Homework'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="e.g. Chapter 5 exercises 1-10" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  rows={3} placeholder="Instructions, page numbers, resources..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                  <select value={form.class_id}
                    onChange={(e) => { setForm({ ...form, class_id: e.target.value, subject_id: '', book_id: '' }); loadSubjectsForClass(e.target.value); }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={!!editing} required>
                    <option value="">Select...</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value, book_id: '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" required>
                    <option value="">Select...</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Reference book — appears once a subject is chosen */}
              {form.subject_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Book <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  {matchingBooks.length > 0 ? (
                    <>
                      <select value={form.book_id} onChange={(e) => setForm({ ...form, book_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">No book reference</option>
                        {matchingBooks.map((b) => (
                          <option key={b.id} value={b.id}>{b.title} — {b.author}</option>
                        ))}
                      </select>
                      {form.book_id && (
                        <div className="mt-2 flex items-center gap-2 p-2 bg-indigo-50 rounded-lg text-sm text-indigo-700">
                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" /></svg>
                          {matchingBooks.find((b) => b.id === form.book_id)?.title}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 py-2">No books added for this subject yet. Add books on the Books page to reference them here.</p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
                  {editing ? 'Update' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
