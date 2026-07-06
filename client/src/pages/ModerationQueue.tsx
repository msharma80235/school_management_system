import { useEffect, useState } from 'react';
import api from '../services/api';

interface Person { id: string; name: string; role?: string; }
interface PendingBook {
  id: string; title: string; author: string; file_path: string | null;
  isbn: string | null; publisher: string | null; edition: string | null;
  is_mandatory: boolean; created_at: string;
  approval_status: string; review_note: string | null; reviewed_at: string | null;
  subject: { name: string } | null; custom_category: string | null;
  class: { name: string; section: string } | null;
  uploader: Person | null; reviewer: Person | null;
}
interface PendingDoc {
  id: string; title: string; description: string | null; category: string;
  file_path: string; audience: string; created_at: string;
  approval_status: string; review_note: string | null; reviewed_at: string | null;
  uploader: Person | null; reviewer: Person | null;
}

type RejectTarget = { kind: 'books' | 'documents'; id: string; title: string } | null;
type ViewTarget = { kind: 'books'; book: PendingBook } | { kind: 'documents'; doc: PendingDoc } | null;

// Inline preview for the uploaded file: images render directly, PDFs embed, others get a download link
function FilePreview({ filePath }: { filePath: string }) {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const url = `/uploads/${filePath}`;
  if (['jpg', 'jpeg', 'png'].includes(ext)) {
    return <img src={url} alt="Uploaded file" className="w-full max-h-96 object-contain rounded-lg border border-gray-200 bg-gray-50" />;
  }
  if (ext === 'pdf') {
    return <iframe src={url} title="Uploaded file" className="w-full h-96 rounded-lg border border-gray-200 bg-gray-50" />;
  }
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
      Download {ext.toUpperCase()} file
    </a>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex text-sm py-1.5">
      <span className="w-32 shrink-0 text-gray-400">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

const statusBadge = (status: string) =>
  status === 'approved'
    ? 'bg-green-100 text-green-700'
    : status === 'rejected'
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700';

export default function ModerationQueue() {
  const [books, setBooks] = useState<PendingBook[]>([]);
  const [documents, setDocuments] = useState<PendingDoc[]>([]);
  const [recentBooks, setRecentBooks] = useState<PendingBook[]>([]);
  const [recentDocs, setRecentDocs] = useState<PendingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<RejectTarget>(null);
  const [viewTarget, setViewTarget] = useState<ViewTarget>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [modalError, setModalError] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const fetchQueue = async () => {
    const r = await api.get('/moderation/queue');
    setBooks(r.data.pending.books);
    setDocuments(r.data.pending.documents);
    setRecentBooks(r.data.recent.books);
    setRecentDocs(r.data.recent.documents);
    setLoading(false);
  };

  useEffect(() => { fetchQueue(); }, []);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const approve = async (kind: 'books' | 'documents', id: string) => {
    try {
      const r = await api.patch(`/moderation/${kind}/${id}`, { action: 'approve' });
      flash(r.data.message);
      setViewTarget(null);
      fetchQueue();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed');
      setTimeout(() => setError(''), 4000);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget) return;
    setModalError('');
    try {
      const r = await api.patch(`/moderation/${rejectTarget.kind}/${rejectTarget.id}`, { action: 'reject', note: rejectNote });
      flash(r.data.message);
      setRejectTarget(null);
      setRejectNote('');
      fetchQueue();
    } catch (err: any) {
      setModalError(err.response?.data?.error || 'Failed');
    }
  };

  const pendingCount = books.length + documents.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Moderation</h1>
        <p className="text-gray-500 text-sm mt-1">
          {pendingCount === 0 ? 'Nothing waiting for review' : `${pendingCount} item${pendingCount > 1 ? 's' : ''} waiting for review`}
        </p>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Pending books */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Pending Books <span className="text-gray-300 font-normal normal-case">({books.length})</span>
        </h2>
        {books.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">No books awaiting approval</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
            {books.map((b) => (
              <div key={b.id} className="px-5 py-4 flex items-start justify-between hover:bg-gray-50 transition">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{b.title}</h3>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pending</span>
                  </div>
                  <p className="text-sm text-gray-600">by {b.author}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{b.subject?.name || b.custom_category || 'Uncategorized'}</span>
                    <span>{b.class ? `${b.class.name}${b.class.section ? ` - ${b.class.section}` : ''}` : 'All classes'}</span>
                    {b.uploader && <span>submitted by {b.uploader.name} ({b.uploader.role})</span>}
                  </div>
                  {b.file_path && (
                    <a href={`/uploads/${b.file_path}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      Review copy
                    </a>
                  )}
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button onClick={() => setViewTarget({ kind: 'books', book: b })}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition">View</button>
                  <button onClick={() => approve('books', b.id)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">Approve</button>
                  <button onClick={() => { setRejectTarget({ kind: 'books', id: b.id, title: b.title }); setRejectNote(''); setModalError(''); }}
                    className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending documents */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Pending Documents <span className="text-gray-300 font-normal normal-case">({documents.length})</span>
        </h2>
        {documents.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-sm text-gray-400">No documents awaiting approval</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
            {documents.map((d) => (
              <div key={d.id} className="px-5 py-4 flex items-start justify-between hover:bg-gray-50 transition">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-900">{d.title}</h3>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize bg-gray-100 text-gray-600">{d.category}</span>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pending</span>
                  </div>
                  {d.description && <p className="text-sm text-gray-600 mt-0.5">{d.description}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>Visible to: {d.audience.split(',').map((r) => r + 's').join(', ')}</span>
                    <span>{new Date(d.created_at).toLocaleDateString()}</span>
                    {d.uploader && <span>submitted by {d.uploader.name} ({d.uploader.role})</span>}
                  </div>
                  <a href={`/uploads/${d.file_path}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    Review file
                  </a>
                </div>
                <div className="flex gap-2 ml-4 shrink-0">
                  <button onClick={() => setViewTarget({ kind: 'documents', doc: d })}
                    className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition">View</button>
                  <button onClick={() => approve('documents', d.id)}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition">Approve</button>
                  <button onClick={() => { setRejectTarget({ kind: 'documents', id: d.id, title: d.title }); setRejectNote(''); setModalError(''); }}
                    className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent decisions */}
      {(recentBooks.length > 0 || recentDocs.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Recently Reviewed</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 divide-y divide-gray-100">
            {recentBooks.map((b) => (
              <div key={b.id} className="px-5 py-3 flex items-center justify-between text-sm hover:bg-gray-50 transition">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400 shrink-0">Book</span>
                  <span className="font-medium text-gray-900 truncate">{b.title}</span>
                  {b.review_note && <span className="text-xs text-gray-400 truncate">— {b.review_note}</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(b.approval_status)}`}>{b.approval_status}</span>
                  {b.reviewer && <span className="text-xs text-gray-400">by {b.reviewer.name}</span>}
                  <button onClick={() => setViewTarget({ kind: 'books', book: b })}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">View</button>
                </div>
              </div>
            ))}
            {recentDocs.map((d) => (
              <div key={d.id} className="px-5 py-3 flex items-center justify-between text-sm hover:bg-gray-50 transition">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400 shrink-0">Document</span>
                  <span className="font-medium text-gray-900 truncate">{d.title}</span>
                  {d.review_note && <span className="text-xs text-gray-400 truncate">— {d.review_note}</span>}
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(d.approval_status)}`}>{d.approval_status}</span>
                  {d.reviewer && <span className="text-xs text-gray-400">by {d.reviewer.name}</span>}
                  <button onClick={() => setViewTarget({ kind: 'documents', doc: d })}
                    className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">View</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View details modal */}
      {viewTarget && (() => {
        const item = viewTarget.kind === 'books' ? viewTarget.book : viewTarget.doc;
        const isPending = item.approval_status === 'pending';
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-900">{item.title}</h2>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusBadge(item.approval_status)}`}>{item.approval_status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{viewTarget.kind === 'books' ? 'Book submission' : 'Document submission'}</p>
                </div>
                <button onClick={() => setViewTarget(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Metadata */}
                <div className="bg-gray-50 rounded-xl p-4 divide-y divide-gray-100">
                  {viewTarget.kind === 'books' ? (
                    <>
                      <DetailRow label="Author" value={viewTarget.book.author} />
                      <DetailRow label="Subject" value={viewTarget.book.subject?.name || viewTarget.book.custom_category || 'Uncategorized'} />
                      <DetailRow label="Class" value={viewTarget.book.class ? `${viewTarget.book.class.name}${viewTarget.book.class.section ? ` - ${viewTarget.book.class.section}` : ''}` : 'All classes'} />
                      <DetailRow label="Publisher" value={viewTarget.book.publisher} />
                      <DetailRow label="Edition" value={viewTarget.book.edition} />
                      <DetailRow label="ISBN" value={viewTarget.book.isbn && <span className="font-mono">{viewTarget.book.isbn}</span>} />
                      <DetailRow label="Type" value={viewTarget.book.is_mandatory ? 'Mandatory' : 'Optional'} />
                    </>
                  ) : (
                    <>
                      <DetailRow label="Description" value={viewTarget.doc.description} />
                      <DetailRow label="Category" value={<span className="capitalize">{viewTarget.doc.category}</span>} />
                      <DetailRow label="Visible to" value={viewTarget.doc.audience.split(',').map((r) => r + 's').join(', ')} />
                    </>
                  )}
                  <DetailRow label="Submitted by" value={item.uploader ? `${item.uploader.name}${item.uploader.role ? ` (${item.uploader.role})` : ''}` : 'Unknown'} />
                  <DetailRow label="Submitted on" value={new Date(item.created_at).toLocaleString()} />
                  {item.reviewer && <DetailRow label="Reviewed by" value={`${item.reviewer.name}${item.reviewed_at ? ` on ${new Date(item.reviewed_at).toLocaleString()}` : ''}`} />}
                  {item.review_note && <DetailRow label="Review note" value={<span className="text-red-600">{item.review_note}</span>} />}
                </div>

                {/* Uploaded file */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">Uploaded File</h3>
                    {item.file_path && (
                      <a href={`/uploads/${item.file_path}`} target="_blank" rel="noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium inline-flex items-center gap-1">
                        Open in new tab
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    )}
                  </div>
                  {item.file_path ? (
                    <FilePreview filePath={item.file_path} />
                  ) : (
                    <p className="text-sm text-gray-400 bg-gray-50 rounded-lg p-4 text-center">No file attached to this book — review the details above.</p>
                  )}
                </div>

                {/* Actions for pending items */}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setViewTarget(null)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Close</button>
                  {isPending && (
                    <>
                      <button onClick={() => { setViewTarget(null); setRejectTarget({ kind: viewTarget.kind, id: item.id, title: item.title }); setRejectNote(''); setModalError(''); }}
                        className="flex-1 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 font-medium">Reject</button>
                      <button onClick={() => approve(viewTarget.kind, item.id)}
                        className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Approve</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Reject modal */}
      {rejectTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Reject "{rejectTarget.title}"</h2>
              <p className="text-sm text-gray-500 mt-0.5">The submitter will see your note and can fix and resubmit</p>
            </div>
            <div className="p-6 space-y-4">
              {modalError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{modalError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="e.g. Wrong file attached, please upload the correct edition" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRejectTarget(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button onClick={submitReject} disabled={!rejectNote.trim()}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50">Reject</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
