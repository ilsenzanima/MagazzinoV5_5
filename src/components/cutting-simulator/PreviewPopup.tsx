"use client";

import { useState, cloneElement, isValidElement, type ReactElement } from "react";
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
 * con il contenuto ingrandito. Nel popup il contenuto viene scalato
 * con transform per occupare tutto lo spazio disponibile.
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
                <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-background/90 border border-border/50 shadow-sm">
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                </span>
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-[90vw] max-h-[90vh] w-auto overflow-auto">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center p-6">
                        <ScaledContent>{children}</ScaledContent>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

/**
 * Componente che clona i children SVG rimuovendo i vincoli max-w e style.height
 * per poterli renderizzare in grande nel popup.
 */
function ScaledContent({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="w-full min-w-[500px] max-w-[800px]"
            style={{
                // Override SVG constraints: rimuove maxWidth/height inline
                // e lascia che l'SVG riempia il container
            }}
        >
            <style>{`
        .preview-popup-enlarged svg {
          width: 100% !important;
          max-width: none !important;
          height: auto !important;
          min-height: 300px;
        }
        .preview-popup-enlarged canvas {
          width: 100% !important;
          max-width: none !important;
          height: auto !important;
        }
      `}</style>
            <div className="preview-popup-enlarged">
                {children}
            </div>
        </div>
    );
}
