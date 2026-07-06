import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import HomeworkList from '../components/HomeworkList';
import BookList from '../components/BookList';

interface Child {
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

export default function ParentDashboard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState<Child | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/parents/my-children')
      .then((res) => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) setSelectedChild(res.data.children[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const [homework, setHomework] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);

  useEffect(() => {
    if (selectedChild) {
      api.get(`/parents/my-children/${selectedChild.id}/attendance?month=${month}&year=${year}`)
        .then((res) => {
          setAttendance(res.data.attendance);
          setSummary(res.data.summary);
        });
    }
  }, [selectedChild, month, year]);

  useEffect(() => {
    if (selectedChild) {
      api.get(`/homework/child/${selectedChild.id}`)
        .then((res) => setHomework(res.data.homework))
        .catch(() => setHomework([]));
      api.get(`/books/child/${selectedChild.id}`)
        .then((res) => setBooks(res.data.books))
        .catch(() => setBooks([]));
    }
  }, [selectedChild]);

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
        <p className="text-gray-500 mt-1">View your children's details and attendance</p>
      </div>

      {children.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No children linked to your account yet. Please contact the school administrator.</p>
        </div>
      ) : (
        <>
          {/* Child selector tabs */}
          {children.length > 1 && (
            <div className="flex gap-2 mb-6">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => setSelectedChild(child)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                    selectedChild?.id === child.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {child.first_name} {child.last_name}
                </button>
              ))}
            </div>
          )}

          {selectedChild && (
            <div className="space-y-6">
              {/* Student Details Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Student Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Full Name</p>
                    <p className="font-medium text-gray-900">{selectedChild.first_name} {selectedChild.last_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Roll Number</p>
                    <p className="font-medium text-gray-900 font-mono">{selectedChild.roll_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Class</p>
                    <p className="font-medium text-gray-900">{selectedChild.class.name} - {selectedChild.class.section}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Academic Year</p>
                    <p className="font-medium text-gray-900">{selectedChild.class.academic_year}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Date of Birth</p>
                    <p className="font-medium text-gray-900">{selectedChild.date_of_birth}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Gender</p>
                    <p className="font-medium text-gray-900 capitalize">{selectedChild.gender}</p>
                  </div>
                </div>
              </div>

              {/* Homework */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Homework</h2>
                <HomeworkList homework={homework} />
              </div>

              {/* Books */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Books</h2>
                <BookList books={books} />
              </div>

              {/* Attendance Summary */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Attendance</h2>
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
        </>
      )}
    </div>
  );
}
