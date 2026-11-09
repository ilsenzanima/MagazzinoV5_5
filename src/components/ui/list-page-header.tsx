"use client"

import Link from "next/link";
import { createPortal } from "react-dom";
import { ChevronLeft, Search } from "lucide-react";
import { useNotchSlots, NestedStripCtx } from "@/components/ui/notch-tabs";
import { useContext, useEffect, useSyncExternalStore } from "react";
import { useMobileSearch } from "@/components/layout/mobile-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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
    // Da tablet in su: striscia scura con titolo a sinistra e ricerca a destra (come le pagine della commessa)
    strip?: boolean;
}

// Telefono: sotto i 768 px
const PHONE_QUERY = "(max-width: 767px)";
function usePhone() {
    return useSyncExternalStore(
        (cb) => {
            const mq = window.matchMedia(PHONE_QUERY);
            mq.addEventListener("change", cb);
            return () => mq.removeEventListener("change", cb);
        },
        () => window.matchMedia(PHONE_QUERY).matches,
        () => false
    );
}

// Intestazione standard delle pagine con un elenco: riquadro fisso in alto con titolo e barra di ricerca
export function ListPageHeader({ title, actions, search, searchActions, children, strip }: ListPageHeaderProps) {
    const { actions: slot } = useNotchSlots();
    const nested = useContext(NestedStripCtx);
    // Dentro una pagina unita da PC: niente seconda striscia, ricerca e filtri vanno nella striscia di sopra
    const merged = !!(strip && slot);
    // Telefono: niente intestazione in pagina. Ricerca e filtri passano nel pannello «Cerca» della barra in basso
    // (i pulsanti «nuovo» sono gia' nel pannello «Azioni»)
    const phone = usePhone();
    const mobile = useMobileSearch();
    const registerSearch = mobile?.registerSearch;
    const hasSearchBody = !!(search || searchActions || children);
    useEffect(() => {
        if (!phone || !registerSearch || !hasSearchBody) return;
        return registerSearch({ title });
    }, [phone, registerSearch, hasSearchBody, title]);
    const mergedSearch = merged && (search || searchActions) ? createPortal(
        <div className="hidden items-center gap-2 md:flex">
            {search && (
                <div className="relative w-72 max-w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Label htmlFor={search.id + "-strip"} className="sr-only">{search.label}</Label>
                    <Input id={search.id + "-strip"} name="search" type="search" autoComplete="off" placeholder={search.placeholder} className="h-9 rounded-full border-none bg-white pl-9 text-slate-800" value={search.value} onChange={(e) => search.onChange(e.target.value)} />
                </div>
            )}
            {searchActions}
        </div>,
        slot!
    ) : null;
    if (phone && mobile) {
        return mobile.searchSlot ? createPortal(
            <div className="space-y-3">
                {search && (
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Label htmlFor={search.id} className="sr-only">{search.label}</Label>
                        <Input
                            id={search.id}
                            name="search"
                            type="search"
                            autoComplete="off"
                            placeholder={search.placeholder}
                            className="h-11 rounded-full border-slate-300 bg-white pl-9 text-base dark:bg-slate-800"
                            value={search.value}
                            onChange={(e) => search.onChange(e.target.value)}
                        />
                    </div>
                )}
                {searchActions && <div className="flex flex-wrap gap-2">{searchActions}</div>}
                {children}
            </div>,
            mobile.searchSlot
        ) : null;
    }
    return (
        <>
        {mergedSearch}
        <div className={cn(
            "bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border",
            merged && "md:hidden",
            strip && (nested ? "md:mt-0" : "md:mt-7"),
            strip && !merged && "md:flex md:items-center md:gap-4 md:space-y-0 md:min-h-[68px] md:rounded-2xl md:border-0 md:bg-slate-800 md:px-4 md:py-0 md:text-white md:shadow-md md:dark:bg-slate-800"
        )}>
            <div className={cn("flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4", strip && "md:justify-start")}>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <Link href="/dashboard" className="md:hidden">
                        <Button variant="ghost" size="icon" className="-ml-2" aria-label="Torna indietro">
                            <ChevronLeft className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                        </Button>
                    </Link>
                    <h1 className={cn("text-xl font-bold text-slate-900 dark:text-white", strip && "md:text-sm md:uppercase md:tracking-wide md:text-white")}>{title}</h1>
                </div>
                {actions && <div className="flex items-center gap-2 w-full sm:w-auto">{actions}</div>}
            </div>

            {(search || searchActions) && <div className={cn("flex gap-2", strip && "md:ml-auto md:items-center")}>
                {search && <div className={cn("relative flex-1", strip && "md:w-80 md:flex-none")}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <Label htmlFor={search.id} className="sr-only">{search.label}</Label>
                    <Input
                        id={search.id}
                        name="search"
                        type="search"
                        autoComplete="off"
                        placeholder={search.placeholder}
                        className={cn("pl-9 bg-slate-100 dark:bg-muted border-none", strip && "md:rounded-full md:bg-white md:dark:bg-white md:text-slate-800")}
                        value={search.value}
                        onChange={(e) => search.onChange(e.target.value)}
                    />
                </div>}
                {searchActions}
            </div>}

            {children}
        </div>
        </>
    );
}
