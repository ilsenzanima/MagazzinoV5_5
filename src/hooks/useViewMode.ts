"use client";

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';

export type ViewMode = 'grid' | 'list';

function readViewMode(key: string, defaultMode: ViewMode): ViewMode {
  if (typeof window === 'undefined') return defaultMode;
  const saved = localStorage.getItem(key);
  return (saved === 'list' || saved === 'grid') ? saved : defaultMode;
}

export function useViewMode(page: string, defaultMode: ViewMode = 'grid'): [ViewMode, (mode: ViewMode) => void] {
  const { user } = useAuth();
  const key = `viewMode:${page}:${user?.id ?? 'anon'}`;

  // Lazy initializer reads synchronously from localStorage — no useEffect delay
  const [mode, setMode] = useState<ViewMode>(() => readViewMode(key, defaultMode));

  const updateMode = (newMode: ViewMode) => {
    setMode(newMode);
    localStorage.setItem(key, newMode);
  };

  return [mode, updateMode];
}
