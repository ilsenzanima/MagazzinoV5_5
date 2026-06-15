"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-provider';

export type PageSize = 12 | 24 | 48;
export const PAGE_SIZES: PageSize[] = [12, 24, 48];

export function usePageSize(page: string, defaultSize: PageSize = 12): [PageSize, (size: PageSize) => void] {
  const { user } = useAuth();
  const key = `pageSize:${page}:${user?.id ?? 'anon'}`;

  const [size, setSize] = useState<PageSize>(defaultSize);

  useEffect(() => {
    const saved = parseInt(localStorage.getItem(key) ?? '', 10);
    if (saved === 12 || saved === 24 || saved === 48) setSize(saved as PageSize);
    else setSize(defaultSize);
  }, [key]);

  const updateSize = (newSize: PageSize) => {
    setSize(newSize);
    localStorage.setItem(key, String(newSize));
  };

  return [size, updateSize];
}
