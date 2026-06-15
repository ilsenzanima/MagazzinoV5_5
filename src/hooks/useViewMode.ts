"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';

export type ViewMode = 'grid' | 'list';

export function useViewMode(page: string, defaultMode: ViewMode = 'grid'): [ViewMode, (mode: ViewMode) => void] {
  const { user } = useAuth();
  const key = `viewMode:${page}:${user?.id ?? 'anon'}`;

  const [mode, setMode] = useState<ViewMode>(defaultMode);

  // Read from localStorage once the key is known (after hydration)
  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved === 'list' || saved === 'grid') setMode(saved);
    else setMode(defaultMode);
  }, [key]);

  const updateMode = (newMode: ViewMode) => {
    setMode(newMode);
    localStorage.setItem(key, newMode);
  };

  return [mode, updateMode];
}
