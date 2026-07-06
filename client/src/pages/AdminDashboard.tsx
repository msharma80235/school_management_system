import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalTeachers: 0, activeTeachers: 0, inactiveTeachers: 0,
    totalClasses: 0, totalStudents: 0,
  });

  useEffect(() => {
    Promise.all([
      api.get('/users/teachers?limit=100'),
      api.get('/classes'),
      api.get('/students?limit=1'),
    ]).then(([teacherRes, classRes, studentRes]) => {
      const teachers = teacherRes.data.teachers;
      setStats({
        totalTeachers: teacherRes.data.pagination.total,
        activeTeachers: teachers.filter((t: any) => t.is_active).length,
        inactiveTeachers: teachers.filter((t: any) => !t.is_active).length,
        totalClasses: classRes.data.classes.length,
        totalStudents: studentRes.data.pagination.total,
      });
    });
  }, []);

  const cards = [
    { label: 'Total Classes', value: stats.totalClasses, color: 'bg-indigo-500', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', link: '/admin/classes' },
    { label: 'Total Students', value: stats.totalStudents, color: 'bg-emerald-500', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', link: '/admin/students' },
    { label: 'Active Teachers', value: stats.activeTeachers, color: 'bg-blue-500', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197V21', link: '/admin/teachers' },
    { label: 'Total Teachers', value: stats.totalTeachers, color: 'bg-purple-500', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m9 5.197V21', link: '/admin/teachers' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.name}</h1>
        <p className="text-gray-500 mt-1">Here's an overview of your institute</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div
            key={card.label}
            onClick={() => navigate(card.link)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
