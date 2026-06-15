"use client";

import { PAGE_SIZES, PageSize } from '@/hooks/usePageSize';

interface PageSizeSelectorProps {
  value: PageSize;
  onChange: (size: PageSize) => void;
  className?: string;
}

export function PageSizeSelector({ value, onChange, className }: PageSizeSelectorProps) {
  return (
    <div className={`flex items-center border rounded-md overflow-hidden dark:border-slate-700 shrink-0 ${className ?? ''}`}>
      {PAGE_SIZES.map((size) => (
        <button
          key={size}
          onClick={() => onChange(size)}
          className={`px-2 py-1.5 text-xs font-medium transition-colors ${
            value === size
              ? 'bg-blue-600 text-white'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          title={`Mostra ${size} voci per pagina`}
        >
          {size}
        </button>
      ))}
    </div>
  );
}
