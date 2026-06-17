
"use client"

import React, { useState, useRef, useEffect } from 'react'
import ReactCrop, {
    centerCrop,
    makeAspectCrop,
    Crop,
    PixelCrop,
} from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getCroppedImg } from '@/lib/utils/image-utils'
import { Check, X } from 'lucide-react'
import { notify } from "@/lib/notify"

// Helper to center the crop initially
function centerAspectCrop(
    mediaWidth: number,
    mediaHeight: number,
    aspect: number,
) {
    return centerCrop(
        makeAspectCrop(
            {
                unit: '%',
                width: 90,
            },
            aspect,
            mediaWidth,
            mediaHeight,
        ),
        mediaWidth,
        mediaHeight,
    )
}

interface ImageCropperProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    imageSrc: string | null
    onCropComplete: (file: File) => void
    aspectRatio?: number // Default to 1 (square)
    title?: string
}

export function ImageCropper({
    open,
    onOpenChange,
    imageSrc,
    onCropComplete,
    aspectRatio = 1, // Default 1:1
    title = "Ritaglia Immagine"
}: ImageCropperProps) {
    const [crop, setCrop] = useState<Crop>()
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
    const imgRef = useRef<HTMLImageElement>(null)
    const [isLoading, setIsLoading] = useState(false)

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        if (aspectRatio) {
            const { width, height } = e.currentTarget
            setCrop(centerAspectCrop(width, height, aspectRatio))
        }
    }

    async function handleConfirm() {
        if (completedCrop && imgRef.current && imageSrc) {
            setIsLoading(true)
            try {
                // Ensure we have a valid crop. If user just clicks confirm without moving, use the initial centered crop or full image?
                // completedCrop should be set by onChange/onComplete of ReactCrop

                // If the crop is extremely small or invalid, we might want to prevent saving or default to something.
                if (completedCrop.width === 0 || completedCrop.height === 0) {
                    // Assume full image center crop if something weird happened, or return
                    return
                }

                const croppedFile = await getCroppedImg(
                    imgRef.current,
                    completedCrop,
                    "cropped-image.png",
                    400,
                    400,
                    "image/png"
                )
                onCropComplete(croppedFile)
                onOpenChange(false)
            } catch (e) {
                console.error("Error creating cropped image", e)
                notify.error("Errore durante il ritaglio dell'immagine")
            } finally {
                setIsLoading(false)
            }
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Trascina per ritagliare l'immagine. Verrà salvata in formato quadrato (400x400).
                    </DialogDescription>
                </DialogHeader>

                <div className="flex justify-center items-center py-4 bg-slate-50 dark:bg-black/20 rounded-md overflow-hidden min-h-[300px]">
                    {imageSrc && (
                        <ReactCrop
                            crop={crop}
                            onChange={(_, percentCrop) => setCrop(percentCrop)}
                            onComplete={(c) => setCompletedCrop(c)}
                            aspect={aspectRatio}
                            className="max-h-[60vh]"
                        >
                            <img
                                ref={imgRef}
                                alt="Crop me"
                                src={imageSrc}
                                onLoad={onImageLoad}
                                className="max-w-full max-h-[60vh] object-contain"
                            />
                        </ReactCrop>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        <X className="w-4 h-4 mr-2" />
                        Annulla
                    </Button>
                    <Button onClick={handleConfirm} disabled={!completedCrop || isLoading}>
                        <Check className="w-4 h-4 mr-2" />
                        {isLoading ? "Elaborazione..." : "Conferma Ritaglio"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
