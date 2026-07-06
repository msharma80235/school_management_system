import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Holiday {
  id: string;
  title: string;
  date: string;
  end_date: string | null;
  description: string | null;
}

interface ClassItem { id: string; name: string; section: string; }
interface TeacherItem { id: string; name: string; subject: string | null; }
interface Slot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string | null;
  title: string | null;
  subject: { id: string; name: string } | null;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1); // 1-based
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  // "class:<id>" or "teacher:<id>" — one selector drives both schedule types
  const [scheduleSel, setScheduleSel] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', end_date: '', description: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchHolidays = async () => {
    const r = await api.get(`/holidays?year=${year}`);
    setHolidays(r.data.holidays);
  };

  useEffect(() => { fetchHolidays(); }, [year]);

  // Schedules this user may see: their classes, plus teacher schedules
  // (teachers default to their own; admin/staff can pick anyone)
  useEffect(() => {
    Promise.all([
      api.get('/schedules/classes').then((r) => r.data.classes).catch(() => []),
      api.get('/teacher-schedules/teachers').then((r) => r.data.teachers).catch(() => []),
    ]).then(([cls, tchr]) => {
      setClasses(cls);
      setTeachers(tchr);
      if (user?.role === 'teacher' && tchr.length > 0) setScheduleSel(`teacher:${tchr[0].id}`);
      else if (cls.length > 0) setScheduleSel(`class:${cls[0].id}`);
    });
  }, []);

  useEffect(() => {
    if (!scheduleSel) { setSlots([]); return; }
    const [kind, id] = scheduleSel.split(':');
    const url = kind === 'teacher' ? `/teacher-schedules?teacher_id=${id}` : `/schedules?class_id=${id}`;
    api.get(url).then((r) => setSlots(r.data.slots)).catch(() => setSlots([]));
  }, [scheduleSel]);

  const slotsForWeekday = (weekday: number) => slots.filter((s) => s.day_of_week === weekday);

  const isHoliday = (dateStr: string): Holiday | undefined =>
    holidays.find((h) => h.end_date ? (dateStr >= h.date && dateStr <= h.end_date) : h.date === dateStr);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title || !form.date) { setError('Title and date are required'); return; }
    try {
      await api.post('/holidays', { ...form, end_date: form.end_date || null, description: form.description || null });
      setSuccess('Holiday added');
      setShowAdd(false);
      setForm({ title: '', date: '', end_date: '', description: '' });
      fetchHolidays();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (h: Holiday) => {
    if (!confirm(`Delete "${h.title}"?`)) return;
    await api.delete(`/holidays/${h.id}`);
    setSuccess('Holiday deleted');
    fetchHolidays();
    setTimeout(() => setSuccess(''), 3000);
  };

  // Build the month grid
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = fmt(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const monthHolidays = holidays.filter((h) => {
    const mm = `${year}-${String(month).padStart(2, '0')}`;
    return h.date.startsWith(mm) || (h.end_date && h.date <= `${mm}-31` && h.end_date >= `${mm}-01`);
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Calendar</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? 'Manage school holidays — visible to everyone' : 'School holidays, breaks, and class schedules'}
          </p>
        </div>
        <div className="flex items-center gap-3">
        {(classes.length > 0 || teachers.length > 0) && (
          <select value={scheduleSel} onChange={(e) => setScheduleSel(e.target.value)}
            title="Show a class or teacher schedule on the calendar"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">No schedule overlay</option>
            {classes.length > 0 && (
              <optgroup label="Class schedules">
                {classes.map((c) => (
                  <option key={c.id} value={`class:${c.id}`}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>
                ))}
              </optgroup>
            )}
            {teachers.length > 0 && (
              <optgroup label="Teacher schedules">
                {teachers.map((t) => (
                  <option key={t.id} value={`teacher:${t.id}`}>{t.name}{t.subject ? ` (${t.subject})` : ''}</option>
                ))}
              </optgroup>
            )}
          </select>
        )}
        {isAdmin && (
          <button onClick={() => { setError(''); setShowAdd(true); }}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Holiday
          </button>
        )}
        </div>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Month grid */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="text-lg font-semibold text-gray-900">{MONTHS[month - 1]} {year}</h2>
            <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 uppercase py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={i} className="h-20" />;
              const dateStr = fmt(year, month, day);
              const holiday = isHoliday(dateStr);
              const isToday = dateStr === todayStr;
              const isSunday = i % 7 === 0;
              const daySlots = holiday ? [] : slotsForWeekday(i % 7);
              const isSelected = dateStr === selectedDate;
              return (
                <button key={i} type="button" title={holiday?.title}
                  onClick={() => setSelectedDate(isSelected ? '' : dateStr)}
                  className={`h-20 rounded-lg p-1.5 text-sm border transition text-left align-top ${
                    holiday ? 'bg-red-50 border-red-200' : isSelected ? 'bg-indigo-100 border-indigo-400' : isToday ? 'bg-indigo-50 border-indigo-300' : 'border-transparent hover:bg-gray-50'
                  }`}>
                  <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday ? 'bg-indigo-600 text-white' : holiday ? 'text-red-700' : isSunday ? 'text-red-400' : 'text-gray-700'
                  }`}>
                    {day}
                  </span>
                  {holiday && <p className="text-[10px] text-red-600 font-medium leading-tight mt-0.5 truncate">{holiday.title}</p>}
                  {daySlots.length > 0 && (
                    <div className="mt-0.5 space-y-px">
                      {daySlots.slice(0, 2).map((s) => (
                        <p key={s.id} className="text-[9px] text-indigo-700 bg-indigo-50 rounded px-1 leading-tight truncate">
                          {s.start_time} {s.subject?.name || s.title}
                        </p>
                      ))}
                      {daySlots.length > 2 && <p className="text-[9px] text-gray-400 px-1">+{daySlots.length - 2} more</p>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
        {/* Schedule for the selected day */}
        {scheduleSel && (() => {
          const dateStr = selectedDate || todayStr;
          const d = new Date(`${dateStr}T00:00:00`);
          const holiday = isHoliday(dateStr);
          const daySlots = slotsForWeekday(d.getDay());
          const [kind, id] = scheduleSel.split(':');
          const label = kind === 'teacher'
            ? teachers.find((t) => t.id === id)?.name
            : (() => { const c = classes.find((c) => c.id === id); return c ? `${c.name}${c.section ? ` - ${c.section}` : ''}` : undefined; })();
          return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-0.5">
                {label ? `${label} schedule` : 'Schedule'}
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                {d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                {!selectedDate && ' (today — click a date to change)'}
              </p>
              {holiday ? (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
                  {holiday.title} — no classes on this day
                </div>
              ) : daySlots.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No periods scheduled for this day</p>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {daySlots.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-2 bg-indigo-50/60 border border-indigo-100 rounded-lg">
                      <span className="text-xs font-mono text-indigo-700 shrink-0 w-24">{s.start_time}–{s.end_time}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{s.subject?.name || s.title}</p>
                        {s.location && <p className="text-[11px] text-gray-400 truncate">{s.location}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Holiday list for the year */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Holidays in {year}</h3>
          <p className="text-xs text-gray-400 mb-4">{holidays.length} total • {monthHolidays.length} this month</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {holidays.map((h) => (
              <div key={h.id} className={`p-3 rounded-lg border ${h.date.startsWith(`${year}-${String(month).padStart(2, '0')}`) ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{h.title}</p>
                    <p className="text-xs text-gray-500">
                      {h.date}{h.end_date ? ` → ${h.end_date}` : ''}
                    </p>
                    {h.description && <p className="text-xs text-gray-400 mt-0.5">{h.description}</p>}
                  </div>
                  {isAdmin && (
                    <button onClick={() => handleDelete(h)} className="text-gray-300 hover:text-red-600 ml-2" title="Delete">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {holidays.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No holidays added for {year}</p>}
          </div>
        </div>
        </div>
      </div>

      {/* Add holiday modal (admin only) */}
      {showAdd && isAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Add Holiday</h2>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="e.g. Independence Day" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-gray-900"
                  placeholder="e.g. National holiday — school closed" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAdd(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
