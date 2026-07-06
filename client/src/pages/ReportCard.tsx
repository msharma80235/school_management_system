import { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSort, SortHeader, TableSearch } from '../components/tableUtils';

interface ClassItem { id: string; name: string; section: string; }
interface StudentSummary { student_id: string; name: string; roll_number: string; percentage: number; rank?: number; }

export default function ReportCard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [classSummary, setClassSummary] = useState<StudentSummary[]>([]);
  const [reportData, setReportData] = useState<any>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [success, setSuccess] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data.classes)); }, []);

  useEffect(() => {
    if (selectedClass) {
      api.get(`/report-cards/class/${selectedClass}/summary`).then((r) => setClassSummary(r.data.results));
    }
  }, [selectedClass]);

  const [error, setError] = useState('');
  const [summarySearch, setSummarySearch] = useState('');
  const filteredSummary = classSummary.filter((s: any) =>
    !summarySearch || s.name.toLowerCase().includes(summarySearch.toLowerCase()) || s.roll_number.toLowerCase().includes(summarySearch.toLowerCase()));
  const { sorted: sortedSummary, sortKey, sortDir, toggleSort } = useSort(filteredSummary, 'rank');

  const viewReport = async (studentId: string) => {
    setError('');
    try {
      const r = await api.get(`/report-cards/student/${studentId}`);
      setReportData(r.data);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to load report card';
      const details = err.response?.data?.details;
      setError(details
        ? `${msg} (${details.approved}/${details.total} exams approved, ${details.pending} pending)`
        : msg);
    }
  };

  const loadConfig = async () => {
    const r = await api.get('/report-cards/config');
    setConfig(r.data.config);
    setShowConfig(true);
  };

  const saveConfig = async () => {
    try {
      await api.put('/report-cards/config', config);
      setSuccess('Config saved'); setShowConfig(false);
      setTimeout(() => setSuccess(''), 3000);
      if (reportData) viewReport(reportData.student.id);
    } catch { }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('logo', file);
    try {
      await api.post('/report-cards/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess('Logo uploaded');
      loadConfig();
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setSuccess('');
    }
  };

  const downloadPDF = async (studentId: string, studentName: string) => {
    setError('');
    try {
      const res = await api.get(`/report-cards/student/${studentId}/pdf`, { responseType: 'blob' });
      // Check if the response is actually an error JSON (not a PDF)
      if (res.data.type === 'application/json') {
        const text = await res.data.text();
        const errData = JSON.parse(text);
        setError(errData.error || 'Cannot generate PDF');
        return;
      }
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Report_Card_${studentName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Cannot generate PDF — marks may not be approved yet');
    }
  };

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    // Convert relative image URLs to absolute for the print window
    const html = content.innerHTML.replace(/src="\/uploads\//g, `src="${window.location.origin}/uploads/`);

    win.document.write(`<html><head><title>Report Card</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #1a1a1a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .header { border-bottom: 3px double #333; padding-bottom: 15px; margin-bottom: 20px; }
        .header h1 { margin: 0; font-size: 24px; }
        .header p { margin: 2px 0; color: #555; font-size: 13px; }
        .header img { width: 64px; height: 64px; object-fit: contain; }
        .student-info { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 20px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
        th { background: #e2e8f0 !important; font-weight: 600; font-size: 11px; text-transform: uppercase; }
        .summary { margin-top: 20px; padding: 15px; background: #ecfdf5 !important; border: 1px solid #059669; border-radius: 8px; }
        .grade-box { display: inline-block; padding: 4px 12px; border: 2px solid #333; font-weight: bold; font-size: 18px; border-radius: 8px; }
        .signatures { display: flex; justify-content: space-between; margin-top: 50px; padding-top: 10px; }
        .bg-green-50, .bg-red-50, .bg-yellow-50, .bg-indigo-50, .bg-gray-50 { padding: 8px; border-radius: 6px; text-align: center; }
        .bg-green-50 { background: #f0fdf4 !important; }
        .bg-red-50 { background: #fef2f2 !important; }
        .bg-yellow-50 { background: #fefce8 !important; }
        .bg-indigo-50 { background: #eef2ff !important; }
        .bg-gray-50 { background: #f9fafb !important; }
        @media print { body { padding: 10px; } }
      </style></head><body>`);
    win.document.write(html);
    win.document.write('</body></html>');
    win.document.close();
    // Wait for images to load before printing
    win.onload = () => win.print();
  };

  const typeLabel: Record<string, string> = {
    midterm_written: 'Mid-Term Written', midterm_oral: 'Mid-Term Oral',
    final_written: 'Final Written', final_oral: 'Final Oral',
    class_test: 'Class Test', project: 'Project',
  };
  const termLabel: Record<string, string> = { term1: 'Term 1', term2: 'Term 2', annual: 'Annual' };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Cards</h1>
          <p className="text-gray-500 text-sm mt-1">Generate and customize report cards</p>
        </div>
        {user?.role === 'admin' && (
          <button onClick={loadConfig} className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            Customize
          </button>
        )}
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Class selector */}
      <div className="mb-6">
        <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setReportData(null); }}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">Select class...</option>
          {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>)}
        </select>
      </div>

      {/* Class summary table */}
      {selectedClass && classSummary.length > 0 && !reportData && (
        <>
        <div className="mb-4"><TableSearch value={summarySearch} onChange={setSummarySearch} placeholder="Search student or roll..." /></div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortHeader label="Rank" k="rank" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Roll" k="roll_number" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Name" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Total" k="totalObtained" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader label="Percentage" k="percentage" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedSummary.map((s: any) => (
                <tr key={s.student_id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">#{s.rank}</td>
                  <td className="px-5 py-3 text-sm font-mono text-gray-600">{s.roll_number}</td>
                  <td className="px-5 py-3 text-sm text-gray-900">{s.name}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{s.totalObtained}/{s.totalMax}</td>
                  <td className="px-5 py-3"><span className={`text-sm font-medium ${s.percentage >= 60 ? 'text-green-600' : s.percentage >= 40 ? 'text-amber-600' : 'text-red-600'}`}>{s.percentage}%</span></td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => viewReport(s.student_id)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3">View</button>
                    <button onClick={() => downloadPDF(s.student_id, s.name)} className="text-red-600 hover:text-red-800 text-sm font-medium">PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Report Card View */}
      {reportData && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => setReportData(null)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to list
            </button>
            <button onClick={handlePrint} className="bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print
            </button>
            <button onClick={() => downloadPDF(reportData.student.id, reportData.student.name)}
              className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Download PDF
            </button>
          </div>

          {/* Printable report card */}
          <div ref={printRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-4xl mx-auto">
            <div className="header border-b-4 border-double border-gray-800 pb-4 mb-6">
              <div className={`flex items-center ${reportData.config.institute_logo ? 'gap-4' : 'justify-center'}`}>
                {reportData.config.institute_logo && (
                  <img src={`/uploads/${reportData.config.institute_logo}`} alt="Logo" className="w-16 h-16 object-contain" crossOrigin="anonymous" />
                )}
                <div className={reportData.config.institute_logo ? '' : 'text-center'}>
                  <h1 className="text-2xl font-bold text-gray-900">{reportData.config.institute_name || 'Institute Name'}</h1>
                  {reportData.config.address_line && <p className="text-sm text-gray-500">{reportData.config.address_line}</p>}
                  {reportData.config.tagline && <p className="text-sm italic text-gray-400">"{reportData.config.tagline}"</p>}
                </div>
              </div>
              <p className="text-lg font-semibold text-gray-800 mt-3 text-center">REPORT CARD - {reportData.student.academic_year}</p>
            </div>

            <div className="student-info flex gap-4 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm flex-1">
                <div><span className="text-gray-500">Name: </span><span className="font-semibold">{reportData.student.name}</span></div>
                <div><span className="text-gray-500">Roll No: </span><span className="font-semibold font-mono">{reportData.student.roll_number}</span></div>
                <div><span className="text-gray-500">Class: </span><span className="font-semibold">{reportData.student.class_name}</span></div>
                <div><span className="text-gray-500">DOB: </span><span className="font-semibold">{reportData.student.date_of_birth}</span></div>
                <div><span className="text-gray-500">Gender: </span><span className="font-semibold capitalize">{reportData.student.gender}</span></div>
                <div><span className="text-gray-500">Parent: </span><span className="font-semibold">{reportData.student.parent_name}</span></div>
              </div>
              {(reportData.config.show_photo ?? true) && reportData.student.photo_path && (
                <img src={`/uploads/${reportData.student.photo_path}`} alt={reportData.student.name}
                  className="w-16 h-20 object-cover rounded-md border-2 border-indigo-200 shrink-0" />
              )}
            </div>

            {/* Marks Table */}
            <table className="w-full border-collapse mb-6 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left">Subject</th>
                  {reportData.examTypes.map((et: string) => (
                    <th key={et} className="border border-gray-300 px-3 py-2 text-center text-xs">{typeLabel[et] || et}</th>
                  ))}
                  <th className="border border-gray-300 px-3 py-2 text-center">Total</th>
                  {reportData.config.show_percentage && <th className="border border-gray-300 px-3 py-2 text-center">%</th>}
                  {reportData.config.show_grade && <th className="border border-gray-300 px-3 py-2 text-center">Grade</th>}
                </tr>
              </thead>
              <tbody>
                {reportData.subjects.map((sub: any) => (
                  <tr key={sub.subject.id} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-3 py-2 font-medium">{sub.subject.name}</td>
                    {reportData.examTypes.map((et: string) => {
                      const exam = sub.exams.find((e: any) => e.exam_type === et);
                      return (
                        <td key={et} className="border border-gray-300 px-3 py-2 text-center">
                          {exam ? `${exam.marks_obtained}/${exam.max_marks}` : '-'}
                        </td>
                      );
                    })}
                    <td className="border border-gray-300 px-3 py-2 text-center font-semibold">{sub.totalObtained}/{sub.totalMax}</td>
                    {reportData.config.show_percentage && <td className="border border-gray-300 px-3 py-2 text-center">{sub.percentage}%</td>}
                    {reportData.config.show_grade && <td className="border border-gray-300 px-3 py-2 text-center font-bold">{sub.grade}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-gray-300 px-3 py-2" colSpan={reportData.examTypes.length + 1}>Grand Total</td>
                  {reportData.config.show_percentage && <td className="border border-gray-300 px-3 py-2 text-center">{reportData.summary.percentage}%</td>}
                  {reportData.config.show_grade && <td className="border border-gray-300 px-3 py-2 text-center text-lg">{reportData.summary.grade}</td>}
                </tr>
              </tfoot>
            </table>

            {/* Overall Summary */}
            <div className="summary bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Overall Result</p>
                <p className="text-lg font-bold text-gray-900">{reportData.summary.totalObtained} / {reportData.summary.totalMax}</p>
                <p className="text-sm text-gray-600">{reportData.summary.remark}</p>
              </div>
              <div className="text-center">
                <div className="grade-box border-2 border-gray-800 px-6 py-3 rounded-lg">
                  <span className="text-3xl font-bold">{reportData.summary.grade}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{reportData.summary.percentage}%</p>
              </div>
            </div>

            {/* Attendance */}
            {reportData.config.show_attendance && reportData.attendance && (
              <div className="attendance mb-6">
                <p className="text-sm font-semibold text-gray-700 mb-2">Attendance Summary</p>
                <div className="flex gap-6 text-sm">
                  <span>Total Days: <strong>{reportData.attendance.total}</strong></span>
                  <span>Present: <strong className="text-green-600">{reportData.attendance.present}</strong></span>
                  <span>Absent: <strong className="text-red-600">{reportData.attendance.absent}</strong></span>
                  <span>Attendance: <strong>{reportData.attendance.percentage}%</strong></span>
                </div>
              </div>
            )}

            {/* Signatures */}
            <div className="signatures flex justify-between mt-12 pt-2">
              <div className="text-center">
                <div className="border-t border-gray-400 w-40 mx-auto"></div>
                <p className="text-xs text-gray-500 mt-1">Class Teacher</p>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 w-40 mx-auto"></div>
                <p className="text-xs text-gray-500 mt-1">{reportData.config.principal_name || 'Principal'}</p>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 w-40 mx-auto"></div>
                <p className="text-xs text-gray-500 mt-1">Parent/Guardian</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customize Config Modal */}
      {showConfig && config && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-900">Customize Report Card</h2></div>
            <div className="p-6 space-y-4">
              {/* Logo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Organization Logo</label>
                <div className="flex items-center gap-4">
                  {config.institute_logo && (
                    <img src={`/uploads/${config.institute_logo}`} alt="Logo" className="w-16 h-16 object-contain border border-gray-200 rounded-lg" />
                  )}
                  <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {config.institute_logo ? 'Change Logo' : 'Upload Logo'}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG or SVG. Max 2MB. Appears on PDF report cards.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Institute Name</label>
                <input type="text" value={config.institute_name || ''} onChange={(e) => setConfig({ ...config, institute_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Line</label>
                <input type="text" value={config.address_line || ''} onChange={(e) => setConfig({ ...config, address_line: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tagline / Motto</label>
                <input type="text" value={config.tagline || ''} onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Excellence in Education" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Principal Name</label>
                <input type="text" value={config.principal_name || ''} onChange={(e) => setConfig({ ...config, principal_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Show on Report Card</p>
                <div className="space-y-2">
                  {[
                    { key: 'show_attendance', label: 'Attendance Summary' },
                    { key: 'show_photo', label: 'Student Photo' },
                    { key: 'show_grade', label: 'Grade Column' },
                    { key: 'show_percentage', label: 'Percentage Column' },
                    { key: 'show_rank', label: 'Class Rank' },
                    { key: 'show_remarks', label: 'Remarks' },
                  ].map((opt) => (
                    <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={config[opt.key] ?? true}
                        onChange={(e) => setConfig({ ...config, [opt.key]: e.target.checked })}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button onClick={() => setShowConfig(false)} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
                <button onClick={saveConfig} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
