"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { History, Menu, Package, QrCode, FileText, Search, Zap } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRegisteredActions } from "./mobile-actions";
import { MobileSearchSheet } from "./MobileSearchSheet";

interface MobileNavBarProps {
    // Contenuto del pannello «Naviga» (l'elenco delle pagine); riceve la funzione per chiuderlo
    renderNavigation: (close: () => void) => ReactNode;
}

// Pagine che compaiono tra le ultime aperte (prima parte dell'indirizzo → nome)
const RECENT_LABELS: Record<string, string> = {
    "/inventory": "Inventario",
    "/purchases": "Acquisti",
    "/movements": "Movimentazione",
    "/load-notes": "Note di Carico",
    "/workers": "Operai",
    "/attendance": "Presenze",
    "/cronoprogramma": "Cronoprogramma",
    "/agenda": "Agenda",
    "/jobs": "Commesse",
    "/clients": "Committenti",
    "/suppliers": "Fornitori",
    "/proposals": "Offerte generali",
    "/invoices": "Fatture",
    "/reports": "Report",
    "/compliance": "Conformità",
    "/guest-sites": "Cantieri Ospiti",
};
const RECENT_KEY = "mobile-recent-pages";

const GLOBAL_ACTIONS = [
    { label: "Nuovo movimento", href: "/movements/new", icon: <Package className="h-5 w-5" /> },
    { label: "Scansiona / Inventario", href: "/inventory", icon: <QrCode className="h-5 w-5" /> },
    { label: "Nuova nota di carico", href: "/load-notes/new", icon: <FileText className="h-5 w-5" /> },
];

function readRecents(): string[] {
    try {
        const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string" && p in RECENT_LABELS) : [];
    } catch {
        return [];
    }
}

export function MobileNavBar({ renderNavigation }: MobileNavBarProps) {
    const pathname = usePathname();
    const pageActions = useRegisteredActions();
    const [navOpen, setNavOpen] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [recents, setRecents] = useState<string[]>([]);

    // Ricorda le ultime pagine aperte (solo quelle principali)
    useEffect(() => {
        const base = "/" + (pathname?.split("/")[1] ?? "");
        if (!(base in RECENT_LABELS)) return;
        const next = [base, ...readRecents().filter(p => p !== base)].slice(0, 6);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* spazio non disponibile */ }
    }, [pathname]);

    useEffect(() => { if (navOpen) setRecents(readRecents()); }, [navOpen]);

    const current = "/" + (pathname?.split("/")[1] ?? "");
    const shownRecents = recents.filter(p => p !== current).slice(0, 4);

    const barButton = "flex h-full w-full flex-col items-center justify-center space-y-1 text-slate-500 transition-colors hover:text-slate-700 active:text-blue-600 dark:text-slate-400 dark:hover:text-slate-300";
    const rowCls = "flex w-full items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left text-sm font-medium shadow-sm active:bg-slate-100 dark:active:bg-slate-800 [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0 [&_svg]:text-blue-600";

    return (
        <>
            <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t dark:border-slate-800 z-50 flex items-center justify-around px-2 pb-safe-area-bottom shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
                {/* Naviga */}
                <button type="button" onClick={() => setNavOpen(true)} className={barButton} aria-label="Naviga tra le pagine">
                    <Menu className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Naviga</span>
                </button>

                {/* Azioni (centrale) */}
                <div className="relative -top-5">
                    <button
                        type="button"
                        onClick={() => setActionsOpen(true)}
                        aria-label="Azioni"
                        className="relative grid h-14 w-14 place-items-center rounded-full border-4 border-slate-50 bg-blue-600 text-white shadow-lg active:bg-blue-700 dark:border-background"
                    >
                        <Zap className="h-6 w-6" />
                        {pageActions.length > 0 && (
                            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {pageActions.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Cerca */}
                <button type="button" onClick={() => setSearchOpen(true)} className={barButton} aria-label="Cerca">
                    <Search className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Cerca</span>
                </button>
            </div>

            {/* Pannello Naviga */}
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
                <SheetContent side="bottom" className="flex h-[85dvh] flex-col gap-0 rounded-t-2xl border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Naviga</SheetTitle>
                        <SheetDescription>Tutte le pagine dell&apos;applicazione</SheetDescription>
                    </SheetHeader>
                    {shownRecents.length > 0 && (
                        <div className="border-b border-sidebar-border px-4 pb-3 pt-4 pr-12">
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">
                                <History className="h-3.5 w-3.5" /> Ultime aperte
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {shownRecents.map(p => (
                                    <Link key={p} href={p} prefetch={false} onClick={() => setNavOpen(false)}
                                        className="rounded-full bg-sidebar-accent px-3 py-1.5 text-sm text-sidebar-accent-foreground">
                                        {RECENT_LABELS[p]}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="min-h-0 flex-1">{renderNavigation(() => setNavOpen(false))}</div>
                </SheetContent>
            </Sheet>

            {/* Pannello Azioni */}
            <Sheet open={actionsOpen} onOpenChange={setActionsOpen}>
                <SheetContent side="bottom" className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-2xl p-0">
                    <SheetHeader className="border-b p-4 pr-12 text-left">
                        <SheetTitle>Azioni</SheetTitle>
                        <SheetDescription className="sr-only">Azioni della pagina e azioni rapide</SheetDescription>
                    </SheetHeader>
                    <div className="space-y-5 p-4 pb-8">
                        {pageActions.length > 0 && (
                            <section className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">In questa pagina</h3>
                                {pageActions.map(a => {
                                    const content = <>{a.icon ?? <Zap />}<span className="min-w-0 flex-1 truncate">{a.label}</span></>;
                                    return a.href ? (
                                        <Link key={a.id} href={a.href} prefetch={false} onClick={() => setActionsOpen(false)} className={rowCls}>{content}</Link>
                                    ) : (
                                        <button key={a.id} type="button" className={rowCls} onClick={() => { setActionsOpen(false); a.onClick?.(); }}>{content}</button>
                                    );
                                })}
                            </section>
                        )}
                        <section className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sempre disponibili</h3>
                            {GLOBAL_ACTIONS.map(a => (
                                <Link key={a.href} href={a.href} prefetch={false} onClick={() => setActionsOpen(false)} className={rowCls}>
                                    {a.icon}<span className="min-w-0 flex-1 truncate">{a.label}</span>
                                </Link>
                            ))}
                        </section>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Pannello Cerca */}
            <MobileSearchSheet open={searchOpen} onOpenChange={setSearchOpen} />
        </>
    );
}
