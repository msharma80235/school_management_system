import { useEffect, useState } from 'react';
import api from '../services/api';

interface Overview {
  students: number; teachers: number; classes: number; subjects: number;
  attendanceRate: number | null;
  exams: Record<string, number>;
  admissions: Record<string, number>;
  safetyUnresolved: number;
}
interface TrendPoint { month: string; present: number; absent: number; late: number; total: number; rate: number; }
interface Bucket { label: string; count: number; }
interface SubjectAvg { subject: string; average: number; }
interface AtRisk { id: string; name: string; roll_number: string; class: string; attendance: number | null; average: number | null; reasons: string[]; }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (ym: string) => { const [y, m] = ym.split('-'); return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`; };

export default function Analytics() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [subjects, setSubjects] = useState<SubjectAvg[]>([]);
  const [gradeTotal, setGradeTotal] = useState(0);
  const [risk, setRisk] = useState<AtRisk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview').then((r) => setOv(r.data)),
      api.get('/analytics/attendance-trend?months=6').then((r) => setTrend(r.data.trend)),
      api.get('/analytics/grade-distribution').then((r) => { setBuckets(r.data.buckets); setSubjects(r.data.subjects); setGradeTotal(r.data.total); }),
      api.get('/analytics/at-risk').then((r) => setRisk(r.data.at_risk)),
    ]).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const downloadCsv = async () => {
    const res = await api.get('/analytics/export/students.csv', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = 'students-report.csv';
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>;
  }

  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-1">Attendance, grades, and at-risk students across your school</p>
        </div>
        <button onClick={downloadCsv}
          className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export students CSV
        </button>
      </div>

      {/* Stat cards */}
      {ov && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Stat label="Students" value={ov.students} />
          <Stat label="Teachers" value={ov.teachers} />
          <Stat label="Classes" value={ov.classes} />
          <Stat label="Attendance" value={ov.attendanceRate === null ? '—' : `${ov.attendanceRate}%`} accent={ov.attendanceRate !== null && ov.attendanceRate < 75 ? 'red' : 'green'} />
          <Stat label="Marks pending" value={ov.exams?.pending ?? 0} accent={(ov.exams?.pending ?? 0) > 0 ? 'amber' : undefined} />
          <Stat label="Safety to review" value={ov.safetyUnresolved} accent={ov.safetyUnresolved > 0 ? 'red' : undefined} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Attendance trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Attendance trend</h2>
          {trend.length === 0 ? <p className="text-gray-400 text-center py-10">No attendance data yet</p> : (
            <div className="flex items-end gap-3 h-48">
              {trend.map((t) => (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center" style={{ height: '150px' }}>
                    <div className={`w-full max-w-[36px] rounded-t ${t.rate < 75 ? 'bg-red-400' : 'bg-green-400'}`}
                      style={{ height: `${t.rate}%` }} title={`${t.rate}%`} />
                  </div>
                  <span className="text-[11px] text-gray-500">{monthLabel(t.month)}</span>
                  <span className="text-[11px] font-medium text-gray-700">{t.rate}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Grade distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Grade distribution <span className="text-sm font-normal text-gray-400">({gradeTotal} marks)</span></h2>
          {gradeTotal === 0 ? <p className="text-gray-400 text-center py-10">No approved marks yet</p> : (
            <div className="flex items-end gap-3 h-48">
              {buckets.map((b) => (
                <div key={b.label} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex items-end justify-center" style={{ height: '150px' }}>
                    <div className="w-full max-w-[44px] rounded-t bg-indigo-400" style={{ height: `${(b.count / maxBucket) * 100}%` }} title={`${b.count}`} />
                  </div>
                  <span className="text-[11px] text-gray-500">{b.label}</span>
                  <span className="text-[11px] font-medium text-gray-700">{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Subject averages */}
      {subjects.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Average by subject</h2>
          <div className="space-y-2">
            {subjects.map((s) => (
              <div key={s.subject} className="flex items-center gap-3">
                <span className="w-32 text-sm text-gray-700 truncate">{s.subject}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                  <div className={`h-3 rounded-full ${s.average < 40 ? 'bg-red-400' : s.average < 60 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${s.average}%` }} />
                </div>
                <span className="w-10 text-right text-sm font-medium text-gray-700">{s.average}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At-risk students */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">At-risk students</h2>
        <p className="text-sm text-gray-500 mb-4">Flagged for attendance below 75% or an average below 40%.</p>
        {risk.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No students currently flagged. 🎉</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-4 font-medium">Student</th>
                  <th className="py-2 pr-4 font-medium">Class</th>
                  <th className="py-2 pr-4 font-medium">Attendance</th>
                  <th className="py-2 pr-4 font-medium">Average</th>
                  <th className="py-2 font-medium">Flags</th>
                </tr>
              </thead>
              <tbody>
                {risk.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="py-2 pr-4">
                      <span className="font-medium text-gray-900">{r.name}</span>
                      <span className="text-gray-400 ml-1 font-mono text-xs">{r.roll_number}</span>
                    </td>
                    <td className="py-2 pr-4 text-gray-600">{r.class}</td>
                    <td className={`py-2 pr-4 ${r.attendance !== null && r.attendance < 75 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{r.attendance === null ? '—' : `${r.attendance}%`}</td>
                    <td className={`py-2 pr-4 ${r.average !== null && r.average < 40 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>{r.average === null ? '—' : `${r.average}%`}</td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.reasons.map((x) => <span key={x} className="inline-flex px-2 py-0.5 rounded-full text-[11px] bg-red-50 text-red-700">{x}</span>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: 'green' | 'red' | 'amber' }) {
  const color = accent === 'red' ? 'text-red-600' : accent === 'amber' ? 'text-amber-600' : accent === 'green' ? 'text-green-600' : 'text-gray-900';
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}
