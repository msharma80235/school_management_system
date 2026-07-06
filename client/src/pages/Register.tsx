import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function Register() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    org_name: '', org_email: '', org_phone: '', org_address: '',
    admin_name: '', admin_email: '', admin_password: '', admin_confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (step === 1) {
      if (!form.org_name || !form.org_email) {
        setError('Organization name and email are required');
        return;
      }
      setStep(2);
      return;
    }

    if (!form.admin_name || !form.admin_email || !form.admin_password) {
      setError('All admin fields are required');
      return;
    }
    if (form.admin_password !== form.admin_confirm) {
      setError('Passwords do not match');
      return;
    }
    if (form.admin_password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/org/register', form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      localStorage.setItem('org', JSON.stringify(res.data.org));
      navigate('/admin/dashboard');
      window.location.reload();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-white to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Register Your Organization</h1>
          <p className="text-gray-500 mt-2">Step {step} of 2 - {step === 1 ? 'Organization Details' : 'Admin Account'}</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-2 mb-6">
          <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-emerald-600' : 'bg-gray-200'}`} />
          <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-emerald-600' : 'bg-gray-200'}`} />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name *</label>
                  <input type="text" value={form.org_name} onChange={set('org_name')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-gray-900"
                    placeholder="e.g. Springfield Academy" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Organization Email *</label>
                  <input type="email" value={form.org_email} onChange={set('org_email')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-gray-900"
                    placeholder="info@springfield.edu" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={form.org_phone} onChange={set('org_phone')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-gray-900"
                    placeholder="+1 234 567 890" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea value={form.org_address} onChange={set('org_address')} rows={2}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-gray-900"
                    placeholder="123 Main St, City" />
                </div>
                <button type="submit"
                  className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition">
                  Next - Set Up Admin Account
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name *</label>
                  <input type="text" value={form.admin_name} onChange={set('admin_name')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-gray-900"
                    placeholder="John Smith" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email *</label>
                  <input type="email" value={form.admin_email} onChange={set('admin_email')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-gray-900"
                    placeholder="admin@springfield.edu" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                  <input type="password" value={form.admin_password} onChange={set('admin_password')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-gray-900"
                    placeholder="Min 6 characters" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password *</label>
                  <input type="password" value={form.admin_confirm} onChange={set('admin_confirm')}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-gray-900"
                    placeholder="Re-enter password" required />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition">
                    Back
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50">
                    {loading ? 'Creating...' : 'Create Organization'}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>

        <p className="text-center mt-6">
          <a href="/login" className="text-emerald-600 hover:text-emerald-800 text-sm font-medium">
            Already have an account? Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
