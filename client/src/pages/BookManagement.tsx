import { useEffect, useState } from 'react';
import api from '../services/api';

interface Subject { id: string; name: string; code: string; }
interface ClassItem { id: string; name: string; section: string; }
interface Book {
  id: string; title: string; author: string; isbn: string | null;
  publisher: string | null; edition: string | null;
  custom_category: string | null; is_mandatory: boolean;
  file_path: string | null;
  approval_status: string; review_note: string | null;
  subject: Subject | null; class: ClassItem | null;
}

const emptyForm = {
  title: '', author: '', isbn: '', publisher: '', edition: '',
  subject_id: '', custom_category: '', class_id: '', is_mandatory: true,
};

export default function BookManagement() {
  const [books, setBooks] = useState<Book[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [bookFile, setBookFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/subjects').then((r) => setSubjects(r.data.subjects));
    api.get('/classes').then((r) => setClasses(r.data.classes));
  }, []);

  const fetchBooks = async () => {
    const params = new URLSearchParams();
    if (filterClass) params.set('class_id', filterClass);
    if (filterSubject) params.set('subject_id', filterSubject);
    const r = await api.get(`/books?${params}`);
    setBooks(r.data.books);
  };

  useEffect(() => { fetchBooks(); }, [filterClass, filterSubject]);

  const resetForm = () => { setForm(emptyForm); setEditing(null); setIsCustom(false); setBookFile(null); setError(''); };

  const openCreate = () => { resetForm(); setShowModal(true); };

  const openEdit = (book: Book) => {
    setEditing(book);
    setIsCustom(!book.subject);
    setForm({
      title: book.title, author: book.author, isbn: book.isbn || '',
      publisher: book.publisher || '', edition: book.edition || '',
      subject_id: book.subject?.id || '', custom_category: book.custom_category || '',
      class_id: book.class?.id || '', is_mandatory: book.is_mandatory,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title || !form.author) { setError('Title and author are required'); return; }
    if (!isCustom && !form.subject_id) { setError('Select a subject or switch to custom category'); return; }
    if (isCustom && !form.custom_category.trim()) { setError('Enter a custom category name'); return; }

    const payload = {
      ...form,
      subject_id: isCustom ? '' : form.subject_id,
      custom_category: isCustom ? form.custom_category.trim() : '',
    };

    try {
      setUploading(true);
      let bookId: string;
      if (editing) {
        const r = await api.put(`/books/${editing.id}`, payload);
        bookId = r.data.book.id;
        setSuccess('Book updated');
      } else {
        const r = await api.post('/books', payload);
        bookId = r.data.book.id;
        setSuccess('Book added');
      }

      // Upload the PDF/scanned copy if one was picked
      if (bookFile) {
        const fd = new FormData();
        fd.append('file', bookFile);
        await api.post(`/books/${bookId}/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setSuccess('Book saved with copy attached');
      }

      setShowModal(false);
      resetForm();
      setBookFile(null);
      fetchBooks();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = async () => {
    if (!editing) return;
    try {
      await api.delete(`/books/${editing.id}/file`);
      setEditing({ ...editing, file_path: null });
      setSuccess('Copy removed');
      fetchBooks();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to remove copy');
    }
  };

  const handleDelete = async (book: Book) => {
    if (!confirm(`Remove "${book.title}"?`)) return;
    try {
      await api.delete(`/books/${book.id}`);
      setSuccess('Book removed');
      fetchBooks();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Delete failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Group books by subject name (or custom category)
  const grouped = books.reduce<Record<string, Book[]>>((acc, book) => {
    const key = book.subject?.name || book.custom_category || 'Uncategorized';
    (acc[key] = acc[key] || []).push(book);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Books</h1>
          <p className="text-gray-500 text-sm mt-1">Manage books for each subject, including custom categories</p>
        </div>
        <button onClick={openCreate}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Book
        </button>
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
        <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All Subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Books grouped by subject/category */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([groupName, groupBooks]) => (
          <div key={groupName}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" /></svg>
              {groupName}
              {!groupBooks[0]?.subject && groupBooks[0]?.custom_category && (
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 normal-case tracking-normal">Custom</span>
              )}
              <span className="text-gray-300 font-normal normal-case">({groupBooks.length})</span>
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
              {groupBooks.map((book) => (
                <div key={book.id} className="px-5 py-4 flex items-start justify-between hover:bg-gray-50 transition">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-gray-900">{book.title}</h3>
                      {book.is_mandatory ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">Mandatory</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Optional</span>
                      )}
                      {book.approval_status === 'pending' && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pending approval</span>
                      )}
                      {book.approval_status === 'rejected' && (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Rejected</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">by {book.author}</p>
                    {book.approval_status === 'rejected' && book.review_note && (
                      <p className="text-xs text-red-600 mt-0.5">Moderator note: {book.review_note} — edit the book to resubmit.</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {book.class ? <span>{book.class.name}{book.class.section ? ` - ${book.class.section}` : ''}</span> : <span>All classes</span>}
                      {book.publisher && <span>{book.publisher}</span>}
                      {book.edition && <span>{book.edition} edition</span>}
                      {book.isbn && <span className="font-mono">ISBN: {book.isbn}</span>}
                    </div>
                    {book.file_path && (
                      <a href={`/uploads/${book.file_path}`} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        View copy
                      </a>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => openEdit(book)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Edit</button>
                    <button onClick={() => handleDelete(book)} className="text-red-600 hover:text-red-800 text-sm font-medium">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {books.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" />
            </svg>
            <p className="text-gray-400">No books yet. Click "Add Book" to add one.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Book' : 'Add Book'}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="e.g. Mathematics for Class 5" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
                <input type="text" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="Author name" required />
              </div>

              {/* Subject or custom category */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    {isCustom ? 'Custom Category' : 'Subject'}
                  </label>
                  <button type="button" onClick={() => setIsCustom(!isCustom)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    {isCustom ? 'Pick from subjects instead' : 'Use custom category instead'}
                  </button>
                </div>
                {isCustom ? (
                  <input type="text" value={form.custom_category} onChange={(e) => setForm({ ...form, custom_category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                    placeholder="e.g. Library, Moral Science, General Reading" />
                ) : (
                  <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select subject...</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class <span className="text-gray-400 font-normal">(optional)</span></label>
                <select value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">All classes</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publisher</label>
                  <input type="text" value={form.publisher} onChange={(e) => setForm({ ...form, publisher: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Edition</label>
                  <input type="text" value={form.edition} onChange={(e) => setForm({ ...form, edition: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                    placeholder="e.g. 3rd" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900 font-mono"
                  placeholder="978-..." />
              </div>

              {/* PDF / scanned copy */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Book Copy <span className="text-gray-400 font-normal">(PDF or scanned image, max 25MB)</span>
                </label>

                {editing?.file_path && !bookFile && (
                  <div className="flex items-center gap-2 p-2 mb-2 bg-red-50 rounded-lg">
                    <svg className="w-4 h-4 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    <a href={`/uploads/${editing.file_path}`} target="_blank" rel="noreferrer"
                      className="text-sm text-red-700 font-medium flex-1 hover:underline truncate">Attached copy</a>
                    <button type="button" onClick={handleRemoveFile} className="text-xs text-gray-500 hover:text-red-700">Remove</button>
                  </div>
                )}

                <label className="cursor-pointer inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  {bookFile ? 'Change file' : editing?.file_path ? 'Replace copy' : 'Upload copy'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                    onChange={(e) => setBookFile(e.target.files?.[0] || null)} />
                </label>
                {bookFile && (
                  <span className="ml-2 text-xs text-indigo-600">{bookFile.name} ({(bookFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                )}
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_mandatory}
                  onChange={(e) => setForm({ ...form, is_mandatory: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-gray-700">Mandatory book</span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                <button type="submit" disabled={uploading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50">
                  {uploading ? 'Saving...' : editing ? 'Update' : 'Add Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
