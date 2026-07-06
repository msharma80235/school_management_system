import { useEffect, useState } from 'react';
import api from '../services/api';
import { useSort, SortHeader, TableSearch } from '../components/tableUtils';

interface Exam {
  id: string; name: string; exam_type: string; term: string; max_marks: number;
  approval_status: string; submitted_at: string | null; rejection_note: string | null;
  subject: { name: string }; class: { name: string; section: string };
  _count: { marks: number };
}

const TYPE_LABELS: Record<string, string> = {
  midterm_written: 'MT Written', midterm_oral: 'MT Oral',
  final_written: 'Final Written', final_oral: 'Final Oral',
  class_test: 'Class Test', project: 'Project',
};
const TERM_LABELS: Record<string, string> = { term1: 'Term 1', term2: 'Term 2', annual: 'Annual' };

export default function Approvals() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [filter, setFilter] = useState('pending');
  const [summary, setSummary] = useState({ draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 });
  const [rejectModal, setRejectModal] = useState<Exam | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [viewExam, setViewExam] = useState<Exam | null>(null);
  const [viewMarks, setViewMarks] = useState<{ student_id: string; first_name: string; last_name: string; roll_number: string; marks_obtained: number | null }[]>([]);
  const [viewMaxMarks, setViewMaxMarks] = useState(0);
  const [success, setSuccess] = useState('');

  const fetchExams = async () => {
    const [exRes, sumRes] = await Promise.all([
      api.get(`/exams?approval_status=${filter}`),
      api.get('/exams/approval-summary'),
    ]);
    setExams(exRes.data.exams);
    setSummary(sumRes.data);
  };

  useEffect(() => { fetchExams(); }, [filter]);

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const classOptions = [...new Set(exams.map((e) => `${e.class.name}${e.class.section ? '-' + e.class.section : ''}`))].sort();
  const filteredExams = exams.filter((e) => {
    const q = search.toLowerCase();
    const clsName = `${e.class.name}${e.class.section ? '-' + e.class.section : ''}`;
    const matchesSearch = !q || e.name.toLowerCase().includes(q) || e.subject.name.toLowerCase().includes(q) || clsName.toLowerCase().includes(q);
    const matchesClass = !classFilter || clsName === classFilter;
    return matchesSearch && matchesClass;
  });
  const { sorted: sortedExams, sortKey, sortDir, toggleSort } = useSort(filteredExams, 'name');

  const openViewMarks = async (exam: Exam) => {
    const r = await api.get(`/marks/exam/${exam.id}`);
    setViewExam(exam);
    setViewMarks(r.data.marks);
    setViewMaxMarks(r.data.max_marks);
  };

  const handleApprove = async (id: string) => {
    await api.patch(`/exams/${id}/approve`);
    setSuccess('Marks approved');
    fetchExams();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    await api.patch(`/exams/${rejectModal.id}/reject`, { reason: rejectReason });
    setSuccess('Marks rejected');
    setRejectModal(null);
    setRejectReason('');
    fetchExams();
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleBulkApprove = async () => {
    const classIds = [...new Set(exams.map((e) => e.class.name + e.class.section))];
    for (const exam of exams) {
      await api.patch(`/exams/${exam.id}/approve`);
    }
    setSuccess(`All ${exams.length} pending exams approved`);
    fetchExams();
    setTimeout(() => setSuccess(''), 3000);
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  const tabCounts = [
    { key: 'pending', label: 'Pending Approval', count: summary.pending, color: 'text-amber-600' },
    { key: 'draft', label: 'Draft', count: summary.draft, color: 'text-gray-500' },
    { key: 'approved', label: 'Approved', count: summary.approved, color: 'text-green-600' },
    { key: 'rejected', label: 'Rejected', count: summary.rejected, color: 'text-red-600' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marks Approval</h1>
          <p className="text-gray-500 text-sm mt-1">Review and approve marks submitted by teachers</p>
        </div>
        {filter === 'pending' && exams.length > 0 && (
          <button onClick={handleBulkApprove}
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition">
            Approve All ({exams.length})
          </button>
        )}
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}

      {/* Status tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg">
        {tabCounts.map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition ${
              filter === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
            {tab.count > 0 && <span className={`ml-1.5 ${tab.color} font-bold`}>({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Search + class filter */}
      <div className="flex items-center gap-3 mb-4">
        <TableSearch value={search} onChange={setSearch} placeholder="Search exam, class, subject..." />
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">All classes</option>
          {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || classFilter) && <span className="text-sm text-gray-400">{sortedExams.length} of {exams.length} shown</span>}
      </div>

      {/* Exams table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <SortHeader label="Exam" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Class" k="class.name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Subject" k="subject.name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Type" k="exam_type" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Marks" k="_count.marks" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortHeader label="Status" k="approval_status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedExams.map((exam) => (
              <tr key={exam.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-900 text-sm">{exam.name}</div>
                  <div className="text-xs text-gray-400">{TERM_LABELS[exam.term] || exam.term}</div>
                </td>
                <td className="px-5 py-3 text-sm text-gray-600">{exam.class.name}{exam.class.section ? ` - ${exam.class.section}` : ''}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{exam.subject.name}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{TYPE_LABELS[exam.exam_type] || exam.exam_type}</td>
                <td className="px-5 py-3 text-sm text-gray-600">{exam._count.marks} entries</td>
                <td className="px-5 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor[exam.approval_status]}`}>
                    {exam.approval_status}
                  </span>
                  {exam.rejection_note && (
                    <p className="text-xs text-red-500 mt-1">{exam.rejection_note}</p>
                  )}
                </td>
                <td className="px-5 py-3 text-right space-x-2">
                  <button onClick={() => openViewMarks(exam)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">View</button>
                  {exam.approval_status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(exam.id)} className="text-green-600 hover:text-green-800 text-sm font-medium">Approve</button>
                      <button onClick={() => { setRejectModal(exam); setRejectReason(''); }} className="text-red-600 hover:text-red-800 text-sm font-medium">Reject</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {sortedExams.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">
                No {filter} exams
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Reject Marks</h2>
              <p className="text-sm text-gray-500 mt-1">{rejectModal.name} — {rejectModal.subject.name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for rejection</label>
                <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-red-500"
                  rows={3} placeholder="Please review and correct the marks..." />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRejectModal(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button onClick={handleReject} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Reject</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Marks Modal */}
      {viewExam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{viewExam.name}</h2>
                  <p className="text-sm text-gray-500">{viewExam.class.name}{viewExam.class.section ? ` - ${viewExam.class.section}` : ''} | {viewExam.subject.name} | Max: {viewExam.max_marks}</p>
                </div>
                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor[viewExam.approval_status]}`}>
                  {viewExam.approval_status}
                </span>
              </div>
            </div>
            <div className="p-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 uppercase">Roll #</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 uppercase">Student Name</th>
                    <th className="text-right pb-2 text-xs font-semibold text-gray-500 uppercase">Marks (/{viewMaxMarks})</th>
                    <th className="text-right pb-2 text-xs font-semibold text-gray-500 uppercase">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {viewMarks.map((m) => {
                    const pct = m.marks_obtained !== null ? Math.round((m.marks_obtained / viewMaxMarks) * 100) : null;
                    return (
                      <tr key={m.student_id}>
                        <td className="py-2 text-sm font-mono text-gray-600">{m.roll_number}</td>
                        <td className="py-2 text-sm text-gray-900">{m.first_name} {m.last_name}</td>
                        <td className="py-2 text-sm text-right font-medium text-gray-900">{m.marks_obtained ?? <span className="text-gray-300">-</span>}</td>
                        <td className="py-2 text-sm text-right">
                          {pct !== null && (
                            <span className={`font-medium ${pct >= 60 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                              {pct}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Summary stats */}
              {viewMarks.some((m) => m.marks_obtained !== null) && (
                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-4 gap-4 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-gray-900">{viewMarks.filter((m) => m.marks_obtained !== null).length}</p>
                    <p className="text-xs text-gray-500">Entries</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-gray-900">
                      {Math.round(viewMarks.filter((m) => m.marks_obtained !== null).reduce((s, m) => s + (m.marks_obtained || 0), 0) / viewMarks.filter((m) => m.marks_obtained !== null).length * 10) / 10}
                    </p>
                    <p className="text-xs text-gray-500">Average</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-green-700">
                      {Math.max(...viewMarks.filter((m) => m.marks_obtained !== null).map((m) => m.marks_obtained!))}
                    </p>
                    <p className="text-xs text-green-600">Highest</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-lg font-bold text-red-700">
                      {Math.min(...viewMarks.filter((m) => m.marks_obtained !== null).map((m) => m.marks_obtained!))}
                    </p>
                    <p className="text-xs text-red-600">Lowest</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 mt-4 border-t border-gray-200">
                <button onClick={() => setViewExam(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Close</button>
                {viewExam.approval_status === 'pending' && (
                  <>
                    <button onClick={() => { handleApprove(viewExam.id); setViewExam(null); }}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium">Approve</button>
                    <button onClick={() => { setRejectModal(viewExam); setViewExam(null); setRejectReason(''); }}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Reject</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
