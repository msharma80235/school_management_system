import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

interface ChildInfo {
  id: string;
  first_name: string;
  last_name: string;
  roll_number: string;
  date_of_birth: string;
  gender: string;
  parent_name: string;
  parent_phone: string;
  address: string | null;
  is_active: boolean;
  class: { id: string; name: string; section: string; academic_year: string };
}

interface ParentInfo {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  is_locked: boolean;
  created_at: string;
  has_active_students: boolean;
  students: ChildInfo[];
}

export default function ParentDetail() {
  const { parentId } = useParams();
  const navigate = useNavigate();
  const [parent, setParent] = useState<ParentInfo | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/parents/${parentId}`)
      .then((r) => setParent(r.data.parent))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load parent'))
      .finally(() => setLoading(false));
  }, [parentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !parent) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-500 mb-4">{error || 'Parent not found'}</p>
        <button onClick={() => navigate(-1)} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm">Go back</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <button onClick={() => navigate(-1)} className="hover:text-indigo-600 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <span>/</span>
        <Link to="/admin/parents" className="hover:text-indigo-600">Parents</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{parent.name}</span>
      </div>

      {/* No active enrolled student banner */}
      {!parent.has_active_students && (
        <div className="mb-4 p-4 bg-gray-100 border border-gray-300 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <p className="text-sm text-gray-600 font-medium">No active enrolled student under this parent.</p>
        </div>
      )}

      {/* Parent profile card — greyed out when no active enrolled student */}
      <div className={`rounded-xl shadow-sm border border-gray-200 p-6 mb-6 ${parent.has_active_students ? 'bg-white' : 'bg-gray-100 opacity-80'}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${parent.has_active_students ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-500'}`}>
              {parent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-2xl font-bold ${parent.has_active_students ? 'text-gray-900' : 'text-gray-500'}`}>{parent.name}</h1>
                {!parent.has_active_students && (
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-600">No active enrolled student</span>
                )}
                {parent.is_locked ? (
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Locked</span>
                ) : parent.is_active ? (
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Active</span>
                ) : (
                  <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Inactive</span>
                )}
              </div>
              <p className="text-gray-500 text-sm mt-0.5">{parent.email}</p>
              <p className="text-gray-400 text-xs mt-1">Parent account · joined {new Date(parent.created_at).toLocaleDateString()}</p>
            </div>
          </div>
          <Link to="/admin/users"
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium shrink-0">
            Manage account →
          </Link>
        </div>
      </div>

      {/* Children */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Children <span className="text-gray-300 font-normal normal-case">({parent.students.length})</span>
      </h2>
      {parent.students.length === 0 ? (
        <div className="bg-gray-100 rounded-xl shadow-sm border border-gray-200 p-8 text-center text-sm text-gray-500">
          No active enrolled student under this parent — no students are linked yet. Link one from the Parents page.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {parent.students.map((s) => (
            <div key={s.id} className={`rounded-xl shadow-sm border border-gray-200 p-5 ${s.is_active ? 'bg-white' : 'bg-gray-100 opacity-75'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'}`}>
                    {s.first_name.charAt(0)}{s.last_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className={`font-semibold flex items-center gap-2 ${s.is_active ? 'text-gray-900' : 'text-gray-500'}`}>
                      {s.first_name} {s.last_name}
                      {!s.is_active && <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">Not enrolled</span>}
                    </h3>
                    <p className="text-xs text-gray-400 font-mono">{s.roll_number}</p>
                  </div>
                </div>
                <Link to={`/admin/classes/${s.class.id}/students`}
                  className="text-indigo-600 hover:text-indigo-800 text-xs font-medium shrink-0">
                  View class →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                <div><span className="text-gray-400">Class:</span> <span className="text-gray-700">{s.class.name}{s.class.section ? ` - ${s.class.section}` : ''}</span></div>
                <div><span className="text-gray-400">Year:</span> <span className="text-gray-700">{s.class.academic_year}</span></div>
                <div><span className="text-gray-400">DOB:</span> <span className="text-gray-700">{s.date_of_birth}</span></div>
                <div><span className="text-gray-400">Gender:</span> <span className="text-gray-700 capitalize">{s.gender}</span></div>
                <div className="col-span-2"><span className="text-gray-400">Guardian on record:</span> <span className="text-gray-700">{s.parent_name} · {s.parent_phone}</span></div>
                {s.address && <div className="col-span-2"><span className="text-gray-400">Address:</span> <span className="text-gray-700">{s.address}</span></div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
