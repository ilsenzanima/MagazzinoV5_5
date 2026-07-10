"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface PhotoGalleryImage {
    url: string;
    name: string;
}

interface PhotoGalleryProps {
    images: PhotoGalleryImage[];
    index: number;
    onIndexChange: (index: number) => void;
    onClose: () => void;
}

// Visualizzatore fullscreen per navigare tra più foto in sequenza (frecce/tastiera)
// senza dover riaprire una scheda per ogni immagine. Riutilizzabile ovunque nell'app.
export function PhotoGallery({ images, index, onIndexChange, onClose }: PhotoGalleryProps) {
    const goPrev = useCallback(() => {
        onIndexChange((index - 1 + images.length) % images.length);
    }, [index, images.length, onIndexChange]);

    const goNext = useCallback(() => {
        onIndexChange((index + 1) % images.length);
    }, [index, images.length, onIndexChange]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            else if (e.key === "ArrowLeft") goPrev();
            else if (e.key === "ArrowRight") goNext();
        };
        document.addEventListener("keydown", handleKeyDown);
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = originalOverflow;
        };
    }, [onClose, goPrev, goNext]);

    if (typeof document === "undefined" || images.length === 0) return null;

    const current = images[index];

    return createPortal(
        <div
            className="fixed inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center animate-in fade-in"
            onClick={onClose}
        >
            <button
                onClick={onClose}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Chiudi"
            >
                <X className="h-6 w-6" />
            </button>

            <div className="absolute top-4 left-4 text-white/70 text-sm font-medium">
                {index + 1} / {images.length}
            </div>

            {images.length > 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); goPrev(); }}
                    className="absolute left-2 sm:left-4 text-white/80 hover:text-white p-2 sm:p-3 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Foto precedente"
                >
                    <ChevronLeft className="h-7 w-7 sm:h-8 sm:w-8" />
                </button>
            )}

            <img
                src={current.url}
                alt={current.name}
                onClick={(e) => e.stopPropagation()}
                className="max-h-[85vh] max-w-[90vw] object-contain rounded shadow-2xl select-none"
            />

            {images.length > 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); goNext(); }}
                    className="absolute right-2 sm:right-4 text-white/80 hover:text-white p-2 sm:p-3 rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Foto successiva"
                >
                    <ChevronRight className="h-7 w-7 sm:h-8 sm:w-8" />
                </button>
            )}

            <div className="absolute bottom-4 max-w-[80vw] text-center text-white/70 text-xs px-4 truncate">
                {current.name}
            </div>
        </div>,
        document.body
    );
}

// Helper per riconoscere se un file è un'immagine dal tipo/estensione, per decidere
// se aprirlo nella galleria invece che in una nuova scheda.
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif", "avif", "svg"]);

export function isImageFileType(fileType?: string | null): boolean {
    if (!fileType) return false;
    return IMAGE_EXTENSIONS.has(fileType.toLowerCase().replace(".", ""));
}
