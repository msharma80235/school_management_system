import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import HomeworkList from '../components/HomeworkList';
import BookList from '../components/BookList';

interface Quiz {
  id: string;
  name: string;
  subject: { name: string; code: string };
  time_limit_min: number | null;
  question_count: number;
  attempt: { submitted_at: string; score: number | null; max_score: number | null } | null;
}

interface StudentProfile {
  id: string;
  first_name: string;
  last_name: string;
  roll_number: string;
  date_of_birth: string;
  gender: string;
  parent_name: string;
  parent_phone: string;
  address: string | null;
  class: { id: string; name: string; section: string; academic_year: string };
}

interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  remarks: string | null;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [homework, setHomework] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHomework = () => api.get('/homework/my').then((res) => setHomework(res.data.homework)).catch(() => {});

  useEffect(() => {
    api.get('/student-account/my-profile')
      .then((res) => setProfile(res.data.student))
      .finally(() => setLoading(false));
    loadHomework();
    api.get('/books/my').then((res) => setBooks(res.data.books)).catch(() => {});
    api.get('/exams/my-quizzes').then((res) => setQuizzes(res.data.quizzes)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get(`/student-account/my-attendance?month=${month}&year=${year}`)
      .then((res) => {
        setAttendance(res.data.attendance);
        setSummary(res.data.summary);
      });
  }, [month, year]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const statusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'late': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
        <p className="text-gray-500 mt-1">View your academic details and attendance</p>
      </div>

      {!profile ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-400">Student profile not found. Please contact your school administrator.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-2xl font-bold">
                {profile.first_name.charAt(0)}{profile.last_name.charAt(0)}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{profile.first_name} {profile.last_name}</h2>
                <p className="text-gray-500">{profile.class.name}{profile.class.section ? ` - ${profile.class.section}` : ''} | {profile.class.academic_year}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Roll Number</p>
                <p className="font-medium text-gray-900 font-mono">{profile.roll_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Date of Birth</p>
                <p className="font-medium text-gray-900">{profile.date_of_birth}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Gender</p>
                <p className="font-medium text-gray-900 capitalize">{profile.gender}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Parent / Guardian</p>
                <p className="font-medium text-gray-900">{profile.parent_name}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Contact</p>
                <p className="font-medium text-gray-900">{profile.parent_phone}</p>
              </div>
              {profile.address && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Address</p>
                  <p className="font-medium text-gray-900">{profile.address}</p>
                </div>
              )}
            </div>
          </div>

          {/* Quizzes */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Quizzes</h2>
            {quizzes.length === 0 ? (
              <p className="text-gray-400 text-center py-6">No quizzes yet</p>
            ) : (
              <div className="space-y-2">
                {quizzes.map((qz) => (
                  <div key={qz.id} className="flex items-center justify-between border border-gray-200 rounded-lg p-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-indigo-50 text-indigo-700">{qz.subject.code}</span>
                        <span className="font-medium text-gray-900">{qz.name}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {qz.question_count} question{qz.question_count > 1 ? 's' : ''}
                        {qz.time_limit_min ? ` • ${qz.time_limit_min} min` : ''}
                      </p>
                    </div>
                    {qz.attempt ? (
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-medium text-green-700">{qz.attempt.score}/{qz.attempt.max_score}</span>
                        <Link to={`/student/quiz/${qz.id}`} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Review</Link>
                      </div>
                    ) : (
                      <Link to={`/student/quiz/${qz.id}`}
                        className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition shrink-0">
                        Take quiz
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Homework */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Homework</h2>
            <HomeworkList homework={homework} interactive onChange={loadHomework} />
          </div>

          {/* Books */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Books</h2>
            <BookList books={books} />
          </div>

          {/* Attendance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">My Attendance</h2>
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
              <p className="text-gray-400 text-center py-8">No attendance records for {monthNames[month - 1]} {year}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
