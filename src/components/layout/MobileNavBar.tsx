"use client";

import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    Building2, CalendarDays, Calendar, ClipboardList, FileText, History, LayoutDashboard, LogOut,
    Package, QrCode, Search, Settings, ShieldCheck, ShoppingCart, Store, Truck, Users, Wrench, X, Zap, HardHat, LayoutGrid,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useRegisteredActions, useRegisteredNavSection } from "./mobile-actions";
import { MobileSearchSheet } from "./MobileSearchSheet";
import { NotificationBell } from "./NotificationBell";

interface NavItem {
    label: string;
    href: string;
    icon: ComponentType<{ className?: string }>;
    staff?: boolean;  // solo admin e operativo
    admin?: boolean;  // solo admin
}

// Pagine del pannello «Naviga» da telefono
const NAV_ITEMS: NavItem[] = [
    { label: "Home", href: "/dashboard", icon: LayoutDashboard },
    { label: "Inventario", href: "/inventory", icon: Package },
    { label: "Acquisti", href: "/purchases", icon: ShoppingCart },
    { label: "Movimentazione", href: "/movements", icon: Truck },
    { label: "Note di Carico", href: "/load-notes", icon: ClipboardList },
    { label: "Presenze", href: "/attendance", icon: Calendar },
    { label: "Agenda", href: "/agenda", icon: CalendarDays, staff: true },
    { label: "Conformità", href: "/compliance", icon: ShieldCheck, staff: true },
    { label: "Cantieri Ospiti", href: "/guest-sites", icon: Building2, staff: true },
    { label: "Commesse", href: "/jobs", icon: HardHat },
    { label: "Committenti", href: "/clients", icon: Users },
    { label: "Fornitori", href: "/suppliers", icon: Store, staff: true },
    { label: "Impostazioni", href: "/settings", icon: Settings },
    { label: "Strumenti admin", href: "/strumenti", icon: Wrench, admin: true },
];
const RECENT_KEY = "mobile-recent-pages";

// Azioni sempre disponibili dal tasto centrale
const GLOBAL_ACTIONS = [
    { label: "Nuovo movimento", href: "/movements/new", icon: <Truck className="h-5 w-5" /> },
    { label: "Scansiona / Inventario", href: "/inventory", icon: <QrCode className="h-5 w-5" /> },
    { label: "Nuova nota di carico", href: "/load-notes/new", icon: <FileText className="h-5 w-5" /> },
];

const baseOf = (path: string | null) => "/" + (path?.split("/")[1] ?? "");

