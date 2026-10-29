"use client"

import Link from "next/link";
import { ChevronLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ListPageHeaderProps {
    title: string;
    // A destra del titolo (es. pulsanti «nuovo» da telefono)
    actions?: React.ReactNode;
    search?: {
        id: string;
        value: string;
        onChange: (value: string) => void;
        placeholder: string;
        label: string;
    };
    // Accanto alla barra di ricerca (filtri rapidi, scanner, «azzera filtri»...)
    searchActions?: React.ReactNode;
    // Righe aggiuntive sotto la ricerca (es. menu a tendina da telefono)
    children?: React.ReactNode;
}

// Intestazione standard delle pagine con un elenco: riquadro fisso in alto con titolo e barra di ricerca
export function ListPageHeader({ title, actions, search, searchActions, children }: ListPageHeaderProps) {
    return (
        <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Link href="/dashboard" className="md:hidden">
                        <Button variant="ghost" size="icon" className="-ml-2" aria-label="Torna indietro">
                            <ChevronLeft className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                        </Button>
                    </Link>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
                </div>
                {actions && <div className="flex items-center gap-2 w-full sm:w-auto">{actions}</div>}
            </div>

            {(search || searchActions) && <div className="flex gap-2">
                {search && <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <Label htmlFor={search.id} className="sr-only">{search.label}</Label>
                    <Input
                        id={search.id}
                        name="search"
                        type="search"
                        autoComplete="off"
                        placeholder={search.placeholder}
                        className="pl-9 bg-slate-100 dark:bg-muted border-none"
                        value={search.value}
                        onChange={(e) => search.onChange(e.target.value)}
                    />
                </div>}
                {searchActions}
            </div>}

            {children}
        </div>
    );
}
