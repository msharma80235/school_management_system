import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../services/api';

// A contact/support control shown on every page for every signed-in user.
// Opens a small form and sends the message to the school's administrators.
export default function SupportButton() {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const location = useLocation();

  const reset = () => { setSubject(''); setMessage(''); setError(''); setDone(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 5) { setError('Please describe your issue in a little more detail.'); return; }
    setSending(true); setError('');
    try {
      const r = await api.post('/support', { subject: subject.trim(), message: message.trim(), page: location.pathname });
      setDone(r.data.message || 'Your message was sent.');
      setSubject(''); setMessage('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not send your message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating trigger — sits left of the help chat button so neither overlaps */}
      <button
        onClick={() => { reset(); setOpen(true); }}
        title="Contact support"
        aria-label="Contact support"
        className="fixed bottom-6 right-24 z-40 h-14 w-14 rounded-full bg-white border border-gray-200 text-gray-700 shadow-lg hover:bg-gray-50 hover:text-indigo-600 transition flex items-center justify-center">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824-2.167a5 5 0 00-7.072 0m0 0l2.828 2.829" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-200 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Contact support</h2>
                <p className="text-sm text-gray-500 mt-0.5">Having a problem with the website or anything else? Send a message to your school administrator.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 shrink-0" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-5">
              {done ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-sm text-gray-700">{done}</p>
                  <button onClick={() => setOpen(false)} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Close</button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3">
                  {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150}
                      placeholder="e.g. Can't open my report card"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={4000} required
                      placeholder="Describe the issue or question you have…"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                  </div>
                  <p className="text-xs text-gray-400">This goes to your school's admin, along with the page you're on. They can reply to your email.</p>
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setOpen(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm">Cancel</button>
                    <button type="submit" disabled={sending} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm disabled:opacity-50">
                      {sending ? 'Sending…' : 'Send message'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
