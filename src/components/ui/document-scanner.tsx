"use client"

import { useState, useRef, useCallback, useEffect } from "react"
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
    const [capturedImage, setCapturedImage] = useState<HTMLImageElement | null>(null)
    const [processedImage, setProcessedImage] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const scannerRef = useRef<any>(null)

    // Load jscanify dynamically only when dialog opens
    useEffect(() => {
        if (open && !scannerRef.current) {
            import("jscanify").then((module) => {
                const JScanify = module.default
                scannerRef.current = new JScanify()
            }).catch((err) => {
                console.error("Failed to load jscanify:", err)
            })
        }
    }, [open])

    const processImage = useCallback((img: HTMLImageElement) => {
        try {
            if (scannerRef.current) {
                const resultCanvas = scannerRef.current.extractPaper(img, img.width, img.height)
                setProcessedImage(resultCanvas.toDataURL('image/jpeg', 0.9))
            } else {
                // Fallback if scanner not loaded
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                ctx?.drawImage(img, 0, 0)
                setProcessedImage(canvas.toDataURL('image/jpeg', 0.9))
            }
        } catch (error) {
            console.error('Edge detection failed, using original:', error)
            // Fallback to original image if detection fails
            const canvas = document.createElement('canvas')
            canvas.width = img.width
            canvas.height = img.height
            const ctx = canvas.getContext('2d')
            ctx?.drawImage(img, 0, 0)
            setProcessedImage(canvas.toDataURL('image/jpeg', 0.9))
        }
    }, [])

    const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const img = new Image()
            img.onload = () => {
                setCapturedImage(img)
                setStep('preview')
                // Process with edge detection after a short delay
                setTimeout(() => processImage(img), 100)
            }
            img.src = event.target?.result as string
        }
        reader.readAsDataURL(file)
    }, [processImage])

    const handleRetake = useCallback(() => {
        setCapturedImage(null)
        setProcessedImage(null)
        setStep('capture')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleConfirm = useCallback(async () => {
        if (!processedImage) return

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

                if (imgRatio > pdfRatio) {
                    // Image is wider than A4
                    finalWidth = pdfWidth
                    finalHeight = pdfWidth / imgRatio
                    offsetY = (pdfHeight - finalHeight) / 2
                } else {
                    // Image is taller than A4
                    finalHeight = pdfHeight
                    finalWidth = pdfHeight * imgRatio
                    offsetX = (pdfWidth - finalWidth) / 2
                }

                const pdf = new jsPDF({
                    orientation: imgRatio > 1 ? 'landscape' : 'portrait',
                    unit: 'mm',
                    format: 'a4'
                })

                if (imgRatio > 1) {
                    // Landscape
                    pdf.addImage(processedImage, 'JPEG', offsetY, offsetX, finalHeight, finalWidth)
                } else {
                    // Portrait
                    pdf.addImage(processedImage, 'JPEG', offsetX, offsetY, finalWidth, finalHeight)
                }

                const pdfBlob = pdf.output('blob')
                onScanComplete(pdfBlob)

                // Reset state
                setCapturedImage(null)
                setProcessedImage(null)
                setStep('capture')
                setIsProcessing(false)
                onOpenChange(false)
            }
            img.src = processedImage
        } catch (error) {
            console.error('PDF generation failed:', error)
            alert('Errore nella generazione del PDF')
            setIsProcessing(false)
            setStep('preview')
        }
    }, [processedImage, onScanComplete, onOpenChange])

    const handleClose = () => {
        setCapturedImage(null)
        setProcessedImage(null)
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

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="relative aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                                {processedImage ? (
                                    <img
                                        src={processedImage}
                                        alt="Documento scansionato"
                                        className="w-full h-full object-contain"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                                        <span className="ml-2 text-slate-500">Rilevamento bordi...</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={handleRetake}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Riprova
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleConfirm}
                                    disabled={!processedImage}
                                >
                                    <Check className="mr-2 h-4 w-4" />
                                    Conferma
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

                <canvas ref={canvasRef} className="hidden" />
            </DialogContent>
        </Dialog>
    )
}
