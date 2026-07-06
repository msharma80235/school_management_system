import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface Assignment {
  id: string;
  assignment_type: string;
  details: string | null;
  created_at: string;
  class: { id: string; name: string; section: string } | null;
}

const typeStyles: Record<string, { color: string; icon: string }> = {
  class: { color: 'bg-indigo-500', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  laboratory: { color: 'bg-purple-500', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  office: { color: 'bg-blue-500', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
};

export default function StaffDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/users/staff/my-assignments')
      .then((r) => setAssignments(r.data.assignments))
      .finally(() => setLoading(false));
  }, []);

  const label = (a: Assignment) => {
    if (a.assignment_type === 'class' && a.class) {
      return `${a.class.name}${a.class.section ? ' - ' + a.class.section : ''}`;
    }
    return a.assignment_type.charAt(0).toUpperCase() + a.assignment_type.slice(1);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
        <p className="text-gray-500 mt-1">Administrative Staff Dashboard</p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">My Duties</h2>
        <button onClick={() => navigate('/staff/calendar')}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          School Calendar
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : assignments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assignments.map((a) => {
            const style = typeStyles[a.assignment_type] || { color: 'bg-emerald-500', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' };
            return (
              <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-start gap-4">
                <div className={`w-11 h-11 ${style.color} rounded-lg flex items-center justify-center shrink-0`}>
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={style.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 capitalize">{label(a)}</h3>
                  {a.details && <p className="text-sm text-gray-600 mt-0.5">{a.details}</p>}
                  <p className="text-xs text-gray-400 mt-1">Assigned {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No duties assigned yet. Your admin will assign your responsibilities.</p>
        </div>
      )}
    </div>
  );
}
