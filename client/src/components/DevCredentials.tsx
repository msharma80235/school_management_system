import { useState } from 'react';

const isDev = import.meta.env.DEV;

interface Credential {
  role: string;
  orgSlug: string;
  email: string;
  password: string;
  label?: string;
}

const credentials: Credential[] = [
  { role: 'Super', orgSlug: 'platform', email: 'super@educationhub.com', password: 'Super@123', label: 'All organizations' },
  { role: 'Admin', orgSlug: 'sunrise-academy', email: 'admin@sunrise.edu', password: 'Password@123', label: 'Sunrise Academy' },
  { role: 'Teacher', orgSlug: 'sunrise-academy', email: 'anand@sunrise.edu', password: 'Password@123', label: 'Mathematics' },
  { role: 'Teacher', orgSlug: 'sunrise-academy', email: 'sunita@sunrise.edu', password: 'Password@123', label: 'Science' },
  { role: 'Volunteer', orgSlug: 'sunrise-academy', email: 'volunteer@sunrise.edu', password: 'Password@123' },
  { role: 'Staff', orgSlug: 'sunrise-academy', email: 'staff@sunrise.edu', password: 'Password@123', label: 'Admin staff' },
  { role: 'Student', orgSlug: 'sunrise-academy', email: 'aarav.wilson@student.sunrise.edu', password: 'Password@123', label: 'Roll: SA-001' },
  { role: 'Parent', orgSlug: 'sunrise-academy', email: 'rajesh.sharma0@parent.sunrise.edu', password: 'Password@123' },
  { role: 'Admin', orgSlug: 'green-valley', email: 'admin@greenvalley.edu', password: 'Password@123', label: 'Green Valley School' },
  { role: 'Admin', orgSlug: 'hindiusa', email: 'admin@hindiusa.org', password: 'Password@123', label: 'HindiUSA' },
  { role: 'Teacher', orgSlug: 'hindiusa', email: 'anjali@hindiusa.org', password: 'Password@123', label: 'Hindi Reading' },
  { role: 'Student', orgSlug: 'hindiusa', email: 'aanya@student.hindiusa.org', password: 'Password@123', label: 'Roll: HU-001' },
  { role: 'Teacher', orgSlug: 'green-valley', email: 'sarah@greenvalley.edu', password: 'Password@123', label: 'Mathematics' },
];

interface Props {
  filter?: 'staff' | 'parent-student' | 'super' | 'all';
  onSelect?: (cred: { orgSlug: string; email: string; password: string }) => void;
}

export default function DevCredentials({ filter = 'all', onSelect }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!isDev) return null;

  const filtered = filter === 'staff'
    ? credentials.filter((c) => c.role === 'Admin' || c.role === 'Teacher' || c.role === 'Volunteer' || c.role === 'Staff')
    : filter === 'parent-student'
    ? credentials.filter((c) => c.role === 'Student' || c.role === 'Parent')
    : filter === 'super'
    ? credentials.filter((c) => c.role === 'Super')
    : credentials;

  const roleColor: Record<string, string> = {
    Admin: 'bg-purple-100 text-purple-700',
    Teacher: 'bg-blue-100 text-blue-700',
    Student: 'bg-emerald-100 text-emerald-700',
    Parent: 'bg-amber-100 text-amber-700',
    Volunteer: 'bg-teal-100 text-teal-700',
    Staff: 'bg-cyan-100 text-cyan-700',
    Super: 'bg-amber-100 text-amber-700',
  };

  return (
    <div className="mt-6 w-full">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 text-sm text-orange-600 hover:text-orange-800 font-medium py-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
        {expanded ? 'Hide' : 'Show'} Dev Test Accounts
        <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mt-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex px-2 py-0.5 bg-orange-200 text-orange-800 rounded text-xs font-bold">DEV MODE</span>
            <span className="text-xs text-orange-600">Click any row to auto-fill</span>
          </div>
          <div className="space-y-1.5">
            {filtered.map((cred, i) => (
              <button
                key={i}
                onClick={() => onSelect?.({ orgSlug: cred.orgSlug, email: cred.email, password: cred.password })}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-orange-100 transition text-left"
              >
                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${roleColor[cred.role] || 'bg-gray-100 text-gray-700'}`}>
                  {cred.role}
                </span>
                <span className="text-xs text-gray-500 w-24 truncate">{cred.orgSlug}</span>
                <span className="text-xs text-gray-800 font-mono flex-1 truncate">{cred.email}</span>
                {cred.label && <span className="text-xs text-gray-400">{cred.label}</span>}
              </button>
            ))}
          </div>
          <p className="text-xs text-orange-500 mt-2 text-center">Password: Password@123 (Super admin: Super@123)</p>
        </div>
      )}
    </div>
  );
}
