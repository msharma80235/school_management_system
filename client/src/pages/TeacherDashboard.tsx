import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface ClassItem {
  id: string;
  name: string;
  section: string;
  academic_year: string;
  _count: { students: number };
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/classes')
      .then((r) => setClasses(r.data.classes))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
        <p className="text-gray-500 mt-1">
          {user?.subject ? `Subject: ${user.subject}` : 'Teacher Dashboard'}
        </p>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">My Classes</h2>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : classes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <div key={cls.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md transition">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">{cls.name}{cls.section ? ` - ${cls.section}` : ''}</h3>
                  <p className="text-sm text-gray-500">{cls.academic_year}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197V21" />
                  </svg>
                  {cls._count.students}
                </span>
              </div>
              <div className="flex gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => navigate('/teacher/attendance')} className="flex-1 text-xs text-emerald-600 hover:text-emerald-800 font-medium py-1">Attendance</button>
                <button onClick={() => navigate('/teacher/exams')} className="flex-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium py-1">Marks</button>
                <button onClick={() => navigate('/teacher/homework')} className="flex-1 text-xs text-amber-600 hover:text-amber-800 font-medium py-1">Homework</button>
                <button onClick={() => navigate('/teacher/report-cards')} className="flex-1 text-xs text-purple-600 hover:text-purple-800 font-medium py-1">Reports</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-700">No classes assigned yet</h2>
          <p className="text-gray-400 mt-2">Your admin hasn't assigned you as class teacher for any class. Contact them to get assigned.</p>
        </div>
      )}
    </div>
  );
}
