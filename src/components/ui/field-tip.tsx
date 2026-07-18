"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Tooltip inline per spiegare un campo di un form al passaggio del mouse.
 * Il contenuto è portalizzato (Radix Popover) così non viene tagliato da
 * contenitori con overflow (es. tabelle scrollabili) e si riposiziona da
 * solo se non c'è spazio.
 */
export function FieldTip({ text }: { text: string }) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <span
                    className="inline-flex items-center ml-1 cursor-help"
                    tabIndex={0}
                    onMouseEnter={() => setOpen(true)}
                    onMouseLeave={() => setOpen(false)}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setOpen(false)}
                >
                    <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-primary transition-colors" />
                </span>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                className="w-52 px-3 py-2 rounded-lg shadow-xl text-xs text-center leading-relaxed pointer-events-none"
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {text}
            </PopoverContent>
        </Popover>
    );
}
