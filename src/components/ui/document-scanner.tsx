"use client"

import { notify } from "@/lib/notify";
import { useState, useRef, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, RotateCcw, Check, Loader2, Plus, Trash2, FileText, GripVertical, Wand2 } from "lucide-react"
import { jsPDF } from "jspdf"

interface DocumentScannerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onScanComplete: (pdfBlob: Blob) => void
}

interface ScannedPage {
    id: string
    originalImage: string
    processedImage: string
}

type ScannerStep = 'capture' | 'processing' | 'crop' | 'pages' | 'generating'

// Type declarations for jscanify
interface JscanifyInstance {
    highlightPaper: (image: HTMLImageElement | HTMLCanvasElement, options?: { color?: string }) => HTMLCanvasElement
    extractPaper: (image: HTMLImageElement | HTMLCanvasElement, paperWidth?: number, paperHeight?: number) => HTMLCanvasElement
    getCornerPoints: (image: HTMLImageElement | HTMLCanvasElement) => { topLeftCorner: {x: number, y: number}, topRightCorner: {x: number, y: number}, bottomLeftCorner: {x: number, y: number}, bottomRightCorner: {x: number, y: number} } | null
}

declare global {
    interface Window {
        cv: unknown
        Jscanify: new () => JscanifyInstance
    }
}

// Load OpenCV.js dynamically
const loadOpenCV = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (window.cv) {
            resolve()
            return
        }

        const script = document.createElement('script')
        script.src = 'https://docs.opencv.org/4.7.0/opencv.js'
        script.async = true
        script.onload = () => {
            // OpenCV.js needs time to initialize
            const checkCV = () => {
                if (window.cv && (window.cv as { getBuildInformation?: () => string }).getBuildInformation) {
                    resolve()
                } else {
                    setTimeout(checkCV, 100)
                }
            }
            checkCV()
        }
        script.onerror = () => reject(new Error('Failed to load OpenCV.js'))
        document.head.appendChild(script)
    })
}

// Load jscanify dynamically
const loadJscanify = async (): Promise<JscanifyInstance> => {
    await loadOpenCV()
    
    if (window.Jscanify) {
        return new window.Jscanify()
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/gh/nicokratky/jscanify@master/src/jscanify.min.js'
        script.async = true
        script.onload = () => {
            if (window.Jscanify) {
                resolve(new window.Jscanify())
            } else {
                reject(new Error('Jscanify not found after loading'))
            }
        }
        script.onerror = () => reject(new Error('Failed to load jscanify'))
        document.head.appendChild(script)
    })
}

