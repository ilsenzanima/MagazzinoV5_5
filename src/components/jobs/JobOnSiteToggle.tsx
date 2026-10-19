"use client"

import { HardHat } from "lucide-react";

interface JobOnSiteToggleProps {
    onSite: boolean;
    canEdit: boolean;
    disabled?: boolean;
    onToggle: () => void;
}

// Elmetto: acceso = commessa «in cantiere» (operai al lavoro), mostrata per prima nelle ricerche
export function JobOnSiteToggle({ onSite, canEdit, disabled, onToggle }: JobOnSiteToggleProps) {
    const label = onSite ? "In cantiere: appare per prima nelle ricerche" : "Segna come in cantiere";
    const look = onSite
        ? "bg-amber-400 text-amber-950 border-amber-500"
        : "bg-transparent text-slate-400 border-slate-200 dark:border-slate-700 hover:text-amber-600 hover:border-amber-400";

    if (!canEdit) {
        return onSite ? (
            <span title="In cantiere" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-amber-400 text-amber-950 border-amber-500">
                <HardHat className="h-4 w-4" />
            </span>
        ) : null;
    }

    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={onSite}
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${look}`}
        >
            <HardHat className="h-4 w-4" />
        </button>
    );
}
