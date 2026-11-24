"use client"

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { useMobileActions } from "@/components/layout/mobile-actions";

interface FloatingAddAction {
    // Un link oppure, in alternativa, un'azione (es. apre una finestra)
    href?: string;
    onClick?: () => void;
    label: string;
}

interface FloatingAddButtonProps {
    href?: string;
    // Al posto del link: apre ad esempio una finestra di inserimento
    onClick?: () => void;
    label?: string;
    // Più azioni: cliccando il pulsante (il + diventa una X) le voci salgono sopra di lui, una pillola per azione
    actions?: FloatingAddAction[];
    // Icona al posto del +
    icon?: ReactNode;
    // Non piu' usato: su telefono le azioni vanno nel pannello «Azioni»
    showOnMobile?: boolean;
}

// Pulsante «aggiungi» sempre visibile in basso a destra (da PC; su telefono diventa una voce del pannello Azioni): tondo con il +,
// passandoci sopra si allarga e compare la scritta per intero (o, con più azioni, si divide in tante voci)
export function FloatingAddButton({ href, onClick, label, actions, icon }: FloatingAddButtonProps) {
    // Su telefono e tablet il pulsante non c'e': le sue azioni stanno nel pannello «Azioni» della barra in basso
    useMobileActions(
        actions && actions.length > 0
            ? actions.map(a => ({ label: a.label, href: a.href, onClick: a.onClick, icon }))
            : [{ label: label ?? "Nuovo", href, onClick, icon }]
    );
    if (actions && actions.length > 0) {
        return <FloatingAddMenu actions={actions} icon={icon} />;
    }

    // Una sola azione: il clic sul tasto la esegue, passandoci sopra compare la pillola col nome (stessa grafica del menu)
    return <FloatingAddMenu actions={[{ href, onClick, label: label ?? "Nuovo" }]} icon={icon} single />;
}

const MAIN_BTN = "grid h-14 w-14 place-items-center rounded-full bg-blue-600 text-white ring-[6px] ring-white/80 shadow-[0_10px_18px_rgba(37,99,235,0.35),inset_0_2px_2px_rgba(255,255,255,0.5),inset_0_-5px_8px_rgba(0,0,0,0.25)] transition-all duration-300 hover:bg-blue-700 active:scale-95 dark:ring-white/10";

// Più azioni: il tasto tondo si apre al clic (il + ruota e diventa una X) e sopra compaiono le pillole, a cascata come nel menu da telefono
function FloatingAddMenu({ actions, icon, single }: { actions: FloatingAddAction[]; icon?: ReactNode; single?: boolean }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Con una sola azione il menu si apre passando sopra (con un piccolo ritardo in chiusura, per attraversare lo spazio tra tasto e pillola)
    const hoverOpen = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); };
    const hoverClose = () => { closeTimer.current = setTimeout(() => setOpen(false), 250); };
    useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
    const only = actions[0];

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
    }, [open]);

    return (
        <div ref={ref} className="fixed bottom-10 right-10 z-20 hidden lg:block"
            onMouseEnter={single ? hoverOpen : undefined} onMouseLeave={single ? hoverClose : undefined}
            onFocus={single ? hoverOpen : undefined} onBlur={single ? hoverClose : undefined}>
            <div data-open={open} className="dial-wrap dial-right absolute bottom-[4.75rem] right-0 w-[17rem]" style={{ "--n": actions.length } as CSSProperties}>
                <ul className="flex flex-col-reverse gap-3">
                    {actions.map((a, i) => {
                        const inner = (
                            <>
                                <span className="dial-ico">{icon ?? <Plus />}</span>
                                <span>{a.label}</span>
                            </>
                        );
                        return (
                            <li key={a.label} className="dial-item" style={{ "--i": i } as CSSProperties}>
                                {a.href ? (
                                    <Link href={a.href} onClick={() => setOpen(false)} className="dial-pill">{inner}</Link>
                                ) : (
                                    <button type="button" className="dial-pill" onClick={() => { setOpen(false); a.onClick?.(); }}>{inner}</button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
            {single ? (
                only.href ? (
                    <Link href={only.href} aria-label={only.label} className={MAIN_BTN}>{icon ?? <Plus className="h-7 w-7" />}</Link>
                ) : (
                    <button type="button" onClick={only.onClick} aria-label={only.label} className={MAIN_BTN}>{icon ?? <Plus className="h-7 w-7" />}</button>
                )
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    aria-expanded={open}
                    aria-label={open ? "Chiudi le azioni" : "Azioni"}
                    className={`${MAIN_BTN} relative`}
                >
                    <span className={`absolute transition-all duration-300 ${open ? "rotate-90 scale-50 opacity-0" : "rotate-0 opacity-100"}`}>{icon ?? <Plus className="h-7 w-7" />}</span>
                    <span className={`absolute transition-all duration-300 ${open ? "rotate-0 opacity-100" : "-rotate-90 scale-50 opacity-0"}`}><X className="h-7 w-7" /></span>
                </button>
            )}
        </div>
    );
}
