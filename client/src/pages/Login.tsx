import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import DevCredentials from '../components/DevCredentials';

export default function Login() {
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

  const handleOrgLookup = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!orgSlug.trim()) { setError('Organization ID is required'); return; }

    setLoading(true);
    try {
      const res = await api.get(`/auth/org/${orgSlug.toLowerCase().trim()}`);
      setOrgName(res.data.org.name);
      setOrgVerified(true);
    } catch {
      setError('Organization not found. Check the ID and try again.');
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
      const loggedInUser = await login(email, password, orgSlug.toLowerCase().trim());
      navigate(`/${loggedInUser.role}/dashboard`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-white to-purple-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Education Hub</h1>
          <p className="text-gray-500 mt-2">
            {orgVerified ? `Sign in to ${orgName}` : 'Enter your organization to continue'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {!orgVerified ? (
            <form onSubmit={handleOrgLookup} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization ID</label>
                <input
                  type="text"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-gray-900"
                  placeholder="e.g. demo-school"
                />
                <p className="mt-1 text-xs text-gray-400">This was set when your organization registered</p>
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50">
                {loading ? 'Looking up...' : 'Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg mb-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                </svg>
                <span className="text-sm font-medium text-indigo-700 flex-1">{orgName}</span>
                <button type="button" onClick={() => { setOrgVerified(false); setError(''); }}
                  className="text-xs text-indigo-500 hover:text-indigo-700">Change</button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-gray-900"
                  placeholder="you@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-gray-900"
                  placeholder="Enter your password" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50">
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          )}
        </div>

        <div className="text-center mt-6 space-y-3">
          <Link to="/parent-login" className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-800 text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Parent & Student Login
          </Link>
          <Link to="/register" className="text-indigo-600 hover:text-indigo-800 text-sm font-medium block">
            Register a new organization
          </Link>
          <p className="text-gray-400 text-sm">
            Education Hub - Institute Management System
            {' · '}
            <Link to="/super-login" className="hover:text-gray-600">Platform admin</Link>
          </p>

          <DevCredentials
            filter="staff"
            onSelect={(cred) => {
              setOrgSlug(cred.orgSlug);
              setEmail(cred.email);
              setPassword(cred.password);
              // Auto-verify org
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
