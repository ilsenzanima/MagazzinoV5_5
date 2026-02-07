"use client"

import { notify } from "@/lib/notify";
import { useState, useRef, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, RotateCcw, Check, Loader2, Plus, Trash2, FileText, GripVertical, Wand2, RotateCw } from "lucide-react"
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

type ScannerStep = 'capture' | 'processing' | 'preview' | 'pages' | 'generating'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OpenCV = any

declare global {
    interface Window {
        cv: OpenCV
        Module: {
            onRuntimeInitialized: () => void
        }
    }
}

let cvPromise: Promise<OpenCV> | null = null
let cvLoaded = false

// Load OpenCV from public folder
const loadOpenCV = (): Promise<OpenCV> => {
    if (cvLoaded && window.cv) {
        return Promise.resolve(window.cv)
    }

    if (cvPromise) return cvPromise

    cvPromise = new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.cv && window.cv.Mat) {
            cvLoaded = true
            resolve(window.cv)
            return
        }

        const script = document.createElement('script')
        script.src = '/opencv.js'
        script.async = true

        // OpenCV.js uses Module.onRuntimeInitialized
        window.Module = {
            onRuntimeInitialized: () => {
                cvLoaded = true
                resolve(window.cv)
            }
        }

        script.onerror = () => {
            cvPromise = null
            reject(new Error('Failed to load OpenCV.js'))
        }

        document.head.appendChild(script)

        // Timeout fallback
        setTimeout(() => {
            if (window.cv && window.cv.Mat) {
                cvLoaded = true
                resolve(window.cv)
            }
        }, 5000)
    })

    return cvPromise
}

// Find document corners using contour detection
function findDocumentCorners(cv: OpenCV, src: OpenCV): { x: number, y: number }[] | null {
    const gray = new cv.Mat()
    const blurred = new cv.Mat()
    const edges = new cv.Mat()
    const dilated = new cv.Mat()
    const contours = new cv.MatVector()
    const hierarchy = new cv.Mat()

    try {
        // Convert to grayscale
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

        // Blur to reduce noise
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0)

        // Edge detection
        cv.Canny(blurred, edges, 75, 200)

        // Dilate edges to close gaps
        const kernel = cv.Mat.ones(3, 3, cv.CV_8U)
        cv.dilate(edges, dilated, kernel)
        kernel.delete()

        // Find contours
        cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

        // Find the largest quadrilateral contour
        let maxArea = 0
        let bestCorners: { x: number, y: number }[] | null = null

        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i)
            const area = cv.contourArea(contour)

            if (area > maxArea) {
                const peri = cv.arcLength(contour, true)
                const approx = new cv.Mat()
                cv.approxPolyDP(contour, approx, 0.02 * peri, true)

                // Check if it's a quadrilateral
                if (approx.rows === 4) {
                    maxArea = area

                    // Extract corners
                    const corners: { x: number, y: number }[] = []
                    for (let j = 0; j < 4; j++) {
                        corners.push({
                            x: approx.data32S[j * 2],
                            y: approx.data32S[j * 2 + 1]
                        })
                    }
                    bestCorners = corners
                }
                approx.delete()
            }
        }

        // Only use if area is significant (at least 10% of image)
        if (bestCorners && maxArea > (src.rows * src.cols * 0.1)) {
            // Sort corners: top-left, top-right, bottom-right, bottom-left
            bestCorners.sort((a, b) => a.y - b.y)
            const top = bestCorners.slice(0, 2).sort((a, b) => a.x - b.x)
            const bottom = bestCorners.slice(2, 4).sort((a, b) => a.x - b.x)
            return [top[0], top[1], bottom[1], bottom[0]]
        }

        return null
    } finally {
        gray.delete()
        blurred.delete()
        edges.delete()
        dilated.delete()
        contours.delete()
        hierarchy.delete()
    }
}

