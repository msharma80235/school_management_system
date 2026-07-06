import { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc';

// Client-side sorting over any array. sortKey supports dot-paths like "class.name".
export function useSort<T>(rows: T[], initialKey: string | null = null, initialDir: SortDir = 'asc') {
  const [sortKey, setSortKey] = useState<string | null>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

  const toggleSort = (k: string) => {
    if (sortKey === k) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const get = (obj: any, path: string) => path.split('.').reduce((o, p) => (o == null ? o : o[p]), obj);
    return [...rows].sort((a, b) => {
      const av = get(a, sortKey);
      const bv = get(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else if (typeof av === 'boolean' && typeof bv === 'boolean') cmp = av === bv ? 0 : av ? -1 : 1;
      else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}

interface SortHeaderProps {
  label: string;
  k: string;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (k: string) => void;
  align?: 'left' | 'center' | 'right';
}

// Clickable table header with sort direction indicator
export function SortHeader({ label, k, sortKey, sortDir, onSort, align = 'left' }: SortHeaderProps) {
  const active = sortKey === k;
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th
      onClick={() => onSort(k)}
      className={`px-5 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${alignCls} ${
        active ? 'text-indigo-600' : 'text-gray-500 hover:text-gray-800'
      }`}
      title={`Sort by ${label}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d={sortDir === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
          </svg>
        ) : (
          <svg className="w-3 h-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        )}
      </span>
    </th>
  );
}

// Small labeled search input used above tables
export function TableSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Search...'}
        className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
    </div>
  );
}
