"use client"

import { notify } from "@/lib/notify";
import { useState, useRef, useCallback, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Camera, RotateCcw, Check, Loader2, Plus, Trash2, FileText, GripVertical, RotateCw, Move } from "lucide-react"
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

interface Corner {
    x: number
    y: number
}

type ScannerStep = 'capture' | 'corners' | 'preview' | 'pages' | 'generating'

// Apply perspective transform using Canvas
function applyPerspectiveTransform(
    imageSrc: string,
    corners: Corner[],
    outputWidth: number,
    outputHeight: number
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
            // Create output canvas
            const canvas = document.createElement('canvas')
            canvas.width = outputWidth
            canvas.height = outputHeight
            const ctx = canvas.getContext('2d')

            if (!ctx) {
                reject(new Error('No canvas context'))
                return
            }

            // For perspective transform, we need to map each pixel
            // We'll use a simplified approach: divide into triangles and use drawImage with clipping

            // Scale corners to actual image size
            const scaleX = img.naturalWidth / img.width
            const scaleY = img.naturalHeight / img.height

            const srcCorners = corners.map(c => ({
                x: c.x * scaleX,
                y: c.y * scaleY
            }))

            // Destination corners (rectangle)
            const dstCorners = [
                { x: 0, y: 0 },
                { x: outputWidth, y: 0 },
                { x: outputWidth, y: outputHeight },
                { x: 0, y: outputHeight }
            ]

            // Use a grid-based approach for better quality
            const gridSize = 10
            const cellWidth = outputWidth / gridSize
            const cellHeight = outputHeight / gridSize

            ctx.fillStyle = 'white'
            ctx.fillRect(0, 0, outputWidth, outputHeight)

            for (let gy = 0; gy < gridSize; gy++) {
                for (let gx = 0; gx < gridSize; gx++) {
                    // Calculate source quad for this cell using bilinear interpolation
                    const u0 = gx / gridSize
                    const u1 = (gx + 1) / gridSize
                    const v0 = gy / gridSize
                    const v1 = (gy + 1) / gridSize

                    // Bilinear interpolation for source points
                    const getSrcPoint = (u: number, v: number) => {
                        const top = {
                            x: srcCorners[0].x + (srcCorners[1].x - srcCorners[0].x) * u,
                            y: srcCorners[0].y + (srcCorners[1].y - srcCorners[0].y) * u
                        }
                        const bottom = {
                            x: srcCorners[3].x + (srcCorners[2].x - srcCorners[3].x) * u,
                            y: srcCorners[3].y + (srcCorners[2].y - srcCorners[3].y) * u
                        }
                        return {
                            x: top.x + (bottom.x - top.x) * v,
                            y: top.y + (bottom.y - top.y) * v
                        }
                    }

                    const srcTL = getSrcPoint(u0, v0)
                    const srcTR = getSrcPoint(u1, v0)
                    const srcBL = getSrcPoint(u0, v1)
                    const srcBR = getSrcPoint(u1, v1)

                    // Destination rectangle for this cell
                    const dstX = gx * cellWidth
                    const dstY = gy * cellHeight

                    // Calculate the bounding box in source
                    const srcMinX = Math.min(srcTL.x, srcTR.x, srcBL.x, srcBR.x)
                    const srcMinY = Math.min(srcTL.y, srcTR.y, srcBL.y, srcBR.y)
                    const srcMaxX = Math.max(srcTL.x, srcTR.x, srcBL.x, srcBR.x)
                    const srcMaxY = Math.max(srcTL.y, srcTR.y, srcBL.y, srcBR.y)
                    const srcWidth = srcMaxX - srcMinX
                    const srcHeight = srcMaxY - srcMinY

                    // Draw the cell
                    if (srcWidth > 0 && srcHeight > 0) {
                        ctx.drawImage(
                            img,
                            srcMinX, srcMinY, srcWidth, srcHeight,
                            dstX, dstY, cellWidth, cellHeight
                        )
                    }
                }
            }

            resolve(canvas.toDataURL('image/jpeg', 0.9))
        }
        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = imageSrc
    })
}

