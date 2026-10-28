"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  totalItems?: number;
  itemLabel?: string;
}

// Numeri di pagina da mostrare: prima, ultima e quelle vicine alla corrente; «…» per i salti
export function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  const wanted = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) { wanted.add(2); wanted.add(3); }
  if (page >= totalPages - 2) { wanted.add(totalPages - 1); wanted.add(totalPages - 2); }
  const pages = Array.from(wanted).filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  pages.forEach((n, i) => {
    if (i > 0 && n - pages[i - 1] > 1) out.push("gap");
    out.push(n);
  });
  return out;
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
    <div className="flex flex-col items-center justify-center gap-3 mt-8 pb-8">
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <Button variant="outline" size="sm" className="h-8 px-2" aria-label="Prima pagina" onClick={() => onPageChange(1)} disabled={page === 1 || loading}>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 px-2" aria-label="Pagina precedente" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1 || loading}>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pageWindow(page, totalPages).map((n, i) => n === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-slate-400">…</span>
        ) : (
          <Button
            key={n}
            size="sm"
            variant={n === page ? "default" : "outline"}
            className="h-8 min-w-8 px-2"
            aria-current={n === page ? "page" : undefined}
            onClick={() => onPageChange(n)}
            disabled={loading}
          >
            {n}
          </Button>
        ))}

        <Button variant="outline" size="sm" className="h-8 px-2" aria-label="Pagina successiva" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages || loading}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" className="h-8 px-2" aria-label="Ultima pagina" onClick={() => onPageChange(totalPages)} disabled={page === totalPages || loading}>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <span>
          Pagina {page} di {totalPages}
          {totalItems !== undefined && <span className="text-slate-400"> ({totalItems} {itemLabel ?? "elementi"})</span>}
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 dark:text-slate-500">Vai a</span>
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
    </div>
  );
}
