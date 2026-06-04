"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemLabel?: string;
}

export function PaginationControls({ page, totalPages, loading, onPageChange, totalItems, itemLabel }: PaginationControlsProps) {
  const [inputValue, setInputValue] = useState("");

  if (totalPages <= 1) return null;

  const handleJump = () => {
    const n = parseInt(inputValue);
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      onPageChange(n);
    }
    setInputValue("");
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8 pb-8">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1 || loading}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="text-sm text-slate-600 dark:text-slate-400 min-w-[100px] text-center">
        Pagina {page} di {totalPages}
        {totalItems !== undefined && <span className="text-slate-400"> ({totalItems} {itemLabel ?? "elementi"})</span>}
      </span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages || loading}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1.5">
        <span className="text-sm text-slate-400 dark:text-slate-500">Vai a</span>
        <Input
          type="number"
          min={1}
          max={totalPages}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJump()}
          className="w-16 h-8 text-sm text-center"
          placeholder={String(page)}
        />
        <Button variant="outline" size="sm" onClick={handleJump} disabled={loading} className="h-8">
          Vai
        </Button>
      </div>
    </div>
  );
}
