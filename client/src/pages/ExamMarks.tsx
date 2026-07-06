import { useEffect, useState } from 'react';
import api from '../services/api';
import { useSort, SortHeader, TableSearch } from '../components/tableUtils';

interface Subject { id: string; name: string; code: string; }
interface ClassItem { id: string; name: string; section: string; }
interface Exam { id: string; name: string; exam_type: string; term: string; max_marks: number; approval_status: string; rejection_note: string | null; question_paper_path: string | null; exam_format: string | null; subject: Subject; class: ClassItem; _count: { marks: number; questions: number }; }
interface ImportResult {
  file_path: string;
  pages: number;
  text_found: boolean;
  suggested: { name: string; max_marks: number | null; exam_type: string | null; duration: string | null; questions_detected: number };
  excerpt: string;
}
interface GenQuestion {
  order: number;
  question_type: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string | null;
  marks: number;
}
interface PaperQuestion extends GenQuestion { id: string; }
interface MarkRow { student_id: string; first_name: string; last_name: string; roll_number: string; marks_obtained: number | null; remarks: string | null; }

const EXAM_TYPES = [
  { value: 'midterm_written', label: 'Mid-Term Written' },
  { value: 'midterm_oral', label: 'Mid-Term Oral' },
  { value: 'final_written', label: 'Final Written' },
  { value: 'final_oral', label: 'Final Oral' },
  { value: 'class_test', label: 'Class Test' },
  { value: 'project', label: 'Project' },
];

// Explicit Devanagari-capable stack so Hindi questions render crisply everywhere
const QUESTION_FONT = "'Noto Sans Devanagari', 'Devanagari MT', 'Kohinoor Devanagari', 'Mangal', ui-sans-serif, system-ui, sans-serif";

const TERMS = [
  { value: 'term1', label: 'Term 1' },
  { value: 'term2', label: 'Term 2' },
  { value: 'annual', label: 'Annual' },
];

