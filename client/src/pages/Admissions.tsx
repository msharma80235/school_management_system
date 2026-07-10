import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

interface Admission {
  id: string;
  student_name: string;
  date_of_birth: string | null;
  gender: string | null;
  grade_applying: string | null;
  guardian_name: string;
  email: string | null;
  phone: string | null;
  message: string | null;
  stage: string;
  decision_note: string | null;
  created_at: string;
  student: { id: string; first_name: string; last_name: string; roll_number: string } | null;
}
interface ClassItem { id: string; name: string; section: string; }

const STAGES = ['enquiry', 'reviewing', 'accepted', 'rejected', 'enrolled'];
const stageColor: Record<string, string> = {
  enquiry: 'bg-blue-100 text-blue-700',
  reviewing: 'bg-amber-100 text-amber-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-500',
  enrolled: 'bg-indigo-100 text-indigo-700',
};

export default function Admissions() {
  const { org } = useAuth();
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [convert, setConvert] = useState<Admission | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const r = await api.get(`/admissions${filter ? `?stage=${filter}` : ''}`);
    setAdmissions(r.data.admissions);
    setCounts(r.data.counts);
  };

  useEffect(() => { load(); }, [filter]);
  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data.classes)).catch(() => {}); }, []);

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); };

  const move = async (a: Admission, stage: string) => {
    let decision_note: string | undefined;
    if (stage === 'rejected') {
      const note = prompt('Reason for rejection (optional, shared with the applicant):') ?? '';
      decision_note = note;
    }
    try {
      await api.patch(`/admissions/${a.id}/stage`, { stage, decision_note });
      flash(`Marked ${stage}`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed');
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admissions</h1>
          <p className="text-gray-500 text-sm mt-1">Enquiries and applications from prospective students</p>
        </div>
        <ShareLink />
      </div>

      {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{success}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      {/* Funnel filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === '' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          All
        </button>
        {STAGES.map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${filter === s ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s} <span className="opacity-70">({counts[s] ?? 0})</span>
          </button>
        ))}
      </div>

      {admissions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-400">
          No admissions here yet. Share your enquiry link to start receiving them.
        </div>
      ) : (
        <div className="space-y-3">
          {admissions.map((a) => (
            <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900">{a.student_name}</h3>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${stageColor[a.stage]}`}>{a.stage}</span>
                    {a.grade_applying && <span className="text-xs text-gray-400">for {a.grade_applying}</span>}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Guardian: {a.guardian_name}
                    {a.email && ` • ${a.email}`}{a.phone && ` • ${a.phone}`}
                  </p>
                  {a.message && <p className="text-sm text-gray-500 mt-1 italic">"{a.message}"</p>}
                  {a.decision_note && <p className="text-xs text-gray-400 mt-1">Note: {a.decision_note}</p>}
                  {a.student && <p className="text-xs text-indigo-600 mt-1">Enrolled as {a.student.first_name} {a.student.last_name} ({a.student.roll_number})</p>}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {a.stage !== 'enrolled' && a.stage !== 'rejected' && (
                    <div className="flex gap-2">
                      {a.stage === 'enquiry' && (
                        <button onClick={() => move(a, 'reviewing')} className="text-amber-700 hover:text-amber-900 text-sm font-medium">Review</button>
                      )}
                      {a.stage !== 'accepted' && (
                        <button onClick={() => move(a, 'accepted')} className="text-green-700 hover:text-green-900 text-sm font-medium">Accept</button>
                      )}
                      <button onClick={() => move(a, 'rejected')} className="text-red-600 hover:text-red-800 text-sm font-medium">Reject</button>
                    </div>
                  )}
                  {a.stage === 'accepted' && (
                    <button onClick={() => setConvert(a)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">Enroll</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {convert && (
        <ConvertModal admission={convert} classes={classes} onClose={() => setConvert(null)}
          onDone={(msg) => { setConvert(null); flash(msg); load(); }} />
      )}
    </div>
  );

  function ShareLink() {
    const slug = org?.slug;
    if (!slug) return null;
    const link = `${window.location.origin}/apply/${slug}`;
    return (
      <button onClick={() => { navigator.clipboard?.writeText(link); flash('Enquiry link copied'); }}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium border border-indigo-200 rounded-lg px-3 py-2">
        Copy enquiry link
      </button>
    );
  }
}

function ConvertModal({ admission, classes, onClose, onDone }: {
  admission: Admission;
  classes: ClassItem[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [classId, setClassId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [invite, setInvite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const submit = async () => {
    if (!classId) { setError('Select a class.'); return; }
    setBusy(true); setError('');
    try {
      const r = await api.post(`/admissions/${admission.id}/convert`, {
        class_id: classId, roll_number: rollNumber || undefined, create_parent_invite: invite,
      });
      if (r.data.invite?.join_url) { setInviteLink(r.data.invite.join_url); }
      else onDone(`${admission.student_name} enrolled`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Enrollment failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Enroll {admission.student_name}</h2>
        </div>
        {inviteLink ? (
          <div className="p-6 space-y-4">
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">Enrolled! Share this parent sign-up link with the guardian:</div>
            <div className="flex gap-2">
              <input readOnly value={inviteLink} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700" />
              <button onClick={() => navigator.clipboard?.writeText(inviteLink)} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm">Copy</button>
            </div>
            <button onClick={() => onDone(`${admission.student_name} enrolled`)} className="w-full px-4 py-2 bg-gray-100 rounded-lg font-medium text-gray-700 hover:bg-gray-200">Done</button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}{c.section ? ` - ${c.section}` : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Roll number <span className="text-gray-400 font-normal">(optional — auto-assigned if blank)</span></label>
              <input value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {admission.email && (
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                Email the guardian ({admission.email}) a parent sign-up link
              </label>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">Cancel</button>
              <button onClick={submit} disabled={busy} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50">
                {busy ? 'Enrolling…' : 'Enroll'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
