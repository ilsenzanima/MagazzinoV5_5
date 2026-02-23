"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Maximize2 } from "lucide-react";

interface PreviewPopupProps {
    title: string;
    children: React.ReactNode;
}

/**
 * Wrapper che rende un'anteprima cliccabile: al click apre un popup
 * con il contenuto ingrandito a tutto schermo.
 */
export function PreviewPopup({ title, children }: PreviewPopupProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full cursor-pointer group relative rounded-lg transition-all hover:bg-muted/50 active:scale-[0.98]"
                title="Clicca per ingrandire"
            >
                {children}
                <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-background/80 border border-border/50 shadow-sm">
                    <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center p-4 min-h-[300px]">
                        {children}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
