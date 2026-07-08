import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Notification {
  id: string;
  category: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

interface Preference { category: string; in_app: boolean; email: boolean; sms: boolean; }

const CATEGORY_LABELS: Record<string, string> = {
  marks: 'Marks & report cards',
  moderation: 'Content moderation',
  attendance: 'Attendance',
  invitation: 'Invitations',
  general: 'General',
};

const POLL_MS = 30000;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const [prefs, setPrefs] = useState<Preference[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchCount = async () => {
    try {
      const r = await api.get('/notifications/unread-count');
      setUnread(r.data.unread);
    } catch { /* not logged in / transient — ignore */ }
  };

  const fetchList = async () => {
    const r = await api.get('/notifications');
    setItems(r.data.notifications);
    setUnread(r.data.unread);
  };

  const fetchPrefs = async () => {
    const r = await api.get('/notifications/preferences');
    setPrefs(r.data.preferences);
  };

  useEffect(() => {
    fetchCount();
    const t = setInterval(fetchCount, POLL_MS);
    return () => clearInterval(t);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    setShowSettings(false);
    if (next) await fetchList();
  };

  const openItem = async (n: Notification) => {
    try {
      if (!n.read_at) {
        await api.patch(`/notifications/${n.id}/read`);
        setUnread((u) => Math.max(0, u - 1));
        setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      }
    } catch { /* ignore */ }
    if (n.link) { setOpen(false); navigate(n.link); }
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all');
    setUnread(0);
    setItems((list) => list.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
  };

  const openSettings = async () => {
    setShowSettings(true);
    if (prefs.length === 0) await fetchPrefs();
  };

  const setPref = async (category: string, channel: 'in_app' | 'email' | 'sms', value: boolean) => {
    const current = prefs.find((p) => p.category === category)!;
    const updated = { ...current, [channel]: value };
    setPrefs((list) => list.map((p) => (p.category === category ? updated : p)));
    try {
      await api.put('/notifications/preferences', {
        category, in_app: updated.in_app, email: updated.email, sms: updated.sms,
      });
    } catch { fetchPrefs(); }
  };

  const timeAgo = (iso: string) => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  return (
    <div className="fixed top-4 right-6 z-40" ref={panelRef}>
      <button onClick={toggleOpen}
        className="relative w-11 h-11 rounded-full bg-white shadow-md border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition"
        aria-label="Notifications">
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">
              {showSettings ? 'Notification settings' : 'Notifications'}
            </h3>
            <div className="flex items-center gap-2">
              {!showSettings && unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Mark all read</button>
              )}
              <button onClick={showSettings ? () => setShowSettings(false) : openSettings}
                className="text-gray-400 hover:text-gray-600" aria-label="Settings">
                {showSettings ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                )}
              </button>
            </div>
          </div>

          {showSettings ? (
            <div className="max-h-96 overflow-y-auto p-3 space-y-3">
              <p className="text-xs text-gray-500 px-1">Choose how you're notified for each type. Email needs SMTP configured; SMS needs an SMS adapter.</p>
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-2 items-center text-xs">
                <span></span>
                <span className="font-medium text-gray-500 text-center">In-app</span>
                <span className="font-medium text-gray-500 text-center">Email</span>
                <span className="font-medium text-gray-500 text-center">SMS</span>
                {prefs.map((p) => (
                  <FragmentRow key={p.category} p={p} onChange={setPref} />
                ))}
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center text-gray-400 text-sm">You're all caught up.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
              {items.map((n) => (
                <button key={n.id} onClick={() => openItem(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition flex gap-3 ${n.read_at ? '' : 'bg-indigo-50/40'}`}>
                  <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.read_at ? 'bg-transparent' : 'bg-indigo-500'}`} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-900">{n.title}</span>
                    {n.body && <span className="block text-xs text-gray-500 mt-0.5">{n.body}</span>}
                    <span className="block text-[11px] text-gray-400 mt-1">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FragmentRow({ p, onChange }: { p: Preference; onChange: (c: string, ch: 'in_app' | 'email' | 'sms', v: boolean) => void }) {
  const label = CATEGORY_LABELS[p.category] || p.category;
  return (
    <>
      <span className="text-gray-700">{label}</span>
      {(['in_app', 'email', 'sms'] as const).map((ch) => (
        <input key={ch} type="checkbox" checked={p[ch]} onChange={(e) => onChange(p.category, ch, e.target.checked)}
          className="mx-auto h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
      ))}
    </>
  );
}