// Apply perspective correction
function applyPerspectiveCorrection(
    cv: OpenCV,
    src: OpenCV,
    corners: { x: number, y: number }[]
): OpenCV {
    // Calculate output dimensions
    const width = Math.max(
        Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y),
        Math.hypot(corners[2].x - corners[3].x, corners[2].y - corners[3].y)
    )
    const height = Math.max(
        Math.hypot(corners[3].x - corners[0].x, corners[3].y - corners[0].y),
        Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y)
    )

    // A4 aspect ratio adjustment
    const a4Ratio = 297 / 210
    let outWidth = Math.round(width)
    let outHeight = Math.round(height)

    if (outHeight / outWidth > a4Ratio) {
        outWidth = Math.round(outHeight / a4Ratio)
    } else {
        outHeight = Math.round(outWidth * a4Ratio)
    }

    // Source points (detected corners)
    const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
        corners[0].x, corners[0].y,
        corners[1].x, corners[1].y,
        corners[2].x, corners[2].y,
        corners[3].x, corners[3].y
    ])

    // Destination points (rectangle)
    const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        outWidth, 0,
        outWidth, outHeight,
        0, outHeight
    ])

    // Get perspective transform matrix
    const M = cv.getPerspectiveTransform(srcPoints, dstPoints)

    // Apply transformation
    const dst = new cv.Mat()
    cv.warpPerspective(src, dst, M, new cv.Size(outWidth, outHeight))

    // Cleanup
    srcPoints.delete()
    dstPoints.delete()
    M.delete()

    return dst
}

// Process image with OpenCV
async function processImageWithOpenCV(imageData: string): Promise<{ processed: string, wasProcessed: boolean }> {
    try {
        const cv = await loadOpenCV()

        return new Promise((resolve) => {
            const img = new Image()
            img.onload = () => {
                // Create canvas to load image
                const canvas = document.createElement('canvas')
                canvas.width = img.width
                canvas.height = img.height
                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    resolve({ processed: imageData, wasProcessed: false })
                    return
                }
                ctx.drawImage(img, 0, 0)

                try {
                    // Read image into OpenCV
                    const src = cv.imread(canvas)

                    // Try to find document corners
                    const corners = findDocumentCorners(cv, src)

                    if (corners) {
                        // Apply perspective correction
                        const result = applyPerspectiveCorrection(cv, src, corners)

                        // Convert result back to image
                        const outCanvas = document.createElement('canvas')
                        cv.imshow(outCanvas, result)

                        // Cleanup
                        src.delete()
                        result.delete()

                        resolve({ processed: outCanvas.toDataURL('image/jpeg', 0.9), wasProcessed: true })
                    } else {
                        // No document detected, use original
                        src.delete()
                        resolve({ processed: imageData, wasProcessed: false })
                    }
                } catch (error) {
                    console.error('OpenCV processing error:', error)
                    resolve({ processed: imageData, wasProcessed: false })
                }
            }
            img.onerror = () => resolve({ processed: imageData, wasProcessed: false })
            img.src = imageData
        })
    } catch (error) {
        console.error('Failed to load OpenCV:', error)
        return { processed: imageData, wasProcessed: false }
    }
}

