import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Teacher { id: string; name: string; subject: string | null; }
interface TSlot {
  id: string;
  source: 'class' | 'personal';
  day_of_week: number;
  start_time: string;
  end_time: string;
  title: string;
  location: string | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const emptyForm = { day_of_week: 1, start_time: '', end_time: '', title: '', location: '' };

export default function TeacherScheduleManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherId, setTeacherId] = useState(searchParams.get('teacher') || '');
  const [slots, setSlots] = useState<TSlot[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TSlot | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/teacher-schedules/teachers').then((r) => {
      setTeachers(r.data.teachers);
      if (!searchParams.get('teacher') && r.data.teachers.length > 0) setTeacherId(r.data.teachers[0].id);
    });
  }, []);

  const fetchSlots = async () => {
    if (!teacherId) { setSlots([]); return; }
    const r = await api.get(`/teacher-schedules?teacher_id=${teacherId}`);
    setSlots(r.data.slots);
  };

  useEffect(() => {
    fetchSlots();
    if (teacherId) setSearchParams({ teacher: teacherId }, { replace: true });
  }, [teacherId]);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = (day?: number) => {
    setEditing(null);
    setForm({ ...emptyForm, day_of_week: day ?? 1 });
    setError('');
    setShowModal(true);
  };

  const openEdit = (s: TSlot) => {
    if (s.source !== 'personal') return;
    setEditing(s);
    setForm({ day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time, title: s.title, location: s.location || '' });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = { teacher_id: teacherId, ...form, day_of_week: Number(form.day_of_week) };
    try {
      if (editing) {
        await api.put(`/teacher-schedules/${editing.id}`, payload);
        flash('Updated');
      } else {
        await api.post('/teacher-schedules', payload);
        flash('Added to schedule');
      }
      setShowModal(false);
      fetchSlots();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (s: TSlot) => {
    if (!confirm(`Remove "${s.title}" (${s.start_time}–${s.end_time})?`)) return;
    await api.delete(`/teacher-schedules/${s.id}`);
    flash('Removed');
    fetchSlots();
  };

  const selectedTeacher = teachers.find((t) => t.id === teacherId);
  const byDay = DAY_ORDER.map((d) => ({ day: d, slots: slots.filter((s) => s.day_of_week === d) }));
  const activeDays = byDay.filter((g) => g.slots.length > 0);
  const classCount = slots.filter((s) => s.source === 'class').length;
  const personalCount = slots.length - classCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isAdmin ? 'Teacher Schedules' : 'My Schedule'}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin
              ? 'Teaching periods come from class schedules; add duties and meetings here — clashes are blocked'
              : 'Your teaching periods, duties, and meetings for the week'}
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => openCreate()} disabled={!teacherId}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Duty / Meeting
          </button>
        )}
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {isAdmin && (
          <>
            <label className="text-sm font-medium text-gray-700">Teacher:</label>
            <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
              {teachers.length === 0 && <option value="">No teachers</option>}
              {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.subject ? ` (${t.subject})` : ''}</option>)}
            </select>
          </>
        )}
        {selectedTeacher && (
          <span className="text-sm text-gray-400">
            {classCount} teaching period{classCount !== 1 ? 's' : ''} · {personalCount} dut{personalCount !== 1 ? 'ies' : 'y'}/meeting{personalCount !== 1 ? 's' : ''}
          </span>
        )}
        {isAdmin && (
          <Link to="/admin/schedules" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium ml-auto">
            Assign teaching periods on Class Schedules →
          </Link>
        )}
      </div>

      {slots.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-400">
            Nothing scheduled yet. Teaching periods appear automatically once a teacher is assigned on a class schedule.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeDays.map(({ day, slots: daySlots }) => (
            <div key={day} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-teal-50 border-b border-teal-100 flex items-center justify-between">
                <h2 className="font-semibold text-teal-900 text-sm">{DAY_NAMES[day]}</h2>
                {isAdmin && (
                  <button onClick={() => openCreate(day)} className="text-teal-500 hover:text-teal-700" title={`Add on ${DAY_NAMES[day]}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  </button>
                )}
              </div>
              <div className="divide-y divide-gray-100">
                {daySlots.map((s) => (
                  <div key={`${s.source}-${s.id}`} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-gray-500 shrink-0 w-24">{s.start_time}–{s.end_time}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {s.title}
                          {s.source === 'class' ? (
                            <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">Class</span>
                          ) : (
                            <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-100 text-teal-700">Duty</span>
                          )}
                        </p>
                        {s.location && <p className="text-xs text-gray-400 truncate">{s.location}</p>}
                      </div>
                    </div>
                    {isAdmin && s.source === 'personal' && (
                      <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => openEdit(s)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Edit</button>
                        <button onClick={() => handleDelete(s)} className="text-red-600 hover:text-red-800 text-xs font-medium">Remove</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit duty modal */}
      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Duty / Meeting' : 'Add Duty / Meeting'}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{selectedTeacher?.name} — clashes with teaching periods are rejected</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Bus Duty, Staff Meeting, Office Hours" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                  {DAY_ORDER.map((d) => <option key={d} value={d}>{DAY_NAMES[d]}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                  <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                  <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Staff Room, Main Gate" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                  {editing ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
