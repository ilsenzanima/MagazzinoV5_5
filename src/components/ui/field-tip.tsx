"use client";

import { Info } from "lucide-react";

/**
 * Tooltip inline per spiegare un campo di un form al passaggio del mouse.
 */
export function FieldTip({ text }: { text: string }) {
    return (
        <span className="inline-flex items-center ml-1 group relative cursor-help">
            <Info className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs bg-popover text-popover-foreground border border-border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-52 text-center z-50 leading-relaxed">
                {text}
            </span>
        </span>
    );
}