export function DocumentScanner({ open, onOpenChange, onScanComplete }: DocumentScannerProps) {
    const [step, setStep] = useState<ScannerStep>('capture')
    const [currentImage, setCurrentImage] = useState<string | null>(null)
    const [imageSize, setImageSize] = useState({ width: 0, height: 0, displayWidth: 0, displayHeight: 0 })
    const [corners, setCorners] = useState<Corner[]>([])
    const [activeCorner, setActiveCorner] = useState<number | null>(null)
    const [zoomCorner, setZoomCorner] = useState<number | null>(null)
    const [processedImage, setProcessedImage] = useState<string | null>(null)
    const [pages, setPages] = useState<ScannedPage[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [rotation, setRotation] = useState(0)
    const [draggedPage, setDraggedPage] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)
    const imageContainerRef = useRef<HTMLDivElement>(null)

    // Initialize corners when image loads
    const initializeCorners = useCallback((width: number, height: number) => {
        const margin = 0.1 // 10% margin from edges
        setCorners([
            { x: width * margin, y: height * margin },           // top-left
            { x: width * (1 - margin), y: height * margin },     // top-right
            { x: width * (1 - margin), y: height * (1 - margin) }, // bottom-right
            { x: width * margin, y: height * (1 - margin) }      // bottom-left
        ])
    }, [])

    const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const imageData = event.target?.result as string
            setCurrentImage(imageData)

            // Get image dimensions
            const img = new Image()
            img.onload = () => {
                setImageSize({ width: img.width, height: img.height, displayWidth: 0, displayHeight: 0 })
                // We'll set corners after the container renders
            }
            img.src = imageData

            setStep('corners')
        }
        reader.readAsDataURL(file)
    }, [])

    // Set corners when container is ready
    useEffect(() => {
        if (step === 'corners' && imageContainerRef.current && currentImage) {
            const container = imageContainerRef.current
            const imgElement = container.querySelector('img')
            if (imgElement) {
                const rect = imgElement.getBoundingClientRect()
                const containerRect = container.getBoundingClientRect()
                const displayWidth = rect.width
                const displayHeight = rect.height
                const offsetX = rect.left - containerRect.left
                const offsetY = rect.top - containerRect.top

                initializeCorners(displayWidth, displayHeight)
                // Store display dimensions for zoom
                setImageSize(prev => ({
                    ...prev,
                    displayWidth,
                    displayHeight
                }))
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, currentImage])

    const handleCornerDrag = useCallback((index: number, clientX: number, clientY: number) => {
        if (!imageContainerRef.current) return

        const container = imageContainerRef.current
        const imgElement = container.querySelector('img')
        if (!imgElement) return

        const rect = imgElement.getBoundingClientRect()

        // Calculate position relative to image
        let x = clientX - rect.left
        let y = clientY - rect.top

        // Clamp to image bounds
        x = Math.max(0, Math.min(rect.width, x))
        y = Math.max(0, Math.min(rect.height, y))

        setCorners(prev => {
            const newCorners = [...prev]
            newCorners[index] = { x, y }
            return newCorners
        })
    }, [])

    const handlePointerDown = useCallback((index: number) => {
        setActiveCorner(index)
        setZoomCorner(index)
    }, [])

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (activeCorner !== null) {
            handleCornerDrag(activeCorner, e.clientX, e.clientY)
        }
    }, [activeCorner, handleCornerDrag])

    const handlePointerUp = useCallback(() => {
        setActiveCorner(null)
        // Keep zoom visible for a moment
        setTimeout(() => setZoomCorner(null), 1000)
    }, [])

    const handleRetake = useCallback(() => {
        setCurrentImage(null)
        setProcessedImage(null)
        setCorners([])
        setRotation(0)
        setStep('capture')
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }, [])

    const handleApplyTransform = useCallback(async () => {
        if (!currentImage || corners.length !== 4) return

        setIsLoading(true)
        try {
            // Get the image element to calculate scale
            const imgElement = imageContainerRef.current?.querySelector('img')
            if (!imgElement) throw new Error('No image element')

            const displayRect = imgElement.getBoundingClientRect()
            const scaleX = imageSize.width / displayRect.width
            const scaleY = imageSize.height / displayRect.height

            // Scale corners to original image size
            const scaledCorners = corners.map(c => ({
                x: c.x * scaleX,
                y: c.y * scaleY
            }))

            // Calculate output size based on actual quad proportions (not forced A4)
            // Calculate the width and height of the selected quad
            const topWidth = Math.hypot(
                scaledCorners[1].x - scaledCorners[0].x,
                scaledCorners[1].y - scaledCorners[0].y
            )
            const bottomWidth = Math.hypot(
                scaledCorners[2].x - scaledCorners[3].x,
                scaledCorners[2].y - scaledCorners[3].y
            )
            const leftHeight = Math.hypot(
                scaledCorners[3].x - scaledCorners[0].x,
                scaledCorners[3].y - scaledCorners[0].y
            )
            const rightHeight = Math.hypot(
                scaledCorners[2].x - scaledCorners[1].x,
                scaledCorners[2].y - scaledCorners[1].y
            )

            const avgWidth = (topWidth + bottomWidth) / 2
            const avgHeight = (leftHeight + rightHeight) / 2

            // Scale to a reasonable output size while preserving aspect ratio
            const maxDimension = 1600
            const scale = maxDimension / Math.max(avgWidth, avgHeight)
            const outputWidth = Math.round(avgWidth * scale)
            const outputHeight = Math.round(avgHeight * scale)

            const processed = await applyPerspectiveTransform(
                currentImage,
                scaledCorners,
                outputWidth,
                outputHeight
            )

            setProcessedImage(processed)
            setStep('preview')
        } catch (error) {
            console.error('Transform failed:', error)
            notify.error('Errore durante la trasformazione')
        } finally {
            setIsLoading(false)
        }
    }, [currentImage, corners, imageSize])

    const handleRotate = useCallback(() => {
        setRotation((prev) => (prev + 90) % 360)
    }, [])

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
            setCorners([])
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
            setCorners([])
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
        setCorners([])
        setPages([])
        setRotation(0)
        setStep('capture')
        onOpenChange(false)
    }

    // Corner labels
    const cornerLabels = ['TL', 'TR', 'BR', 'BL']

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
                                    Potrai selezionare i 4 angoli per raddrizzarlo
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

                    {/* Corner selection step */}
                    {step === 'corners' && currentImage && (
                        <div className="space-y-4">
                            <div
                                ref={imageContainerRef}
                                className="relative bg-slate-100 dark:bg-slate-800 rounded-lg overflow-hidden touch-none"
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                            >
                                <img
                                    src={currentImage}
                                    alt="Documento"
                                    className="w-full max-h-[50vh] object-contain mx-auto"
                                    draggable={false}
                                />

                                {/* Overlay with quad shape */}
                                {corners.length === 4 && (
                                    <svg
                                        className="absolute inset-0 w-full h-full pointer-events-none"
                                        style={{ position: 'absolute', top: 0, left: 0 }}
                                    >
                                        {/* Get image position within container */}
                                        <defs>
                                            <mask id="quadMask">
                                                <rect width="100%" height="100%" fill="white" />
                                                <polygon
                                                    points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                                                    fill="black"
                                                />
                                            </mask>
                                        </defs>
                                        {/* Semi-transparent overlay outside quad */}
                                        <rect
                                            width="100%"
                                            height="100%"
                                            fill="rgba(0,0,0,0.5)"
                                            mask="url(#quadMask)"
                                        />
                                        {/* Quad border */}
                                        <polygon
                                            points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                                            fill="none"
                                            stroke="#3b82f6"
                                            strokeWidth="2"
                                        />
                                        {/* Edge lines */}
                                        {corners.map((corner, i) => {
                                            const next = corners[(i + 1) % 4]
                                            return (
                                                <line
                                                    key={i}
                                                    x1={corner.x}
                                                    y1={corner.y}
                                                    x2={next.x}
                                                    y2={next.y}
                                                    stroke="#3b82f6"
                                                    strokeWidth="2"
                                                    strokeDasharray="5,5"
                                                />
                                            )
                                        })}
                                    </svg>
                                )}

                                {/* Corner handles */}
                                {corners.map((corner, index) => (
                                    <div
                                        key={index}
                                        className={`absolute w-8 h-8 -ml-4 -mt-4 cursor-move touch-none
                                            ${activeCorner === index ? 'z-20' : 'z-10'}`}
                                        style={{
                                            left: corner.x,
                                            top: corner.y,
                                        }}
                                        onPointerDown={(e) => {
                                            e.preventDefault()
                                            handlePointerDown(index)
                                        }}
                                    >
                                        {/* Handle visual */}
                                        <div className={`w-8 h-8 rounded-full border-4 border-blue-500 bg-white shadow-lg
                                            flex items-center justify-center text-xs font-bold text-blue-600
                                            ${activeCorner === index ? 'ring-4 ring-blue-300' : ''}`}>
                                            {cornerLabels[index]}
                                        </div>
                                    </div>
                                ))}

                                {/* Zoom window */}
                                {zoomCorner !== null && corners[zoomCorner] && currentImage && (
                                    <div className="absolute top-2 right-2 w-32 h-32 border-2 border-blue-500 rounded-lg overflow-hidden bg-white shadow-xl z-30">
                                        <div
                                            className="w-full h-full"
                                            style={{
                                                backgroundImage: `url(${currentImage})`,
                                                backgroundSize: `${imageSize.displayWidth * 3}px ${imageSize.displayHeight * 3}px`,
                                                backgroundPosition: `${-corners[zoomCorner].x * 3 + 64}px ${-corners[zoomCorner].y * 3 + 64}px`,
                                            }}
                                        />
                                        {/* Crosshair */}
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-px h-full bg-red-500 opacity-50" />
                                            <div className="absolute w-full h-px bg-red-500 opacity-50" />
                                            <div className="absolute w-3 h-3 border-2 border-red-500 rounded-full" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                                <Move className="h-4 w-4" />
                                Trascina i cerchi sui 4 angoli del documento
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={handleRetake}>
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Riprova
                                </Button>
                                <Button
                                    className="flex-1"
                                    onClick={handleApplyTransform}
                                    disabled={isLoading || corners.length !== 4}
                                >
                                    {isLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="mr-2 h-4 w-4" />
                                    )}
                                    Applica
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
                                    alt="Documento elaborato"
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