export function MobileNavBar() {
    const pathname = usePathname();
    const { user, signOut, userRole, fullName } = useAuth();
    const pageActions = useRegisteredActions();
    const navSection = useRegisteredNavSection();
    const [navOpen, setNavOpen] = useState(false);
    const [dialOpen, setDialOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [recents, setRecents] = useState<string[]>([]);

    const staff = userRole === "admin" || userRole === "operativo";
    const items = NAV_ITEMS.filter(i => (!i.staff || staff) && (!i.admin || userRole === "admin"));
    const labelOf = (base: string) => NAV_ITEMS.find(i => i.href === base)?.label;

    const readRecents = (): string[] => {
        try {
            const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
            return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string" && !!labelOf(p)) : [];
        } catch {
            return [];
        }
    };

    // Ricorda le ultime pagine aperte (solo quelle del menu) e chiude il menu flottante
    useEffect(() => {
        setDialOpen(false);
        const base = baseOf(pathname);
        if (!labelOf(base)) return;
        const next = [base, ...readRecents().filter(p => p !== base)].slice(0, 6);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* spazio non disponibile */ }
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { if (navOpen) setRecents(readRecents()); }, [navOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const current = baseOf(pathname);
    const shownRecents = recents.filter(p => p !== current && items.some(i => i.href === p)).slice(0, 4);

    // Menu flottante: prima le azioni della pagina, poi quelle sempre disponibili (senza doppioni)
    const dial: { key: string; label: string; href?: string; onClick?: () => void; icon: ReactNode; page: boolean }[] = [
        ...pageActions.map(a => ({ key: a.id, label: a.label, href: a.href, onClick: a.onClick, icon: a.icon ?? <Zap className="h-5 w-5" />, page: true })),
        ...GLOBAL_ACTIONS.filter(g => !pageActions.some(a => a.href === g.href)).map(g => ({ key: g.href, label: g.label, href: g.href, onClick: undefined, icon: g.icon, page: false })),
    ];

    const sideButton = "flex h-full flex-1 flex-col items-center justify-center gap-1 text-slate-300 transition-colors active:text-white";

    return (
        <>
            {/* Menu flottante delle azioni */}
            {(dialOpen || navOpen || searchOpen) && (
                <>
                    <button type="button" aria-label="Chiudi" onClick={() => { setDialOpen(false); setNavOpen(false); setSearchOpen(false); }}
                        className="fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-[1px] animate-in fade-in duration-200 lg:hidden" />
                    {dialOpen && <div className="fixed inset-x-0 z-50 max-h-[calc(100dvh-13rem)] overflow-y-auto px-4 py-1 scrollbar-hide lg:hidden"
                        style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom))" }}>
                        <ul className="mx-auto flex max-w-sm flex-col-reverse gap-3">
                            {dial.map((a, i) => {
                                const inner = (
                                    <span className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
                                        <span className="justify-self-end rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-md">{a.label}</span>
                                        <span className={cn("grid h-12 w-12 place-items-center rounded-full text-white shadow-lg [&_svg]:h-5 [&_svg]:w-5", a.page ? "bg-blue-600" : "bg-slate-700")}>{a.icon}</span>
                                        <span />
                                    </span>
                                );
                                const cls = "block w-full animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards duration-200";
                                const style = { animationDelay: `${i * 35}ms` };
                                return (
                                    <li key={a.key}>
                                        {a.href ? (
                                            <Link href={a.href} prefetch={false} onClick={() => setDialOpen(false)} className={cls} style={style}>{inner}</Link>
                                        ) : (
                                            <button type="button" className={cls} style={style} onClick={() => { setDialOpen(false); a.onClick?.(); }}>{inner}</button>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </div>}
                </>
            )}

            {/* Barra: fascia scura con incavo al centro che accoglie il cerchio */}
            <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
                {/* Menu Naviga: la fascia stessa che sale, stessa tinta della barra */}
                {navOpen && (
                    <div className="relative -mb-[38px] max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain rounded-t-3xl bg-slate-800 px-4 pb-[50px] pt-5 text-slate-100 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom-6 fade-in duration-200">
                        {navSection && (
                            <div className="mb-4 space-y-3">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{navSection.title}</p>
                                {navSection.groups.map(group => (
                                    <div key={group.key}>
                                        <p className="mb-1.5 text-[11px] font-medium text-slate-400">{group.label}</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {group.items.map(item => (
                                                <button key={item.key} type="button" onClick={() => { item.onSelect(); setNavOpen(false); }}
                                                    className={cn(
                                                        "flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-lg border px-1 py-2 text-center text-[11px] font-medium leading-tight active:scale-[0.97] [&_svg]:h-5 [&_svg]:w-5",
                                                        item.active ? "border-blue-500 bg-blue-600 text-white" : "border-slate-600 bg-slate-700/60 text-slate-100 [&_svg]:text-blue-400"
                                                    )}>
                                                    {item.icon}
                                                    <span>{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                <div className="border-t border-slate-700 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Pagine</div>
                            </div>
                        )}
                        {shownRecents.length > 0 && (
                            <div className="mb-4">
                                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    <History className="h-3.5 w-3.5" /> Ultime aperte
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {shownRecents.map(p => (
                                        <Link key={p} href={p} prefetch={false} onClick={() => setNavOpen(false)}
                                            className="rounded-full bg-slate-700 px-3 py-1.5 text-sm text-slate-100">
                                            {labelOf(p)}
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2.5">
                            {items.map(item => {
                                const active = current === item.href;
                                return (
                                    <Link key={item.href} href={item.href} prefetch={false} onClick={() => setNavOpen(false)}
                                        className={cn(
                                            "flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-xl border px-1.5 py-3 text-center text-xs font-medium leading-tight transition-colors active:scale-[0.97]",
                                            active
                                                ? "border-blue-500 bg-blue-600 text-white"
                                                : "border-slate-600 bg-slate-700/60 text-slate-100 active:bg-slate-600"
                                        )}>
                                        <item.icon className={cn("h-6 w-6", active ? "text-white" : "text-blue-400")} />
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                        {user && (
                            <div className="mt-4 flex items-center gap-2 border-t border-slate-700 pt-3">
                                <Link href="/settings/profile" prefetch={false} onClick={() => setNavOpen(false)} className="min-w-0 flex-1 rounded-md px-1 py-1">
                                    <p className="truncate text-sm font-medium">{fullName || user.email}</p>
                                    <p className="text-xs capitalize text-slate-400">{userRole || "User"}</p>
                                </Link>
                                <span className="[&_button]:!text-slate-200"><NotificationBell onNavigate={() => setNavOpen(false)} /></span>
                                <button type="button" onClick={() => signOut()} aria-label="Esci"
                                    className="grid h-9 w-9 place-items-center rounded-md text-slate-200 active:bg-slate-700">
                                    <LogOut className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {searchOpen && <MobileSearchSheet onClose={() => setSearchOpen(false)} />}
                <div className="relative flex h-16 items-stretch">
                    <button type="button" onClick={() => { setDialOpen(false); setSearchOpen(false); setNavOpen(o => !o); }} className={cn(sideButton, "bg-slate-800")} aria-label={navOpen ? "Chiudi il menu" : "Naviga tra le pagine"} aria-expanded={navOpen}>
                        {navOpen ? <X className="h-5 w-5" /> : <LayoutGrid className="h-5 w-5" />}
                        <span className="text-[10px] font-medium">{navOpen ? "Chiudi" : "Naviga"}</span>
                    </button>

                    <svg width="96" height="64" viewBox="0 0 96 64" className="-mx-px shrink-0 fill-slate-800" aria-hidden="true">
                        <path d="M0,0 C13,0 16,38 48,38 C80,38 83,0 96,0 V64 H0 Z" />
                    </svg>

                    <button type="button" onClick={() => { setNavOpen(false); setSearchOpen(false); setDialOpen(o => !o); }} aria-label={dialOpen ? "Chiudi le azioni" : "Azioni"} aria-expanded={dialOpen}
                        className={cn("absolute left-1/2 top-0 grid h-14 w-14 -translate-x-1/2 -translate-y-[22px] place-items-center rounded-full bg-blue-600 text-white shadow-lg ring-4 ring-slate-800/10 transition-all active:scale-95", (navOpen || searchOpen) && "pointer-events-none scale-50 opacity-0")}>
                        <span className={cn("transition-transform duration-200", dialOpen && "rotate-90")}>
                            {dialOpen ? <X className="h-6 w-6" /> : <Zap className="h-6 w-6" />}
                        </span>
                        {!dialOpen && pageActions.length > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                                {pageActions.length}
                            </span>
                        )}
                    </button>

                    <button type="button" onClick={() => { setDialOpen(false); setNavOpen(false); setSearchOpen(o => !o); }} className={cn(sideButton, "bg-slate-800")} aria-label={searchOpen ? "Chiudi la ricerca" : "Cerca"} aria-expanded={searchOpen}>
                        {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
                        <span className="text-[10px] font-medium">{searchOpen ? "Chiudi" : "Cerca"}</span>
                    </button>
                </div>
                <div className="bg-slate-800" style={{ height: "env(safe-area-inset-bottom)" }} />
            </div>

        </>
    );
}
