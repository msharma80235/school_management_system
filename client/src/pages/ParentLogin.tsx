import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import DevCredentials from '../components/DevCredentials';

export default function ParentLogin() {
  const [orgSlug, setOrgSlug] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgVerified, setOrgVerified] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user: currentUser } = useAuth();
  const navigate = useNavigate();

  if (currentUser) {
    return <Navigate to={`/${currentUser.role}/dashboard`} replace />;
  }

  const slug = orgSlug.toLowerCase().trim();

  const handleOrgLookup = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!orgSlug.trim()) { setError('School ID is required'); return; }
    setLoading(true);
    try {
      const res = await api.get(`/auth/org/${slug}`);
      setOrgName(res.data.org.name);
      setOrgVerified(true);
    } catch {
      setError('School not found. Please check the ID provided by your school.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true);
    try {
      const loggedInUser = await login(email, password, slug);
      if (loggedInUser.role === 'parent') navigate('/parent/dashboard');
      else if (loggedInUser.role === 'student') navigate('/student/dashboard');
      else {
        setError('This portal is for parents and students only. Please use the staff login.');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('org');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex flex-col">
      <header className="p-4 flex justify-end">
        <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Staff Login
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-emerald-600 rounded-full mb-4">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Parent & Student Portal</h1>
            <p className="text-gray-500 mt-2">
              {orgVerified ? `Welcome to ${orgName}` : 'Access your academic information'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
            )}

            {!orgVerified ? (
              <form onSubmit={handleOrgLookup} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School ID</label>
                  <input type="text" value={orgSlug} onChange={(e) => setOrgSlug(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-gray-900"
                    placeholder="Enter your school's ID" />
                  <p className="mt-1 text-xs text-gray-400">Your school will provide this ID to you</p>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50">
                  {loading ? 'Looking up...' : 'Continue'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg mb-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                  </svg>
                  <span className="text-sm font-medium text-emerald-700 flex-1">{orgName}</span>
                  <button type="button" onClick={() => { setOrgVerified(false); setError(''); }}
                    className="text-xs text-emerald-500 hover:text-emerald-700">Change</button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-gray-900"
                    placeholder="you@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-gray-900"
                    placeholder="Enter your password" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50">
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            )}

            {/* Registration is invite-only */}
            <div className="mt-5 pt-5 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Don't have an account? Registration is by invitation only.
              </p>
              <Link to="/join" className="inline-flex items-center gap-1.5 mt-1 text-sm text-emerald-600 hover:text-emerald-800 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                I have an invitation code
              </Link>
              <p className="text-xs text-gray-400 mt-1">No invite? Ask your school's office to send you one.</p>
            </div>
          </div>

          {/* Info cards */}
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/70 rounded-xl p-3 border border-gray-100">
              <svg className="w-6 h-6 text-emerald-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-gray-600">Attendance</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3 border border-gray-100">
              <svg className="w-6 h-6 text-emerald-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-xs text-gray-600">Reports</p>
            </div>
            <div className="bg-white/70 rounded-xl p-3 border border-gray-100">
              <svg className="w-6 h-6 text-emerald-600 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="text-xs text-gray-600">Grades</p>
            </div>
          </div>

          <p className="text-center text-gray-400 text-sm mt-6">Education Hub - Parent & Student Portal</p>

          <DevCredentials
            filter="parent-student"
            onSelect={(cred) => {
              setOrgSlug(cred.orgSlug);
              setEmail(cred.email);
              setPassword(cred.password);
              api.get(`/auth/org/${cred.orgSlug}`).then((res) => {
                setOrgName(res.data.org.name);
                setOrgVerified(true);
              });
            }}
          />
        </div>
      </div>
    </div>
  );
}
