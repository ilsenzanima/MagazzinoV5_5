"use client"

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const DEFAULT_PAGE_SIZE = 25;

// Pagina di un elenco già caricato: da `page` (a partire da 1) restituisce le righe da mostrare
export function paginate<T>(rows: T[], page: number, pageSize = DEFAULT_PAGE_SIZE): T[] {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
}

interface PageControlsProps {
    page: number;
    total: number;
    pageSize?: number;
    onPageChange: (page: number) => void;
}

// Barra «1–25 di 79» con pagina precedente e successiva; non compare se basta una pagina
export function PageControls({ page, total, pageSize = DEFAULT_PAGE_SIZE, onPageChange }: PageControlsProps) {
    if (total <= pageSize) return null;
    const pages = Math.ceil(total / pageSize);
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span>{from}–{to} di {total}</span>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Precedente
                </Button>
                <span className="min-w-[4.5rem] text-center">Pagina {page} / {pages}</span>
                <Button variant="outline" size="sm" className="h-8" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
                    Successiva <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