export function DocumentScanner({ open, onOpenChange, onScanComplete }: DocumentScannerProps) {
    const [step, setStep] = useState<ScannerStep>('capture')
    const [currentImage, setCurrentImage] = useState<string | null>(null)
    const [processedImage, setProcessedImage] = useState<string | null>(null)
    const [wasAutoProcessed, setWasAutoProcessed] = useState(false)
    const [pages, setPages] = useState<ScannedPage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [loadingMessage, setLoadingMessage] = useState('')
    const [rotation, setRotation] = useState(0)
    const [draggedPage, setDraggedPage] = useState<string | null>(null)
    const [cvReady, setCvReady] = useState(false)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // Preload OpenCV when dialog opens
    useEffect(() => {
        if (open && !cvReady) {
            loadOpenCV()
                .then(() => setCvReady(true))
                .catch((err) => {
                    console.error('OpenCV preload failed:', err)
                    setCvReady(true) // Allow usage without auto-detection
                })
        }
    }, [open, cvReady])

    const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = async (event) => {
            const imageData = event.target?.result as string
            setCurrentImage(imageData)
            setRotation(0)
            setStep('processing')
            setIsLoading(true)
            setLoadingMessage('Rilevamento documento...')

            const { processed, wasProcessed } = await processImageWithOpenCV(imageData)
            setProcessedImage(processed)
            setWasAutoProcessed(wasProcessed)
            setStep('preview')
            setIsLoading(false)
            setLoadingMessage('')

            if (!wasProcessed) {
                notify.info('Documento non rilevato. Puoi usare l\'immagine originale.')
            }
        }
        reader.readAsDataURL(file)
    }, [])

    const handleRotate = useCallback(() => {
        setRotation((prev) => (prev + 90) % 360)
    }, [])

    const handleRetake = useCallback(() => {
        setCurrentImage(null)
        setProcessedImage(null)
        setWasAutoProcessed(false)
        setRotation(0)
        setStep('capture')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleUseOriginal = useCallback(() => {
        if (!currentImage) return
        setProcessedImage(currentImage)
        setWasAutoProcessed(false)
    }, [currentImage])

    const handleAcceptImage = useCallback(async () => {
        if (!processedImage) return

        setIsLoading(true)
        try {
            // Apply rotation if needed
            let finalImage = processedImage
            if (rotation !== 0) {
                const img = new Image()
                await new Promise<void>((resolve, reject) => {
                    img.onload = () => {
                        const canvas = document.createElement('canvas')
                        const ctx = canvas.getContext('2d')
                        if (!ctx) {
                            reject(new Error('No context'))
                            return
                        }

                        if (rotation === 90 || rotation === 270) {
                            canvas.width = img.height
                            canvas.height = img.width
                        } else {
                            canvas.width = img.width
                            canvas.height = img.height
                        }

                        ctx.translate(canvas.width / 2, canvas.height / 2)
                        ctx.rotate((rotation * Math.PI) / 180)
                        ctx.drawImage(img, -img.width / 2, -img.height / 2)

                        finalImage = canvas.toDataURL('image/jpeg', 0.9)
                        resolve()
                    }
                    img.onerror = reject
                    img.src = processedImage
                })
            }

            const newPage: ScannedPage = {
                id: `page-${Date.now()}`,
                originalImage: currentImage || processedImage,
                processedImage: finalImage
            }

            setPages(prev => [...prev, newPage])
            setCurrentImage(null)
            setProcessedImage(null)
            setWasAutoProcessed(false)
            setRotation(0)
            setStep('pages')

            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        } finally {
            setIsLoading(false)
        }
    }, [processedImage, currentImage, rotation])

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
        setIsLoading(true)
        setLoadingMessage('Generazione PDF...')

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

                        let finalWidth: number, finalHeight: number, offsetX = 0, offsetY = 0

                        if (imgRatio > pdfRatio) {
                            finalWidth = pdfWidth
                            finalHeight = pdfWidth / imgRatio
                            offsetY = (pdfHeight - finalHeight) / 2
                        } else {
                            finalHeight = pdfHeight
                            finalWidth = pdfHeight * imgRatio
                            offsetX = (pdfWidth - finalWidth) / 2
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
            setRotation(0)
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
        setRotation(0)
        setStep('capture')
        onOpenChange(false)
    }

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

                    {/* Preview step */}
                    {step === 'preview' && processedImage && !isLoading && (
                        <div className="space-y-4">
                            <div className="relative bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                                <img
                                    src={processedImage}
                                    alt="Documento elaborato"
                                    className="w-full max-h-[50vh] object-contain mx-auto"
                                    style={{ transform: `rotate(${rotation}deg)` }}
                                />
                                {wasAutoProcessed && (
                                    <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                        <Wand2 className="h-3 w-3" />
                                        Auto-raddrizzato
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="icon" onClick={handleRotate} title="Ruota 90°">
                                    <RotateCw className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" className="flex-1" onClick={handleRetake}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Riprova
                                </Button>
                                {wasAutoProcessed && (
                                    <Button variant="outline" onClick={handleUseOriginal}>
                                        Originale
                                    </Button>
                                )}
                                <Button className="flex-1" onClick={handleAcceptImage}>
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
                                        className={`relative aspect-[3/4] bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden cursor-move group ${draggedPage === page.id ? 'opacity-50' : ''
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
