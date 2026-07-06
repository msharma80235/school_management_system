import { useEffect, useState } from 'react';
import api from '../services/api';
import { useSort, SortHeader, TableSearch } from '../components/tableUtils';
import { useAuth } from '../context/AuthContext';

interface ClassItem {
  id: string;
  name: string;
  section: string;
}

interface AttendanceRow {
  student_id: string;
  first_name: string;
  last_name: string;
  roll_number: string;
  status: string;
  remarks: string | null;
}

interface VolunteerRow {
  volunteer_id: string;
  name: string;
  email: string;
  status: string;
  remarks: string | null;
}

export default function AttendancePage() {
  const { user } = useAuth();
  const canMarkVolunteers = user?.role === 'admin' || user?.role === 'teacher';
  const [mode, setMode] = useState<'students' | 'volunteers'>('students');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [volunteerRows, setVolunteerRows] = useState<VolunteerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [nameSearch, setNameSearch] = useState('');

  const filteredRows = rows.filter((r) => {
    const q = nameSearch.toLowerCase();
    return !q || `${r.first_name} ${r.last_name}`.toLowerCase().includes(q) || r.roll_number.toLowerCase().includes(q);
  });
  const studentSort = useSort(filteredRows, 'roll_number');

  const filteredVolRows = volunteerRows.filter((r) => {
    const q = nameSearch.toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
  });
  const volunteerSort = useSort(filteredVolRows, 'name');

  useEffect(() => {
    api.get('/classes').then((res) => setClasses(res.data.classes));
  }, []);

  useEffect(() => {
    if (mode === 'students' && selectedClass && date) {
      setLoading(true);
      api.get(`/attendance?class_id=${selectedClass}&date=${date}`)
        .then((res) => setRows(res.data.attendance))
        .finally(() => setLoading(false));
    }
  }, [mode, selectedClass, date]);

  useEffect(() => {
    if (mode === 'volunteers' && date && canMarkVolunteers) {
      setLoading(true);
      api.get(`/volunteer-attendance?date=${date}`)
        .then((res) => setVolunteerRows(res.data.attendance))
        .finally(() => setLoading(false));
    }
  }, [mode, date, canMarkVolunteers]);

  const updateStatus = (studentId: string, status: string) => {
    setRows((prev) => prev.map((r) => r.student_id === studentId ? { ...r, status } : r));
  };

  const updateVolunteerStatus = (volunteerId: string, status: string) => {
    setVolunteerRows((prev) => prev.map((r) => r.volunteer_id === volunteerId ? { ...r, status } : r));
  };

  const markAll = (status: string) => {
    if (mode === 'students') setRows((prev) => prev.map((r) => ({ ...r, status })));
    else setVolunteerRows((prev) => prev.map((r) => ({ ...r, status })));
  };

  const handleSave = async () => {
    try {
      const records = rows
        .filter((r) => r.status !== 'unmarked')
        .map((r) => ({ student_id: r.student_id, status: r.status, remarks: r.remarks }));

      if (records.length === 0) {
        setError('Mark at least one student');
        setTimeout(() => setError(''), 3000);
        return;
      }

      await api.post('/attendance', { class_id: selectedClass, date, records });
      setSuccess(`Attendance saved for ${records.length} students`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Save failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleSaveVolunteers = async () => {
    try {
      const records = volunteerRows
        .filter((r) => r.status !== 'unmarked')
        .map((r) => ({ volunteer_id: r.volunteer_id, status: r.status, remarks: r.remarks }));

      if (records.length === 0) {
        setError('Mark at least one volunteer');
        setTimeout(() => setError(''), 3000);
        return;
      }

      await api.post('/volunteer-attendance', { date, records });
      setSuccess(`Attendance saved for ${records.length} volunteers`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Save failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  const statusButtons = (current: string, onSelect: (status: string) => void) => (
    <div className="flex items-center justify-center gap-2">
      {[
        { key: 'present', label: 'Present', active: 'bg-green-600 text-white', idle: 'bg-gray-100 text-gray-600 hover:bg-green-50' },
        { key: 'absent', label: 'Absent', active: 'bg-red-600 text-white', idle: 'bg-gray-100 text-gray-600 hover:bg-red-50' },
        { key: 'late', label: 'Late', active: 'bg-yellow-500 text-white', idle: 'bg-gray-100 text-gray-600 hover:bg-yellow-50' },
      ].map((s) => (
        <button key={s.key} onClick={() => onSelect(s.key)}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition ${current === s.key ? s.active : s.idle}`}>
          {s.label}
        </button>
      ))}
    </div>
  );

  const quickActionsAndSave = (onSave: () => void) => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Quick actions:</span>
        <button onClick={() => markAll('present')} className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200">All Present</button>
        <button onClick={() => markAll('absent')} className="px-3 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200">All Absent</button>
      </div>
      <button onClick={onSave} className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition">
        Save Attendance
      </button>
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
        <p className="text-gray-500 text-sm mt-1">
          {mode === 'students' ? 'Mark daily attendance for a class' : 'Mark daily attendance for volunteers'}
        </p>
      </div>

      {/* Students / Volunteers toggle — admin & teachers only */}
      {canMarkVolunteers && (
        <div className="inline-flex rounded-lg bg-gray-100 p-1 mb-6">
          <button onClick={() => setMode('students')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${mode === 'students' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Students
          </button>
          <button onClick={() => setMode('volunteers')}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${mode === 'volunteers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Volunteers
          </button>
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        {mode === 'students' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
            <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900">
              <option value="">Select class...</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
          <TableSearch value={nameSearch} onChange={setNameSearch} placeholder={mode === 'students' ? 'Name or roll...' : 'Name or email...'} />
        </div>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Student attendance table */}
      {mode === 'students' && selectedClass && rows.length > 0 && (
        <>
          {quickActionsAndSave(handleSave)}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortHeader label="Roll #" k="roll_number" sortKey={studentSort.sortKey} sortDir={studentSort.sortDir} onSort={studentSort.toggleSort} />
                  <SortHeader label="Student Name" k="first_name" sortKey={studentSort.sortKey} sortDir={studentSort.sortDir} onSort={studentSort.toggleSort} />
                  <SortHeader label="Status" k="status" align="center" sortKey={studentSort.sortKey} sortDir={studentSort.sortDir} onSort={studentSort.toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {studentSort.sorted.map((row) => (
                  <tr key={row.student_id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-sm font-mono text-gray-700">{row.roll_number}</td>
                    <td className="px-5 py-3 font-medium text-gray-900">{row.first_name} {row.last_name}</td>
                    <td className="px-5 py-3">{statusButtons(row.status, (s) => updateStatus(row.student_id, s))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {mode === 'students' && selectedClass && !loading && rows.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No students in this class.</p>
        </div>
      )}

      {/* Volunteer attendance table */}
      {mode === 'volunteers' && volunteerRows.length > 0 && (
        <>
          {quickActionsAndSave(handleSaveVolunteers)}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <SortHeader label="Volunteer" k="name" sortKey={volunteerSort.sortKey} sortDir={volunteerSort.sortDir} onSort={volunteerSort.toggleSort} />
                  <SortHeader label="Email" k="email" sortKey={volunteerSort.sortKey} sortDir={volunteerSort.sortDir} onSort={volunteerSort.toggleSort} />
                  <SortHeader label="Status" k="status" align="center" sortKey={volunteerSort.sortKey} sortDir={volunteerSort.sortDir} onSort={volunteerSort.toggleSort} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {volunteerSort.sorted.map((row) => (
                  <tr key={row.volunteer_id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-sm font-bold">
                          {row.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-600">{row.email}</td>
                    <td className="px-5 py-3">{statusButtons(row.status, (s) => updateVolunteerStatus(row.volunteer_id, s))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {mode === 'volunteers' && !loading && volunteerRows.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-400">No active volunteers in your organization.</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      )}
    </div>
  );
}