export default function ExamMarks() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [filterTerm, setFilterTerm] = useState('');

  // Create exam
  const [showCreate, setShowCreate] = useState(false);
  const [examForm, setExamForm] = useState({ name: '', exam_type: '', term: 'term1', subject_id: '', max_marks: '100', exam_date: '' });

  // Create exam from file
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [genFormat, setGenFormat] = useState<'quiz' | 'subjective'>('quiz');
  const [genCount, setGenCount] = useState(10);
  const [generating, setGenerating] = useState(false);
  const [genQuestions, setGenQuestions] = useState<GenQuestion[] | null>(null);

  // View question paper
  const [paperExam, setPaperExam] = useState<Exam | null>(null);
  const [paperQuestions, setPaperQuestions] = useState<PaperQuestion[]>([]);
  const [showAnswers, setShowAnswers] = useState(false);

  // Enter marks
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [markRows, setMarkRows] = useState<MarkRow[]>([]);
  const [maxMarks, setMaxMarks] = useState(0);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data.classes)); }, []);

  useEffect(() => {
    if (selectedClass) {
      api.get(`/subjects/class/${selectedClass}`).then((r) => setSubjects(r.data.subjects));
      fetchExams();
    }
  }, [selectedClass, filterTerm]);

  const fetchExams = async () => {
    const params = new URLSearchParams();
    if (selectedClass) params.set('class_id', selectedClass);
    if (filterTerm) params.set('term', filterTerm);
    const r = await api.get(`/exams?${params}`);
    setExams(r.data.exams);
  };

  const [examSearch, setExamSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const filteredExams = exams.filter((e) => {
    const q = examSearch.toLowerCase();
    const matchesSearch = !q || e.name.toLowerCase().includes(q) || e.subject.name.toLowerCase().includes(q);
    const matchesType = !filterType || e.exam_type === filterType;
    const matchesStatus = !filterStatus || e.approval_status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });
  const { sorted: sortedExams, sortKey, sortDir, toggleSort } = useSort(filteredExams, 'name');

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      const name = examForm.name || `${EXAM_TYPES.find((t) => t.value === examForm.exam_type)?.label || examForm.exam_type}`;
      await api.post('/exams', { ...examForm, name, class_id: selectedClass });
      setSuccess('Exam created'); setShowCreate(false);
      setExamForm({ name: '', exam_type: '', term: 'term1', subject_id: '', max_marks: '100', exam_date: '' });
      fetchExams(); setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.error || 'Failed'); }
  };

  const openImport = () => {
    setImportFile(null);
    setImportResult(null);
    setGenQuestions(null);
    setGenFormat('quiz');
    setGenCount(10);
    setError('');
    setExamForm({ name: '', exam_type: '', term: 'term1', subject_id: '', max_marks: '100', exam_date: '' });
    setShowImport(true);
  };

  // Step 1: upload + read the PDF, prefill the form from what was found
  const handleReadFile = async () => {
    if (!importFile) return;
    setError('');
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const r = await api.post('/exams/import-file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const result: ImportResult = r.data;
      setImportResult(result);
      setExamForm({
        name: result.suggested.name || '',
        exam_type: result.suggested.exam_type || '',
        term: 'term1',
        subject_id: '',
        max_marks: result.suggested.max_marks ? String(result.suggested.max_marks) : '100',
        exam_date: '',
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not read the file');
    } finally {
      setImporting(false);
    }
  };

  // Step 2: generate a quiz or subjective paper from the file's content
  const handleGenerate = async () => {
    if (!importResult) return;
    setError('');
    setGenerating(true);
    try {
      const r = await api.post('/exams/generate-questions', {
        file_path: importResult.file_path,
        format: genFormat,
        count: genCount,
      });
      setGenQuestions(r.data.questions);
      setExamForm((f) => ({
        ...f,
        name: f.name || `${importResult.suggested.name} — ${genFormat === 'quiz' ? 'Quiz' : 'Subjective Test'}`,
        exam_type: f.exam_type || (genFormat === 'quiz' ? 'class_test' : 'midterm_written'),
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not generate questions');
    } finally {
      setGenerating(false);
    }
  };

  const removeGenQuestion = (order: number) => {
    setGenQuestions((prev) => prev ? prev.filter((q) => q.order !== order).map((q, i) => ({ ...q, order: i + 1 })) : prev);
  };

  // Step 3: create the exam from the generated questions only —
  // the original file text is not part of the exam
  const handleCreateFromFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!genQuestions || genQuestions.length === 0) return;
    setError('');
    try {
      await api.post('/exams', {
        ...examForm,
        class_id: selectedClass,
        exam_format: genFormat,
        questions: genQuestions,
      });
      setSuccess(`${genFormat === 'quiz' ? 'Quiz' : 'Subjective test'} created with ${genQuestions.length} questions`);
      setShowImport(false);
      fetchExams();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create exam');
    }
  };

  const openPaper = async (exam: Exam) => {
    setPaperExam(exam);
    setShowAnswers(false);
    const r = await api.get(`/exams/${exam.id}/questions`);
    setPaperQuestions(r.data.questions);
  };

  const downloadPaperPdf = async () => {
    if (!paperExam) return;
    try {
      const r = await api.get(`/exams/${paperExam.id}/paper.pdf${showAnswers ? '?answers=1' : ''}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${paperExam.name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download the question paper PDF');
      setTimeout(() => setError(''), 3000);
    }
  };

  const openMarksEntry = async (exam: Exam) => {
    setSelectedExam(exam);
    const r = await api.get(`/marks/exam/${exam.id}`);
    setMarkRows(r.data.marks);
    setMaxMarks(r.data.max_marks);
  };

  const updateMark = (studentId: string, value: string) => {
    const num = value === '' ? null : parseFloat(value);
    setMarkRows((prev) => prev.map((r) => r.student_id === studentId ? { ...r, marks_obtained: num } : r));
  };

  const saveMarks = async () => {
    if (!selectedExam) return;
    try {
      const records = markRows.filter((r) => r.marks_obtained !== null).map((r) => ({
        student_id: r.student_id, marks_obtained: r.marks_obtained, remarks: r.remarks,
      }));
      await api.post('/marks', { exam_id: selectedExam.id, records });
      setSuccess(`Marks saved for ${records.length} students`);
      setSelectedExam(null); fetchExams(); setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.error || 'Failed'); }
  };

  const handleSubmit = async (examId: string) => {
    try {
      await api.patch(`/exams/${examId}/submit`);
      setSuccess('Marks submitted for approval');
      fetchExams();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) { setError(err.response?.data?.error || 'Failed'); setTimeout(() => setError(''), 3000); }
  };

  const typeLabel = (t: string) => EXAM_TYPES.find((e) => e.value === t)?.label || t;
  const termLabel = (t: string) => TERMS.find((e) => e.value === t)?.label || t;

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', pending: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
  };

  const typeColor: Record<string, string> = {
    midterm_written: 'bg-blue-100 text-blue-700', midterm_oral: 'bg-cyan-100 text-cyan-700',
    final_written: 'bg-purple-100 text-purple-700', final_oral: 'bg-pink-100 text-pink-700',
    class_test: 'bg-amber-100 text-amber-700', project: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exams & Marks</h1>
          <p className="text-gray-500 text-sm mt-1">Create exams and enter marks</p>
        </div>
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && !showCreate && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Filters */}
      <div className="flex items-end gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">Select class...</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
          <select value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All Terms</option>
            {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        {selectedClass && (
          <>
            <button onClick={() => setShowCreate(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition">
              + Create Exam
            </button>
            <button onClick={openImport}
              className="border border-indigo-300 text-indigo-700 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              Create from File
            </button>
          </>
        )}
      </div>

      {/* Exams List */}
      {selectedClass && (
        <>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <TableSearch value={examSearch} onChange={setExamSearch} placeholder="Search exam or subject..." />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All types</option>
            {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          {(examSearch || filterType || filterStatus) && (
            <span className="text-sm text-gray-400">{sortedExams.length} of {exams.length} shown</span>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortHeader label="Exam" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Type" k="exam_type" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Subject" k="subject.name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Term" k="term" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Max" k="max_marks" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Entered" k="_count.marks" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Status" k="approval_status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedExams.map((exam) => (
                <tr key={exam.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">
                    {exam.name}
                    {exam.exam_format && (
                      <span className={`ml-1.5 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium align-middle ${exam.exam_format === 'quiz' ? 'bg-cyan-100 text-cyan-700' : 'bg-violet-100 text-violet-700'}`}>
                        {exam.exam_format === 'quiz' ? 'Quiz' : 'Subjective'}
                      </span>
                    )}
                    {exam._count.questions > 0 && (
                      <button onClick={() => openPaper(exam)} title="View question paper"
                        className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-indigo-600 hover:text-indigo-800 font-normal align-middle">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        View Paper ({exam._count.questions})
                      </button>
                    )}
                    {exam.question_paper_path && (
                      <a href={`/uploads/${exam.question_paper_path}`} target="_blank" rel="noreferrer"
                        title="View question paper"
                        className="ml-1.5 inline-flex items-center gap-0.5 text-xs text-red-600 hover:text-red-800 font-normal align-middle">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        Paper
                      </a>
                    )}
                  </td>
                  <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${typeColor[exam.exam_type] || 'bg-gray-100 text-gray-700'}`}>{typeLabel(exam.exam_type)}</span></td>
                  <td className="px-5 py-3 text-sm text-gray-600">{exam.subject.name}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{termLabel(exam.term)}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{exam.max_marks}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{exam._count.marks}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor[exam.approval_status] || 'bg-gray-100'}`}>
                      {exam.approval_status}
                    </span>
                    {exam.rejection_note && <p className="text-xs text-red-500 mt-0.5">{exam.rejection_note}</p>}
                  </td>
                  <td className="px-5 py-3 text-right space-x-2">
                    {(exam.approval_status === 'draft' || exam.approval_status === 'rejected') && (
                      <>
                        <button onClick={() => openMarksEntry(exam)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Edit Marks</button>
                        {exam._count.marks > 0 && (
                          <button onClick={() => handleSubmit(exam.id)} className="text-amber-600 hover:text-amber-800 text-sm font-medium">Submit</button>
                        )}
                      </>
                    )}
                    {exam.approval_status === 'pending' && (
                      <span className="text-xs text-amber-500">Awaiting approval</span>
                    )}
                    {exam.approval_status === 'approved' && (
                      <button onClick={() => openMarksEntry(exam)} className="text-gray-400 hover:text-gray-600 text-sm">View Marks</button>
                    )}
                  </td>
                </tr>
              ))}
              {sortedExams.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">No exams for this class yet</td></tr>}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Create Exam Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">Create Exam</h2></div>
            <form onSubmit={handleCreateExam} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Exam Type</label>
                  <select value={examForm.exam_type} onChange={(e) => setExamForm({ ...examForm, exam_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" required>
                    <option value="">Select...</option>
                    {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                  <select value={examForm.term} onChange={(e) => setExamForm({ ...examForm, term: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                    {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <select value={examForm.subject_id} onChange={(e) => setExamForm({ ...examForm, subject_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" required>
                  <option value="">Select subject...</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Marks</label>
                  <input type="number" value={examForm.max_marks} onChange={(e) => setExamForm({ ...examForm, max_marks: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date (optional)</label>
                  <input type="date" value={examForm.exam_date} onChange={(e) => setExamForm({ ...examForm, exam_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Exam Name (optional)</label>
                <input type="text" value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Auto-generated from type if blank" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Exam from File Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Create Exam from File</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Upload a PDF, then generate a gradable quiz or subjective test from its content — only the questions become the exam
              </p>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              {/* Step 1: pick + read the file */}
              {!importResult ? (
                <>
                  <label className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition">
                    <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    {importFile ? (
                      <span className="text-sm font-medium text-indigo-700">{importFile.name} ({(importFile.size / 1024 / 1024).toFixed(1)} MB)</span>
                    ) : (
                      <span className="text-sm text-gray-500">Click to choose a PDF (book chapter, notes, or paper — max 25MB)</span>
                    )}
                    <input type="file" accept=".pdf" className="hidden"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                  </label>
                  <div className="flex gap-3">
                    <button onClick={() => setShowImport(false)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                    <button onClick={handleReadFile} disabled={!importFile || importing}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50">
                      {importing ? 'Reading file...' : 'Read File'}
                    </button>
                  </div>
                </>
              ) : !genQuestions ? (
                /* Step 2: choose the exam format and generate */
                <>
                  <p className="text-sm text-gray-600">
                    Read <span className="font-medium">{importFile?.name}</span> ({importResult.pages} pages).
                    Choose what kind of exam to build from it:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={() => { setGenFormat('quiz'); setGenCount(10); }}
                      className={`p-4 rounded-xl border-2 text-left transition ${genFormat === 'quiz' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <p className="font-semibold text-gray-900 text-sm">Quiz (Objective)</p>
                      <p className="text-xs text-gray-500 mt-1">Multiple choice, fill-in-the-blank, and true/false — comes with an answer key. 1 mark each.</p>
                    </button>
                    <button type="button" onClick={() => { setGenFormat('subjective'); setGenCount(5); }}
                      className={`p-4 rounded-xl border-2 text-left transition ${genFormat === 'subjective' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <p className="font-semibold text-gray-900 text-sm">Subjective Test</p>
                      <p className="text-xs text-gray-500 mt-1">Short notes and long-answer questions in the student's own words. 5 marks each.</p>
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Number of questions:</label>
                    <select value={genCount} onChange={(e) => setGenCount(Number(e.target.value))}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                      {(genFormat === 'quiz' ? [5, 8, 10, 15, 20] : [3, 5, 8, 10]).map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setImportResult(null); setImportFile(null); }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Different File</button>
                    <button onClick={handleGenerate} disabled={generating}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50">
                      {generating ? 'Generating...' : `Generate ${genFormat === 'quiz' ? 'Quiz' : 'Test'}`}
                    </button>
                  </div>
                </>
              ) : (
                /* Step 3: review questions + exam details */
                <form onSubmit={handleCreateFromFile} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                      {genQuestions.length} question{genQuestions.length !== 1 ? 's' : ''} · {genQuestions.reduce((s, q) => s + q.marks, 0)} marks total
                    </p>
                    <button type="button" onClick={handleGenerate} disabled={generating}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50">
                      {generating ? 'Regenerating...' : '↻ Regenerate'}
                    </button>
                  </div>

                  <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-64 overflow-y-auto" style={{ fontFamily: QUESTION_FONT }}>
                    {genQuestions.map((q) => (
                      <div key={q.order} className="p-3 group">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-gray-900 whitespace-pre-line flex-1">
                            <span className="font-semibold">Q{q.order}.</span> {q.question_text}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-gray-400">{q.marks}m</span>
                            <button type="button" onClick={() => removeGenQuestion(q.order)}
                              className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition" title="Remove question">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        </div>
                        {q.options && (
                          <p className="text-xs text-gray-500 mt-1 ml-6">
                            {q.options.map((o, i) => <span key={i} className="mr-3">({String.fromCharCode(97 + i)}) {o}</span>)}
                          </p>
                        )}
                        {q.correct_answer && <p className="text-[11px] text-green-600 mt-0.5 ml-6">Answer: {q.correct_answer}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Exam Name</label>
                      <input type="text" value={examForm.name} onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" required />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                      <select value={examForm.exam_type} onChange={(e) => setExamForm({ ...examForm, exam_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" required>
                        <option value="">Select...</option>
                        {EXAM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Term</label>
                      <select value={examForm.term} onChange={(e) => setExamForm({ ...examForm, term: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                        {TERMS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                      <select value={examForm.subject_id} onChange={(e) => setExamForm({ ...examForm, subject_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" required>
                        <option value="">Select...</option>
                        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Exam Date <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input type="date" value={examForm.exam_date} onChange={(e) => setExamForm({ ...examForm, exam_date: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setGenQuestions(null)}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Back</button>
                    <button type="submit" disabled={genQuestions.length === 0}
                      className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50">Create Exam</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Question Paper Modal */}
      {paperExam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{paperExam.name}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {paperExam.subject.name} · {paperExam.class.name}{paperExam.class.section ? ` - ${paperExam.class.section}` : ''} · Max marks: {paperExam.max_marks}
                  {paperExam.exam_format && <span className="ml-1.5 capitalize">· {paperExam.exam_format === 'quiz' ? 'Quiz' : 'Subjective'}</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={downloadPaperPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download PDF
                </button>
                <button onClick={() => setPaperExam(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-6" style={{ fontFamily: QUESTION_FONT }}>
              {paperQuestions.some((q) => q.correct_answer !== undefined && q.correct_answer !== null) || paperExam.exam_format === 'quiz' ? (
                <label className="flex items-center gap-2 mb-4 cursor-pointer text-sm text-gray-600">
                  <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  Show answer key
                </label>
              ) : null}
              <div className="space-y-4">
                {paperQuestions.map((q) => (
                  <div key={q.id}>
                    <p className="text-sm text-gray-900 whitespace-pre-line">
                      <span className="font-semibold">Q{q.order}.</span> {q.question_text}
                      <span className="text-xs text-gray-400 ml-2">[{q.marks} mark{q.marks !== 1 ? 's' : ''}]</span>
                    </p>
                    {q.options && (
                      <p className="text-sm text-gray-600 mt-1 ml-6">
                        {q.options.map((o, i) => <span key={i} className="mr-4">({String.fromCharCode(97 + i)}) {o}</span>)}
                      </p>
                    )}
                    {showAnswers && q.correct_answer && (
                      <p className="text-xs text-green-600 mt-0.5 ml-6 font-medium">Answer: {q.correct_answer}</p>
                    )}
                  </div>
                ))}
                {paperQuestions.length === 0 && <p className="text-gray-400 text-sm text-center py-6">Loading questions...</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Marks Entry Modal */}
      {selectedExam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">{selectedExam.name}</h2>
              <p className="text-sm text-gray-500">{selectedExam.subject.name} | Max: {selectedExam.max_marks}</p>
            </div>
            <div className="p-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 uppercase">Roll</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 uppercase">Student</th>
                    <th className="text-left pb-2 text-xs font-semibold text-gray-500 uppercase w-32">Marks (/{maxMarks})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {markRows.map((r) => (
                    <tr key={r.student_id}>
                      <td className="py-2 text-sm font-mono text-gray-600">{r.roll_number}</td>
                      <td className="py-2 text-sm text-gray-900">{r.first_name} {r.last_name}</td>
                      <td className="py-2">
                        {selectedExam.approval_status === 'approved' || selectedExam.approval_status === 'pending' ? (
                          <span className="text-sm text-gray-700 font-medium">{r.marks_obtained ?? '-'}</span>
                        ) : (
                          <input type="number" min="0" max={maxMarks} step="0.5"
                            value={r.marks_obtained ?? ''}
                            onChange={(e) => updateMark(r.student_id, e.target.value)}
                            className={`w-24 px-3 py-1.5 border rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 ${
                              r.marks_obtained !== null && r.marks_obtained > maxMarks ? 'border-red-400 bg-red-50' : 'border-gray-300'
                            }`} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex gap-3 pt-4 mt-4 border-t border-gray-200">
                <button onClick={() => setSelectedExam(null)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
                  {selectedExam.approval_status === 'approved' || selectedExam.approval_status === 'pending' ? 'Close' : 'Cancel'}
                </button>
                {(selectedExam.approval_status === 'draft' || selectedExam.approval_status === 'rejected') && (
                  <button onClick={saveMarks} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save Marks</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
