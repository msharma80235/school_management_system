interface HomeworkItem {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  subject: { id: string; name: string; code: string };
  assigned_by_user: { id: string; name: string } | null;
  book?: { id: string; title: string; author: string } | null;
}

export default function HomeworkList({ homework }: { homework: HomeworkItem[] }) {
  const today = new Date().toISOString().split('T')[0];

  const dueBadge = (dueDate: string) => {
    if (dueDate < today) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Past due</span>;
    if (dueDate === today) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Due today</span>;
    const diff = Math.ceil((new Date(dueDate).getTime() - new Date(today).getTime()) / 86400000);
    if (diff <= 2) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Due in {diff} day{diff > 1 ? 's' : ''}</span>;
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Due {dueDate}</span>;
  };

  const upcoming = homework.filter((h) => h.due_date >= today);
  const past = homework.filter((h) => h.due_date < today);

  if (homework.length === 0) {
    return <p className="text-gray-400 text-center py-8">No homework assigned yet</p>;
  }

  return (
    <div className="space-y-4">
      {upcoming.length > 0 && (
        <div className="space-y-2">
          {upcoming.map((hw) => (
            <div key={hw.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-indigo-50 text-indigo-700">{hw.subject.code}</span>
                  <h4 className="font-medium text-gray-900">{hw.title}</h4>
                </div>
                {dueBadge(hw.due_date)}
              </div>
              {hw.description && <p className="text-sm text-gray-600 mt-1">{hw.description}</p>}
              {hw.book && (
                <div className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13" /></svg>
                  <span className="font-medium">{hw.book.title}</span>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {hw.subject.name}{hw.assigned_by_user ? ` • ${hw.assigned_by_user.name}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <details className="group">
          <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-600 select-none">
            Past homework ({past.length})
          </summary>
          <div className="space-y-2 mt-2 opacity-60">
            {past.map((hw) => (
              <div key={hw.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex px-2 py-0.5 rounded text-xs font-mono bg-gray-50 text-gray-500">{hw.subject.code}</span>
                    <span className="text-sm text-gray-600">{hw.title}</span>
                  </div>
                  <span className="text-xs text-gray-400">{hw.due_date}</span>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
