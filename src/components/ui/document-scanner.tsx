"use client"

import { useState, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, RotateCcw, Check, Loader2 } from "lucide-react"
import { jsPDF } from "jspdf"

interface DocumentScannerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onScanComplete: (pdfBlob: Blob) => void
}

export function DocumentScanner({ open, onOpenChange, onScanComplete }: DocumentScannerProps) {
    const [step, setStep] = useState<'capture' | 'preview' | 'processing'>('capture')
    const [imageData, setImageData] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            setImageData(event.target?.result as string)
            setStep('preview')
        }
        reader.readAsDataURL(file)
    }, [])

    const handleRetake = useCallback(() => {
        setImageData(null)
        setStep('capture')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleConfirm = useCallback(async () => {
        if (!imageData) return

        setStep('processing')
        setIsProcessing(true)

        try {
            // Create PDF from image
            const img = new Image()
            img.onload = () => {
                // A4 size in mm
                const pdfWidth = 210
                const pdfHeight = 297

                // Calculate scaling to fit image in A4
                const imgRatio = img.width / img.height
                const pdfRatio = pdfWidth / pdfHeight

                let finalWidth, finalHeight, offsetX = 0, offsetY = 0
                const isLandscape = imgRatio > 1

                if (isLandscape) {
                    // Landscape image - use landscape PDF
                    const landscapePdfWidth = 297
                    const landscapePdfHeight = 210
                    const landscapeRatio = landscapePdfWidth / landscapePdfHeight

                    if (imgRatio > landscapeRatio) {
                        finalWidth = landscapePdfWidth
                        finalHeight = landscapePdfWidth / imgRatio
                        offsetY = (landscapePdfHeight - finalHeight) / 2
                    } else {
                        finalHeight = landscapePdfHeight
                        finalWidth = landscapePdfHeight * imgRatio
                        offsetX = (landscapePdfWidth - finalWidth) / 2
                    }
                } else {
                    // Portrait image
                    if (imgRatio > pdfRatio) {
                        finalWidth = pdfWidth
                        finalHeight = pdfWidth / imgRatio
                        offsetY = (pdfHeight - finalHeight) / 2
                    } else {
                        finalHeight = pdfHeight
                        finalWidth = pdfHeight * imgRatio
                        offsetX = (pdfWidth - finalWidth) / 2
                    }
                }

                const pdf = new jsPDF({
                    orientation: isLandscape ? 'landscape' : 'portrait',
                    unit: 'mm',
                    format: 'a4'
                })

                pdf.addImage(imageData, 'JPEG', offsetX, offsetY, finalWidth, finalHeight)

                const pdfBlob = pdf.output('blob')
                onScanComplete(pdfBlob)

                // Reset state
                setImageData(null)
                setStep('capture')
                setIsProcessing(false)
                onOpenChange(false)
            }
            img.src = imageData
        } catch (error) {
            console.error('PDF generation failed:', error)
            notify.error('Errore nella generazione del PDF')
            setIsProcessing(false)
            setStep('preview')
        }
    }, [imageData, onScanComplete, onOpenChange])

    const handleClose = () => {
        setImageData(null)
        setStep('capture')
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Scansiona Documento
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {step === 'capture' && (
                        <div className="text-center py-8">
                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 bg-slate-50 dark:bg-slate-800">
                                <Camera className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                                <p className="text-slate-600 dark:text-slate-400 mb-4">
                                    Scatta una foto del documento
                                </p>
                                <div className="relative inline-block">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={handleCapture}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                    <Button size="lg">
                                        <Camera className="mr-2 h-5 w-5" />
                                        Apri Fotocamera
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && imageData && (
                        <div className="space-y-4">
                            <div className="relative aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                                <img
                                    src={imageData}
                                    alt="Documento scansionato"
                                    className="w-full h-full object-contain"
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={handleRetake}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Riprova
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleConfirm}
                                >
                                    <Check className="mr-2 h-4 w-4" />
                                    Genera PDF
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'processing' && (
                        <div className="text-center py-12">
                            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-600" />
                            <p className="text-slate-600 dark:text-slate-400">
                                Generazione PDF in corso...
                            </p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
