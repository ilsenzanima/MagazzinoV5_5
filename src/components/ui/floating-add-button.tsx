"use client"

import Link from "next/link";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";

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
    // Più azioni: passandoci sopra il pulsante si divide in una voce per azione
    actions?: FloatingAddAction[];
    // Icona al posto del +
    icon?: ReactNode;
    // Visibile anche su telefono (in basso a destra, sopra la barra di navigazione)
    showOnMobile?: boolean;
}

// Pulsante «aggiungi» sempre visibile in basso a destra (solo da PC): tondo con il +,
// passandoci sopra si allarga e compare la scritta per intero (o, con più azioni, si divide in tante voci)
export function FloatingAddButton({ href, onClick, label, actions, icon, showOnMobile }: FloatingAddButtonProps) {
    const vis = showOnMobile ? "flex max-md:bottom-24 max-md:right-4" : "hidden md:flex";
    if (actions && actions.length > 0) {
        return (
            <div
                className={`group fixed bottom-10 right-10 z-20 ${vis} h-14 w-14 items-center overflow-hidden rounded-full bg-blue-600 text-white shadow-lg transition-all duration-300 ease-out hover:w-[30rem] focus-within:w-[30rem]`}
            >
                <span className="grid h-14 w-14 shrink-0 place-items-center" aria-hidden>
                    {icon ?? <Plus className="h-7 w-7" />}
                </span>
                <div className="flex h-full flex-1 items-stretch opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                    {actions.map((a) => {
                        const cls = "flex flex-1 items-center justify-center whitespace-nowrap border-l border-white/30 px-4 text-sm font-medium hover:bg-blue-700 focus-visible:bg-blue-700";
                        return a.href ? (
                            <Link key={a.label} href={a.href} className={cls}>{a.label}</Link>
                        ) : (
                            <button key={a.label} type="button" onClick={a.onClick} className={cls}>{a.label}</button>
                        );
                    })}
                </div>
            </div>
        );
    }

    const className = `group fixed bottom-10 right-10 z-20 ${vis} h-14 w-14 items-center overflow-hidden rounded-full bg-blue-600 text-white shadow-lg transition-all duration-300 ease-out hover:w-56 hover:bg-blue-700 focus-visible:w-56 focus-visible:bg-blue-700`;
    const content = (
        <>
            <span className="grid h-14 w-14 shrink-0 place-items-center">
                {icon ?? <Plus className="h-7 w-7" />}
            </span>
            <span className="whitespace-nowrap pr-6 text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                {label}
            </span>
        </>
    );

    if (onClick) {
        return (
            <button type="button" onClick={onClick} aria-label={label} className={className}>
                {content}
            </button>
        );
    }

    return (
        <Link href={href ?? "#"} aria-label={label} className={className}>
            {content}
        </Link>
    );
}