export function DocumentScanner({ open, onOpenChange, onScanComplete }: DocumentScannerProps) {
    const [step, setStep] = useState<ScannerStep>('capture')
    const [currentImage, setCurrentImage] = useState<string | null>(null)
    const [processedImage, setProcessedImage] = useState<string | null>(null)
    const [pages, setPages] = useState<ScannedPage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [loadingMessage, setLoadingMessage] = useState('')
    const [scannerReady, setScannerReady] = useState(false)
    const [draggedPage, setDraggedPage] = useState<string | null>(null)
    
    const fileInputRef = useRef<HTMLInputElement>(null)
    const scannerRef = useRef<JscanifyInstance | null>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    // Initialize scanner when dialog opens
    useEffect(() => {
        if (open && !scannerReady) {
            setLoadingMessage('Caricamento scanner...')
            setIsLoading(true)
            loadJscanify()
                .then((scanner) => {
                    scannerRef.current = scanner
                    setScannerReady(true)
                    setIsLoading(false)
                    setLoadingMessage('')
                })
                .catch((error) => {
                    console.error('Failed to load scanner:', error)
                    // Still allow usage without perspective correction
                    setScannerReady(true)
                    setIsLoading(false)
                    setLoadingMessage('')
                    notify.warning('Scanner avanzato non disponibile. Funzionalità base attiva.')
                })
        }
    }, [open, scannerReady])

    const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const imageData = event.target?.result as string
            setCurrentImage(imageData)
            setStep('processing')
            
            // Process the image
            processImage(imageData)
        }
        reader.readAsDataURL(file)
    }, [])

    const processImage = async (imageData: string) => {
        setLoadingMessage('Elaborazione immagine...')
        setIsLoading(true)

        const img = new Image()
        img.onload = async () => {
            try {
                if (scannerRef.current) {
                    setLoadingMessage('Rilevamento documento...')
                    
                    // Try to extract the paper with perspective correction
                    const extractedCanvas = scannerRef.current.extractPaper(img, 595, 842) // A4 at 72 DPI
                    const processedData = extractedCanvas.toDataURL('image/jpeg', 0.9)
                    setProcessedImage(processedData)
                } else {
                    // Fallback: use original image
                    setProcessedImage(imageData)
                }
                
                setStep('crop')
            } catch (error) {
                console.error('Image processing error:', error)
                // Fallback to original image
                setProcessedImage(imageData)
                setStep('crop')
            } finally {
                setIsLoading(false)
                setLoadingMessage('')
            }
        }
        img.src = imageData
    }

    const handleRetake = useCallback(() => {
        setCurrentImage(null)
        setProcessedImage(null)
        setStep('capture')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleAcceptCrop = useCallback(() => {
        if (!processedImage) return

        const newPage: ScannedPage = {
            id: `page-${Date.now()}`,
            originalImage: currentImage || processedImage,
            processedImage: processedImage
        }

        setPages(prev => [...prev, newPage])
        setCurrentImage(null)
        setProcessedImage(null)
        setStep('pages')
        
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [processedImage, currentImage])

    const handleAddPage = useCallback(() => {
        setStep('capture')
    }, [])

    const handleRemovePage = useCallback((pageId: string) => {
        setPages(prev => prev.filter(p => p.id !== pageId))
    }, [])

    const handleDragStart = (pageId: string) => {
        setDraggedPage(pageId)
    }

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
        e.preventDefault()
        if (!draggedPage || draggedPage === targetId) return

        setPages(prev => {
            const draggedIndex = prev.findIndex(p => p.id === draggedPage)
            const targetIndex = prev.findIndex(p => p.id === targetId)
            
            if (draggedIndex === -1 || targetIndex === -1) return prev

            const newPages = [...prev]
            const [removed] = newPages.splice(draggedIndex, 1)
            newPages.splice(targetIndex, 0, removed)
            return newPages
        })
    }

    const handleDragEnd = () => {
        setDraggedPage(null)
    }

    const handleGeneratePDF = useCallback(async () => {
        if (pages.length === 0) return

        setStep('generating')
        setLoadingMessage('Generazione PDF...')
        setIsLoading(true)

        try {
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            })

            const pdfWidth = 210
            const pdfHeight = 297

            for (let i = 0; i < pages.length; i++) {
                if (i > 0) {
                    pdf.addPage()
                }

                const img = new Image()
                await new Promise<void>((resolve) => {
                    img.onload = () => {
                        const imgRatio = img.width / img.height
                        const pdfRatio = pdfWidth / pdfHeight
                        const isLandscape = imgRatio > 1.2

                        let finalWidth: number, finalHeight: number, offsetX = 0, offsetY = 0

                        if (isLandscape) {
                            // Landscape image - rotate or fit
                            if (imgRatio > pdfRatio) {
                                finalWidth = pdfWidth
                                finalHeight = pdfWidth / imgRatio
                                offsetY = (pdfHeight - finalHeight) / 2
                            } else {
                                finalHeight = pdfHeight
                                finalWidth = pdfHeight * imgRatio
                                offsetX = (pdfWidth - finalWidth) / 2
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

                        pdf.addImage(pages[i].processedImage, 'JPEG', offsetX, offsetY, finalWidth, finalHeight)
                        resolve()
                    }
                    img.src = pages[i].processedImage
                })
            }

            const pdfBlob = pdf.output('blob')
            onScanComplete(pdfBlob)

            // Reset state
            setPages([])
            setCurrentImage(null)
            setProcessedImage(null)
            setStep('capture')
            onOpenChange(false)

        } catch (error) {
            console.error('PDF generation failed:', error)
            notify.error('Errore nella generazione del PDF')
            setStep('pages')
        } finally {
            setIsLoading(false)
            setLoadingMessage('')
        }
    }, [pages, onScanComplete, onOpenChange])

    const handleClose = () => {
        setCurrentImage(null)
        setProcessedImage(null)
        setPages([])
        setStep('capture')
        onOpenChange(false)
    }

    const handleUseOriginal = useCallback(() => {
        if (!currentImage) return
        setProcessedImage(currentImage)
    }, [currentImage])

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Scansiona Documento
                        {pages.length > 0 && (
                            <span className="ml-auto text-sm font-normal text-slate-500">
                                {pages.length} {pages.length === 1 ? 'pagina' : 'pagine'}
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <canvas ref={canvasRef} className="hidden" />

                <div className="space-y-4">
                    {/* Loading overlay */}
                    {isLoading && (
                        <div className="text-center py-12">
                            <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-blue-600" />
                            <p className="text-slate-600 dark:text-slate-400">
                                {loadingMessage}
                            </p>
                        </div>
                    )}

                    {/* Capture step */}
                    {step === 'capture' && !isLoading && (
                        <div className="text-center py-8">
                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 bg-slate-50 dark:bg-slate-800">
                                <Camera className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                                <p className="text-slate-600 dark:text-slate-400 mb-2">
                                    Scatta una foto del documento
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
                                    Il documento verrà rilevato e raddrizzato automaticamente
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
                                        {pages.length > 0 ? 'Aggiungi Pagina' : 'Apri Fotocamera'}
                                    </Button>
                                </div>
                            </div>

                            {/* Show existing pages preview if any */}
                            {pages.length > 0 && (
                                <div className="mt-4">
                                    <Button 
                                        variant="outline" 
                                        className="w-full"
                                        onClick={() => setStep('pages')}
                                    >
                                        <FileText className="mr-2 h-4 w-4" />
                                        Vedi {pages.length} {pages.length === 1 ? 'pagina' : 'pagine'} acquisite
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Crop/Preview step */}
                    {step === 'crop' && processedImage && !isLoading && (
                        <div className="space-y-4">
                            <div className="relative aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                                <img
                                    src={processedImage}
                                    alt="Documento elaborato"
                                    className="w-full h-full object-contain"
                                />
                                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                    <Wand2 className="h-3 w-3" />
                                    Auto-raddrizzato
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={handleRetake}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Riprova
                                </Button>
                                <Button variant="outline" onClick={handleUseOriginal}>
                                    Usa Originale
                                </Button>
                                <Button className="flex-1" onClick={handleAcceptCrop}>
                                    <Check className="mr-2 h-4 w-4" />
                                    Conferma
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Pages list step */}
                    {step === 'pages' && !isLoading && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                {pages.map((page, index) => (
                                    <div
                                        key={page.id}
                                        draggable
                                        onDragStart={() => handleDragStart(page.id)}
                                        onDragOver={(e) => handleDragOver(e, page.id)}
                                        onDragEnd={handleDragEnd}
                                        className={`relative aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden cursor-move group ${
                                            draggedPage === page.id ? 'opacity-50' : ''
                                        }`}
                                    >
                                        <img
                                            src={page.processedImage}
                                            alt={`Pagina ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded">
                                            {index + 1}
                                        </div>
                                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                            <Button
                                                variant="destructive"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => handleRemovePage(page.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <GripVertical className="h-4 w-4 text-white drop-shadow" />
                                        </div>
                                    </div>
                                ))}
                                
                                {/* Add page button */}
                                <button
                                    onClick={handleAddPage}
                                    className="aspect-[3/4] border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:text-slate-600 hover:border-slate-400 dark:hover:text-slate-300 dark:hover:border-slate-500 transition-colors"
                                >
                                    <Plus className="h-8 w-8 mb-1" />
                                    <span className="text-xs">Aggiungi</span>
                                </button>
                            </div>

                            <p className="text-xs text-slate-500 text-center">
                                Trascina le pagine per riordinarle
                            </p>

                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={handleClose}>
                                    Annulla
                                </Button>
                                <Button 
                                    className="flex-1" 
                                    onClick={handleGeneratePDF}
                                    disabled={pages.length === 0}
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Genera PDF
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Generating step */}
                    {step === 'generating' && (
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
