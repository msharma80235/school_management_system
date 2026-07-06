import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SchoolDoc {
  id: string;
  title: string;
  description: string | null;
  category: string;
  file_path: string;
  created_at: string;
  approval_status: string;
  review_note: string | null;
  uploader: { id: string; name: string } | null;
}

const CAT_LABELS: Record<string, string> = {
  schedule: 'Schedules', event: 'Events', notice: 'Notices', circular: 'Circulars', general: 'General',
};

const CATEGORIES = [
  { value: 'schedule', label: 'Schedule' },
  { value: 'event', label: 'Event' },
  { value: 'notice', label: 'Notice' },
  { value: 'circular', label: 'Circular' },
  { value: 'general', label: 'General' },
];

const catColor: Record<string, string> = {
  schedule: 'bg-blue-100 text-blue-700',
  event: 'bg-purple-100 text-purple-700',
  notice: 'bg-amber-100 text-amber-700',
  circular: 'bg-cyan-100 text-cyan-700',
  general: 'bg-gray-100 text-gray-600',
};

export default function SchoolDocuments() {
  const { user } = useAuth();
  const canSubmit = user?.role === 'teacher' || user?.role === 'staff';

  const [documents, setDocuments] = useState<SchoolDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'general' });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchDocs = () => {
    api.get('/documents')
      .then((r) => setDocuments(r.data.documents))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!docFile) { setError('Choose a file to upload'); return; }

    try {
      setUploading(true);
      const fd = new FormData();
      fd.append('file', docFile);
      fd.append('title', form.title.trim());
      fd.append('description', form.description);
      fd.append('category', form.category);
      const r = await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess(r.data.message);
      setShowModal(false);
      setForm({ title: '', description: '', category: 'general' });
      setDocFile(null);
      fetchDocs();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Own not-yet-approved submissions surface separately so their status is visible
  const mySubmissions = documents.filter((d) => d.uploader?.id === user?.id && d.approval_status !== 'approved');
  const published = documents.filter((d) => d.approval_status === 'approved');

  const grouped = published.reduce<Record<string, SchoolDoc[]>>((acc, doc) => {
    (acc[doc.category] = acc[doc.category] || []).push(doc);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Documents</h1>
          <p className="text-gray-500 text-sm mt-1">Schedules, event information, and notices shared by the school</p>
        </div>
        {canSubmit && (
          <button onClick={() => { setError(''); setShowModal(true); }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            Submit Document
          </button>
        )}
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && !showModal && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Own submissions awaiting review or rejected */}
      {mySubmissions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">My Submissions</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
            {mySubmissions.map((doc) => (
              <div key={doc.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 truncate">{doc.title}</span>
                    {doc.approval_status === 'pending' ? (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 shrink-0">Pending approval</span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 shrink-0">Rejected</span>
                    )}
                  </div>
                  {doc.approval_status === 'rejected' && doc.review_note && (
                    <p className="text-xs text-red-600 mt-0.5">Moderator note: {doc.review_note}</p>
                  )}
                </div>
                <a href={`/uploads/${doc.file_path}`} target="_blank" rel="noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium shrink-0">View</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : published.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-400">No documents shared yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, docs]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {CAT_LABELS[category] || category} <span className="text-gray-300 font-normal normal-case">({docs.length})</span>
              </h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
                {docs.map((doc) => (
                  <a key={doc.id} href={`/uploads/${doc.file_path}`} target="_blank" rel="noreferrer"
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition group">
                    <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 group-hover:text-indigo-700 truncate">{doc.title}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 ${catColor[doc.category] || catColor.general}`}>{doc.category}</span>
                      </div>
                      {doc.description && <p className="text-sm text-gray-500 truncate">{doc.description}</p>}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{new Date(doc.created_at).toLocaleDateString()}</span>
                    <svg className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Submit modal (teacher/staff — goes to moderation) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Submit Document</h2>
              <p className="text-sm text-gray-500 mt-0.5">A moderator will review it before it is published to the school</p>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="e.g. Science Fair Guidelines" required />
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
                  {uploading ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
