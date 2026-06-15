"use client";

import { useState } from 'react';
import { useAuth } from '@/components/auth-provider';

export type PageSize = 12 | 24 | 48;
export const PAGE_SIZES: PageSize[] = [12, 24, 48];

function readPageSize(key: string, defaultSize: PageSize): PageSize {
  if (typeof window === 'undefined') return defaultSize;
  const saved = parseInt(localStorage.getItem(key) ?? '', 10);
  return (saved === 12 || saved === 24 || saved === 48) ? saved as PageSize : defaultSize;
}

export function usePageSize(page: string, defaultSize: PageSize = 12): [PageSize, (size: PageSize) => void] {
  const { user } = useAuth();
  const key = `pageSize:${page}:${user?.id ?? 'anon'}`;

  // Lazy initializer reads synchronously from localStorage — no useEffect delay
  const [size, setSize] = useState<PageSize>(() => readPageSize(key, defaultSize));

  const updateSize = (newSize: PageSize) => {
    setSize(newSize);
    localStorage.setItem(key, String(newSize));
  };

  return [size, updateSize];
}
