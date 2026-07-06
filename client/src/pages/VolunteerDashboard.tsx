import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  remarks: string | null;
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

export default function VolunteerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classCount, setClassCount] = useState(0);
  const [homeworkCount, setHomeworkCount] = useState(0);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    api.get('/classes').then((r) => setClassCount(r.data.classes.length)).catch(() => {});
    api.get('/homework?upcoming=true').then((r) => setHomeworkCount(r.data.homework.length)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get(`/volunteer-attendance/my?month=${month}&year=${year}`)
      .then((r) => { setAttendance(r.data.attendance); setSummary(r.data.summary); })
      .catch(() => {});
  }, [month, year]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const statusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'late': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const cards = [
    {
      label: 'Mark Attendance', desc: 'Record daily attendance for any class', link: '/volunteer/attendance',
      color: 'bg-emerald-500',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
    },
    {
      label: 'View Homework', desc: `${homeworkCount} upcoming assignments`, link: '/volunteer/homework',
      color: 'bg-indigo-500',
      icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
    },
    {
      label: 'View Report Cards', desc: `Marksheets for ${classCount} classes`, link: '/volunteer/report-cards',
      color: 'bg-purple-500',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
        <p className="text-gray-500 mt-1">Volunteer Dashboard</p>
      </div>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        As a volunteer you can <strong>mark attendance</strong> for students, and <strong>view</strong> homework
        assignments and report cards. Marks and homework can only be changed by teachers and admins.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div key={card.label} onClick={() => navigate(card.link)}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition">
            <div className={`w-12 h-12 ${card.color} rounded-lg flex items-center justify-center mb-4`}>
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900">{card.label}</h3>
            <p className="text-sm text-gray-500 mt-1">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* My Attendance (read-only) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">My Attendance</h2>
            <p className="text-xs text-gray-400 mt-0.5">Recorded by the school — contact an admin for corrections</p>
          </div>
          <div className="flex items-center gap-2">
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
              {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
              {[2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {summary && summary.total > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
                <p className="text-xs text-gray-500">Total Days</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">{summary.present}</p>
                <p className="text-xs text-green-600">Present</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{summary.absent}</p>
                <p className="text-xs text-red-600">Absent</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">{summary.late}</p>
                <p className="text-xs text-yellow-600">Late</p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-indigo-700">{summary.percentage}%</p>
                <p className="text-xs text-indigo-600">Attendance</p>
              </div>
            </div>

            <div className="space-y-2">
              {attendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                  <span className="text-sm text-gray-700">{a.date}</span>
                  <div className="flex items-center gap-2">
                    {a.remarks && <span className="text-xs text-gray-400">{a.remarks}</span>}
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor(a.status)}`}>
                      {a.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-center py-8">No attendance recorded for {monthNames[month - 1]} {year}</p>
        )}
      </div>
    </div>
  );
}
