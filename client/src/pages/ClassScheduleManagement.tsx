import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../services/api';

interface ClassItem { id: string; name: string; section: string; academic_year: string; }
interface Subject { id: string; name: string; code: string; }
interface Teacher { id: string; name: string; subject: string | null; }
interface Slot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string | null;
  title: string | null;
  subject: Subject | null;
  teacher: { id: string; name: string } | null;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Weekdays first — schools rarely schedule Sundays
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const emptyForm = { day_of_week: 1, start_time: '', end_time: '', subject_id: '', title: '', location: '', teacher_id: '' };

export default function ClassScheduleManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classId, setClassId] = useState(searchParams.get('class') || '');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Slot | null>(null);
  const [isCustom, setIsCustom] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get('/schedules/classes').then((r) => {
      setClasses(r.data.classes);
      if (!searchParams.get('class') && r.data.classes.length > 0) setClassId(r.data.classes[0].id);
    });
    api.get('/subjects').then((r) => setSubjects(r.data.subjects));
    api.get('/teacher-schedules/teachers').then((r) => setTeachers(r.data.teachers)).catch(() => {});
  }, []);

  const fetchSlots = async () => {
    if (!classId) { setSlots([]); return; }
    const r = await api.get(`/schedules?class_id=${classId}`);
    setSlots(r.data.slots);
  };

  useEffect(() => {
    fetchSlots();
    if (classId) setSearchParams({ class: classId }, { replace: true });
  }, [classId]);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const openCreate = (day?: number) => {
    setEditing(null);
    setIsCustom(false);
    setForm({ ...emptyForm, day_of_week: day ?? 1 });
    setError('');
    setShowModal(true);
  };

  const openEdit = (s: Slot) => {
    setEditing(s);
    setIsCustom(!s.subject);
    setForm({
      day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time,
      subject_id: s.subject?.id || '', title: s.title || '', location: s.location || '',
      teacher_id: s.teacher?.id || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      class_id: classId,
      day_of_week: Number(form.day_of_week),
      start_time: form.start_time,
      end_time: form.end_time,
      subject_id: isCustom ? '' : form.subject_id,
      title: isCustom ? form.title.trim() : '',
      location: form.location,
      teacher_id: form.teacher_id,
    };
    try {
      if (editing) {
        await api.put(`/schedules/${editing.id}`, payload);
        flash('Period updated');
      } else {
        await api.post('/schedules', payload);
        flash('Period added');
      }
      setShowModal(false);
      fetchSlots();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    }
  };

  const handleDelete = async (s: Slot) => {
    if (!confirm(`Remove ${s.subject?.name || s.title} (${s.start_time}–${s.end_time})?`)) return;
    await api.delete(`/schedules/${s.id}`);
    flash('Period removed');
    fetchSlots();
  };

  const selectedClass = classes.find((c) => c.id === classId);
  const byDay = DAY_ORDER.map((d) => ({ day: d, slots: slots.filter((s) => s.day_of_week === d) }));
  const activeDays = byDay.filter((g) => g.slots.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Class Schedules</h1>
          <p className="text-gray-500 text-sm mt-1">Weekly timetable per class — shown to everyone on the school calendar</p>
        </div>
        <button onClick={() => openCreate()} disabled={!classId}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Period
        </button>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-gray-700">Class:</label>
        <select value={classId} onChange={(e) => setClassId(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          {classes.length === 0 && <option value="">No classes yet</option>}
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''} ({c.academic_year})</option>
          ))}
        </select>
        {selectedClass && (
          <span className="text-sm text-gray-400">{slots.length} period{slots.length !== 1 ? 's' : ''} scheduled</span>
        )}
      </div>

      {slots.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-gray-400">No schedule for this class yet. Click "Add Period" to build the weekly timetable.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activeDays.map(({ day, slots: daySlots }) => (
            <div key={day} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                <h2 className="font-semibold text-indigo-900 text-sm">{DAY_NAMES[day]}</h2>
                <button onClick={() => openCreate(day)} className="text-indigo-500 hover:text-indigo-700" title={`Add period on ${DAY_NAMES[day]}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {daySlots.map((s) => (
                  <div key={s.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-gray-500 shrink-0 w-24">{s.start_time}–{s.end_time}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {s.subject?.name || s.title}
                          {!s.subject && <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">Custom</span>}
                        </p>
                        {(s.teacher || s.location) && (
                          <p className="text-xs text-gray-400 truncate">
                            {s.teacher?.name}{s.teacher && s.location ? ' · ' : ''}{s.location}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => openEdit(s)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Edit</button>
                      <button onClick={() => handleDelete(s)} className="text-red-600 hover:text-red-800 text-xs font-medium">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit period modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Period' : 'Add Period'}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{selectedClass ? `${selectedClass.name}${selectedClass.section ? ` - ${selectedClass.section}` : ''}` : ''}</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">{isCustom ? 'Custom Title' : 'Subject'}</label>
                  <button type="button" onClick={() => setIsCustom(!isCustom)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                    {isCustom ? 'Pick a subject instead' : 'Custom (Assembly, Lunch...)'}
                  </button>
                </div>
                {isCustom ? (
                  <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g. Morning Assembly, Lunch Break" />
                ) : (
                  <select value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select subject...</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher <span className="text-gray-400 font-normal">(optional — checked against their other periods and duties)</span></label>
                <select value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">No teacher assigned</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.subject ? ` (${t.subject})` : ''}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room / Location <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Room 12, Science Lab" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">
                  {editing ? 'Update' : 'Add Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
