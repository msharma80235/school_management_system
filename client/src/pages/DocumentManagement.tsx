import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface SchoolDoc {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_path: string;
  audience: string;
  created_at: string;
  approval_status: string;
  review_note: string | null;
  uploader: { id: string; name: string } | null;
}

const CATEGORIES = [
  { value: 'schedule', label: 'Schedule' },
  { value: 'event', label: 'Event' },
  { value: 'notice', label: 'Notice' },
  { value: 'circular', label: 'Circular' },
  { value: 'general', label: 'General' },
];

const ROLES = [
  { value: 'teacher', label: 'Teachers' },
  { value: 'student', label: 'Students' },
  { value: 'parent', label: 'Parents' },
  { value: 'volunteer', label: 'Volunteers' },
  { value: 'staff', label: 'Admin Staff' },
];

const catColor: Record<string, string> = {
  schedule: 'bg-blue-100 text-blue-700',
  event: 'bg-purple-100 text-purple-700',
  notice: 'bg-amber-100 text-amber-700',
  circular: 'bg-cyan-100 text-cyan-700',
  general: 'bg-gray-100 text-gray-600',
};

export default function DocumentManagement() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<SchoolDoc[]>([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'general' });
  const [audience, setAudience] = useState<string[]>(ROLES.map((r) => r.value));
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchDocs = async () => {
    const params = filterCategory ? `?category=${filterCategory}` : '';
    const r = await api.get(`/documents${params}`);
    setDocuments(r.data.documents);
  };

  useEffect(() => { fetchDocs(); }, [filterCategory]);

  const toggleRole = (role: string) => {
    setAudience((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!docFile) { setError('Choose a file to upload'); return; }
    if (audience.length === 0) { setError('Select at least one audience'); return; }

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', docFile);
      fd.append('title', form.title.trim());
      fd.append('description', form.description);
      fd.append('category', form.category);
      fd.append('audience', audience.join(','));
      await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess('Document uploaded');
      setShowModal(false);
      setForm({ title: '', description: '', category: 'general' });
      setAudience(ROLES.map((r) => r.value));
      setDocFile(null);
      fetchDocs();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: SchoolDoc) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    await api.delete(`/documents/${doc.id}`);
    setSuccess('Document deleted');
    fetchDocs();
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Documents</h1>
          <p className="text-gray-500 text-sm mt-1">Share schedules, event info, notices, and other documents with your school</p>
        </div>
        <div className="flex gap-3">
        <button onClick={() => navigate('/admin/roles-duties')}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          Edit Roles &amp; Duties
        </button>
        <button onClick={() => { setError(''); setShowModal(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          Upload Document
        </button>
        </div>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && !showModal && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Category filter */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setFilterCategory('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${!filterCategory ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setFilterCategory(c.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterCategory === c.value ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Documents list */}
      <div className="space-y-3">
        {documents.map((doc) => (
          <div key={doc.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start justify-between hover:shadow-md transition">
            <div className="flex items-start gap-4 flex-1">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{doc.title}</h3>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${catColor[doc.category] || catColor.general}`}>{doc.category}</span>
                  {doc.approval_status === 'pending' && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pending approval</span>
                  )}
                  {doc.approval_status === 'rejected' && (
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Rejected</span>
                  )}
                </div>
                {doc.description && <p className="text-sm text-gray-600 mt-0.5">{doc.description}</p>}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                  <span>Visible to: {doc.audience.split(',').map((r) => r + 's').join(', ')}</span>
                  <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  {doc.uploader && <span>by {doc.uploader.name}</span>}
                </div>
              </div>
            </div>
            <div className="flex gap-3 ml-4 shrink-0">
              <a href={`/uploads/${doc.file_path}`} target="_blank" rel="noreferrer"
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">View</a>
              <button onClick={() => handleDelete(doc)} className="text-red-600 hover:text-red-800 text-sm font-medium">Delete</button>
            </div>
          </div>
        ))}

        {documents.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-400">No documents yet. Upload schedules, event info, or notices to share.</p>
          </div>
        )}
      </div>

      {/* Upload modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Upload Document</h2>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="e.g. School Schedule 2026-27" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  rows={2} placeholder="Short summary of what this document contains" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                  {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visible to</label>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map((r) => (
                    <label key={r.value} className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={audience.includes(r.value)} onChange={() => toggleRole(r.value)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700">{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  File <span className="text-gray-400 font-normal">(PDF, image, Word, Excel — max 25MB)</span>
                </label>
                <label className="cursor-pointer inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  {docFile ? 'Change file' : 'Choose file'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" className="hidden"
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                </label>
                {docFile && <span className="ml-2 text-xs text-indigo-600">{docFile.name} ({(docFile.size / 1024 / 1024).toFixed(1)} MB)</span>}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">Cancel</button>
                <button type="submit" disabled={uploading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50">
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
