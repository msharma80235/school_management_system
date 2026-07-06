import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

interface InviteInfo {
  code: string;
  role: string;
  name: string | null;
  email: string | null;
  subject: string | null;
  student: { first_name: string; last_name: string; roll_number: string } | null;
  org: { name: string; slug: string };
}

const roleLabel: Record<string, string> = {
  teacher: 'Teacher', student: 'Student', parent: 'Parent', volunteer: 'Volunteer', staff: 'Administrative Staff',
};

export default function JoinPage() {
  const { code: urlCode } = useParams();
  const navigate = useNavigate();
  const [codeInput, setCodeInput] = useState('');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const lookup = async (code: string) => {
    setLookupError('');
    setInvite(null);
    try {
      const r = await api.get(`/invites/lookup/${code.trim().toUpperCase()}`);
      const inv: InviteInfo = r.data.invite;
      setInvite(inv);
      setForm((f) => ({ ...f, name: inv.name || f.name, email: inv.email || f.email }));
    } catch (err: any) {
      setLookupError(err.response?.data?.error || 'Invitation not found');
    }
  };

  useEffect(() => {
    if (urlCode) lookup(urlCode);
  }, [urlCode]);

  const handleAccept = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!invite) return;
    if (!form.name || !form.email || !form.password) { setError('All fields are required'); return; }
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const r = await api.post(`/invites/accept/${invite.code}`, {
        name: form.name, email: form.email, password: form.password,
      });
      localStorage.setItem('token', r.data.token);
      localStorage.setItem('user', JSON.stringify(r.data.user));
      localStorage.setItem('org', JSON.stringify(r.data.org));
      navigate(`/${r.data.user.role}/dashboard`);
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Join Your School</h1>
          <p className="text-gray-500 mt-2">
            {invite ? `You've been invited to ${invite.org.name}` : 'Enter your invitation code to get started'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {!invite ? (
            <div className="space-y-4">
              {lookupError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{lookupError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invitation Code</label>
                <input type="text" value={codeInput} onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-gray-900 font-mono tracking-widest text-center text-lg"
                  placeholder="XXXXXXXX" maxLength={8} />
                <p className="mt-1 text-xs text-gray-400">Your school shared this with you (8 characters)</p>
              </div>
              <button onClick={() => codeInput.trim() && lookup(codeInput)}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition">
                Find My Invitation
              </button>
            </div>
          ) : (
            <form onSubmit={handleAccept} className="space-y-4">
              {/* Invite summary */}
              <div className="p-4 bg-indigo-50 rounded-lg space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-indigo-800">{invite.org.name}</span>
                  <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-600 text-white">
                    {roleLabel[invite.role] || invite.role}
                  </span>
                </div>
                {invite.subject && <p className="text-xs text-indigo-600">Subject: {invite.subject}</p>}
                {invite.student && (
                  <p className="text-xs text-indigo-600">
                    {invite.role === 'student' ? 'Linked to your record: ' : 'Your child: '}
                    {invite.student.first_name} {invite.student.last_name} ({invite.student.roll_number})
                  </p>
                )}
              </div>

              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email {invite.email && <span className="text-gray-400 font-normal">(this invite is locked to this email)</span>}
                </label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  readOnly={!!invite.email}
                  className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900 ${invite.email ? 'bg-gray-50' : ''}`} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                    placeholder="Min 6 chars" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm</label>
                  <input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50">
                {loading ? 'Creating your account...' : `Join as ${roleLabel[invite.role] || invite.role}`}
              </button>

              <button type="button" onClick={() => { setInvite(null); setCodeInput(''); }}
                className="w-full text-sm text-gray-400 hover:text-gray-600">Use a different code</button>
            </form>
          )}
        </div>

        <p className="text-center mt-6 text-sm text-gray-400">
          Already have an account? <Link to="/login" className="text-indigo-600 hover:text-indigo-800 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
