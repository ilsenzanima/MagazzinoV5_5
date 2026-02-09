"use client"

import { notify } from "@/lib/notify";
import { useState, useRef, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, RotateCcw, Check, Loader2, Plus, Trash2, FileText, GripVertical, RotateCw, Crop } from "lucide-react"
import { jsPDF } from "jspdf"

interface DocumentScannerProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onScanComplete: (pdfBlob: Blob) => void
}

interface ScannedPage {
    id: string
    processedImage: string
}

interface CropArea {
    x: number
    y: number
    width: number
    height: number
}

type ScannerStep = 'capture' | 'crop' | 'preview' | 'pages' | 'generating'

export function DocumentScanner({ open, onOpenChange, onScanComplete }: DocumentScannerProps) {
    const [step, setStep] = useState<ScannerStep>('capture')
    const [currentImage, setCurrentImage] = useState<string | null>(null)
    const [imageSize, setImageSize] = useState({ width: 0, height: 0, displayWidth: 0, displayHeight: 0 })
    const [crop, setCrop] = useState<CropArea>({ x: 0, y: 0, width: 0, height: 0 })
    const [isDragging, setIsDragging] = useState<string | null>(null)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [processedImage, setProcessedImage] = useState<string | null>(null)
    const [pages, setPages] = useState<ScannedPage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [rotation, setRotation] = useState(0)
    const [draggedPage, setDraggedPage] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const imageContainerRef = useRef<HTMLDivElement>(null)

    // Initialize crop area to 80% of image
    const initializeCrop = useCallback((displayWidth: number, displayHeight: number) => {
        const marginX = displayWidth * 0.1
        const marginY = displayHeight * 0.1
        setCrop({
            x: marginX,
            y: marginY,
            width: displayWidth - marginX * 2,
            height: displayHeight - marginY * 2
        })
    }, [])

    const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const imageData = event.target?.result as string
            setCurrentImage(imageData)

            const img = new Image()
            img.onload = () => {
                setImageSize({ width: img.width, height: img.height, displayWidth: 0, displayHeight: 0 })
            }
            img.src = imageData
            setStep('crop')
        }
        reader.readAsDataURL(file)
    }, [])

    // Set crop when image is displayed
    useEffect(() => {
        if (step === 'crop' && imageContainerRef.current && currentImage) {
            const updateDimensions = () => {
                const container = imageContainerRef.current
                const imgElement = container?.querySelector('img')
                if (imgElement && imgElement.complete) {
                    const rect = imgElement.getBoundingClientRect()
                    const displayWidth = rect.width
                    const displayHeight = rect.height

                    if (displayWidth > 0 && displayHeight > 0) {
                        setImageSize(prev => ({ ...prev, displayWidth, displayHeight }))
                        if (crop.width === 0) {
                            initializeCrop(displayWidth, displayHeight)
                        }
                    }
                }
            }

            // Try immediately and after a short delay
            updateDimensions()
            const timer = setTimeout(updateDimensions, 100)
            return () => clearTimeout(timer)
        }
    }, [step, currentImage, crop.width, initializeCrop])

    const handlePointerDown = useCallback((e: React.PointerEvent, handle: string) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(handle)
        setDragStart({ x: e.clientX, y: e.clientY })
    }, [])

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!isDragging) return

        const dx = e.clientX - dragStart.x
        const dy = e.clientY - dragStart.y
        setDragStart({ x: e.clientX, y: e.clientY })

        setCrop(prev => {
            let { x, y, width, height } = prev
            const minSize = 50

            switch (isDragging) {
                case 'move':
                    x = Math.max(0, Math.min(imageSize.displayWidth - width, x + dx))
                    y = Math.max(0, Math.min(imageSize.displayHeight - height, y + dy))
                    break
                case 'nw':
                    if (width - dx >= minSize && x + dx >= 0) { x += dx; width -= dx }
                    if (height - dy >= minSize && y + dy >= 0) { y += dy; height -= dy }
                    break
                case 'ne':
                    if (width + dx >= minSize && x + width + dx <= imageSize.displayWidth) { width += dx }
                    if (height - dy >= minSize && y + dy >= 0) { y += dy; height -= dy }
                    break
                case 'sw':
                    if (width - dx >= minSize && x + dx >= 0) { x += dx; width -= dx }
                    if (height + dy >= minSize && y + height + dy <= imageSize.displayHeight) { height += dy }
                    break
                case 'se':
                    if (width + dx >= minSize && x + width + dx <= imageSize.displayWidth) { width += dx }
                    if (height + dy >= minSize && y + height + dy <= imageSize.displayHeight) { height += dy }
                    break
                case 'n':
                    if (height - dy >= minSize && y + dy >= 0) { y += dy; height -= dy }
                    break
                case 's':
                    if (height + dy >= minSize && y + height + dy <= imageSize.displayHeight) { height += dy }
                    break
                case 'w':
                    if (width - dx >= minSize && x + dx >= 0) { x += dx; width -= dx }
                    break
                case 'e':
                    if (width + dx >= minSize && x + width + dx <= imageSize.displayWidth) { width += dx }
                    break
            }

            return { x, y, width, height }
        })
    }, [isDragging, dragStart, imageSize.displayWidth, imageSize.displayHeight])

    const handlePointerUp = useCallback(() => {
        setIsDragging(null)
    }, [])

    const handleRetake = useCallback(() => {
        setCurrentImage(null)
        setProcessedImage(null)
        setCrop({ x: 0, y: 0, width: 0, height: 0 })
        setRotation(0)
        setStep('capture')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleApplyCrop = useCallback(async () => {
        if (!currentImage || crop.width === 0) return

        setIsLoading(true)
        try {
            const img = new Image()
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve()
                img.onerror = reject
                img.src = currentImage
            })

            // Scale crop coordinates to original image size
            const scaleX = imageSize.width / imageSize.displayWidth
            const scaleY = imageSize.height / imageSize.displayHeight

            const srcX = crop.x * scaleX
            const srcY = crop.y * scaleY
            const srcWidth = crop.width * scaleX
            const srcHeight = crop.height * scaleY

            // Create cropped image
            const canvas = document.createElement('canvas')
            canvas.width = srcWidth
            canvas.height = srcHeight
            const ctx = canvas.getContext('2d')

            if (!ctx) throw new Error('No canvas context')

            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, srcWidth, srcHeight)
            ctx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, srcWidth, srcHeight)

            setProcessedImage(canvas.toDataURL('image/jpeg', 0.92))
            setStep('preview')
        } catch (error) {
            console.error('Crop failed:', error)
            notify.error('Errore durante il ritaglio')
        } finally {
            setIsLoading(false)
        }
    }, [currentImage, crop, imageSize])

    const handleRotate = useCallback(() => {
        setRotation((prev) => (prev + 90) % 360)
    }, [])

    const handleAcceptImage = useCallback(async () => {
        if (!processedImage) return

        setIsLoading(true)
        try {
            let finalImage = processedImage

            // Apply rotation if needed
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

                        finalImage = canvas.toDataURL('image/jpeg', 0.92)
                        resolve()
                    }
                    img.onerror = reject
                    img.src = processedImage
                })
            }

            const newPage: ScannedPage = {
                id: `page-${Date.now()}`,
                processedImage: finalImage
            }

            setPages(prev => [...prev, newPage])
            setCurrentImage(null)
            setProcessedImage(null)
            setCrop({ x: 0, y: 0, width: 0, height: 0 })
            setRotation(0)
            setStep('pages')

            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        } finally {
            setIsLoading(false)
        }
    }, [processedImage, rotation])

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

                        let finalWidth: number, finalHeight: number

                        // Fill the entire page - no white margins
                        // If image is wider than PDF ratio, scale to fit width
                        // If image is taller than PDF ratio, scale to fit height
                        if (imgRatio > pdfRatio) {
                            // Image is wider: fit to width, may extend beyond height
                            finalWidth = pdfWidth
                            finalHeight = pdfWidth / imgRatio
                        } else {
                            // Image is taller: fit to height, may extend beyond width
                            finalHeight = pdfHeight
                            finalWidth = pdfHeight * imgRatio
                        }

                        // Start at top-left corner (0,0) - no centering offset
                        pdf.addImage(pages[i].processedImage, 'JPEG', 0, 0, finalWidth, finalHeight)
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
            setCrop({ x: 0, y: 0, width: 0, height: 0 })
            setRotation(0)
            setStep('capture')
            onOpenChange(false)

        } catch (error) {
            console.error('PDF generation failed:', error)
            notify.error('Errore nella generazione del PDF')
            setStep('pages')
        } finally {
            setIsLoading(false)
        }
    }, [pages, onScanComplete, onOpenChange])

    const handleClose = () => {
        setCurrentImage(null)
        setProcessedImage(null)
        setCrop({ x: 0, y: 0, width: 0, height: 0 })
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
                    {/* Capture step */}
                    {step === 'capture' && (
                        <div className="text-center py-8">
                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 bg-slate-50 dark:bg-slate-800">
                                <Camera className="h-12 w-12 mx-auto mb-4 text-slate-400" />
                                <p className="text-slate-600 dark:text-slate-400 mb-2">
                                    Scatta una foto del documento
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-500 mb-4">
                                    Cerca di fotografare il documento il più dritto possibile
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

                    {/* Crop step */}
                    {step === 'crop' && currentImage && (
                        <div className="space-y-4">
                            <div
                                ref={imageContainerRef}
                                className="relative bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden touch-none select-none"
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                            >
                                <img
                                    src={currentImage}
                                    alt="Documento"
                                    className="w-full block"
                                    draggable={false}
                                />

                                {/* Dark overlay outside crop area */}
                                {crop.width > 0 && imageSize.displayWidth > 0 && (
                                    <>
                                        {/* Top overlay */}
                                        <div
                                            className="absolute bg-black/50 left-0 right-0 top-0"
                                            style={{ height: crop.y }}
                                        />
                                        {/* Bottom overlay */}
                                        <div
                                            className="absolute bg-black/50 left-0 right-0 bottom-0"
                                            style={{ height: imageSize.displayHeight - crop.y - crop.height }}
                                        />
                                        {/* Left overlay */}
                                        <div
                                            className="absolute bg-black/50 left-0"
                                            style={{
                                                top: crop.y,
                                                width: crop.x,
                                                height: crop.height
                                            }}
                                        />
                                        {/* Right overlay */}
                                        <div
                                            className="absolute bg-black/50 right-0"
                                            style={{
                                                top: crop.y,
                                                width: imageSize.displayWidth - crop.x - crop.width,
                                                height: crop.height
                                            }}
                                        />

                                        {/* Crop rectangle border */}
                                        <div
                                            className="absolute border-2 border-blue-500 cursor-move"
                                            style={{
                                                left: crop.x,
                                                top: crop.y,
                                                width: crop.width,
                                                height: crop.height
                                            }}
                                            onPointerDown={(e) => handlePointerDown(e, 'move')}
                                        >
                                            {/* Corner handles */}
                                            {['nw', 'ne', 'sw', 'se'].map(corner => (
                                                <div
                                                    key={corner}
                                                    className={`absolute w-4 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-${corner}-resize touch-none`}
                                                    style={{
                                                        ...(corner.includes('n') ? { top: -8 } : { bottom: -8 }),
                                                        ...(corner.includes('w') ? { left: -8 } : { right: -8 })
                                                    }}
                                                    onPointerDown={(e) => handlePointerDown(e, corner)}
                                                />
                                            ))}

                                            {/* Edge handles */}
                                            <div
                                                className="absolute w-8 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-n-resize left-1/2 -translate-x-1/2 -top-2 touch-none"
                                                onPointerDown={(e) => handlePointerDown(e, 'n')}
                                            />
                                            <div
                                                className="absolute w-8 h-4 bg-blue-500 border-2 border-white rounded-sm cursor-s-resize left-1/2 -translate-x-1/2 -bottom-2 touch-none"
                                                onPointerDown={(e) => handlePointerDown(e, 's')}
                                            />
                                            <div
                                                className="absolute w-4 h-8 bg-blue-500 border-2 border-white rounded-sm cursor-w-resize top-1/2 -translate-y-1/2 -left-2 touch-none"
                                                onPointerDown={(e) => handlePointerDown(e, 'w')}
                                            />
                                            <div
                                                className="absolute w-4 h-8 bg-blue-500 border-2 border-white rounded-sm cursor-e-resize top-1/2 -translate-y-1/2 -right-2 touch-none"
                                                onPointerDown={(e) => handlePointerDown(e, 'e')}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                                <Crop className="h-4 w-4" />
                                Trascina per ritagliare l&apos;area desiderata
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={handleRetake}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Riprova
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleApplyCrop}
                                    disabled={isLoading || crop.width === 0}
                                >
                                    {isLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="mr-2 h-4 w-4" />
                                    )}
                                    Ritaglia
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Preview step */}
                    {step === 'preview' && processedImage && (
                        <div className="space-y-4">
                            <div className="relative bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                                <img
                                    src={processedImage}
                                    alt="Documento ritagliato"
                                    className="w-full max-h-[50vh] object-contain mx-auto"
                                    style={{ transform: `rotate(${rotation}deg)` }}
                                />
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" size="icon" onClick={handleRotate} title="Ruota 90°">
                                    <RotateCw className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" className="flex-1" onClick={handleRetake}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Riprova
                                </Button>
                                <Button className="flex-1" onClick={handleAcceptImage} disabled={isLoading}>
                                    {isLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="mr-2 h-4 w-4" />
                                    )}
                                    Conferma
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Pages list step */}
                    {step === 'pages' && (
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
