import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import DevCredentials from '../components/DevCredentials';

export default function SuperLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  // Only bounce if already signed in AS the super admin — an active org session
  // (e.g. a school admin) must still be able to reach this page and switch.
  if (currentUser?.role === 'superadmin') {
    return <Navigate to="/superadmin/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required'); return; }

    setLoading(true);
    try {
      const res = await api.post('/auth/super-login', { email, password });
      // Replace any existing org session with the platform session
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      localStorage.removeItem('org');
      navigate('/superadmin/dashboard');
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Platform Administration</h1>
          <p className="text-gray-400 mt-2">Education Hub — super admin access</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-gray-900"
                placeholder="super@educationhub.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition text-gray-900"
                placeholder="Enter your password" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-amber-500 text-gray-900 py-3 rounded-lg font-bold hover:bg-amber-400 transition disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6">
          <Link to="/login" className="text-gray-400 hover:text-gray-200 text-sm">← Back to school login</Link>
        </p>

        <DevCredentials
          filter="super"
          onSelect={(cred) => { setEmail(cred.email); setPassword(cred.password); }}
        />
      </div>
    </div>
  );
}
