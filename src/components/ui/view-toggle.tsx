"use client";

import { LayoutGrid, List } from 'lucide-react';
import { ViewMode } from '@/hooks/useViewMode';

interface ViewToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
}

export function ViewToggle({ mode, onChange, className }: ViewToggleProps) {
  return (
    <div className={`flex items-center border rounded-md overflow-hidden dark:border-slate-700 shrink-0 ${className ?? ''}`}>
      <button
        onClick={() => onChange('grid')}
        className={`p-1.5 transition-colors ${
          mode === 'grid'
            ? 'bg-blue-600 text-white'
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        title="Vista schede"
        aria-label="Vista schede"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange('list')}
        className={`p-1.5 transition-colors ${
          mode === 'list'
            ? 'bg-blue-600 text-white'
            : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
        }`}
        title="Vista lista"
        aria-label="Vista lista"
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
