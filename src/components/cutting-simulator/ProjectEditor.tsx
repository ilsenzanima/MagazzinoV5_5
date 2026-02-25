"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import type { DuctProject, Segment, StraightSegment, Elbow90Segment, Annotation } from "@/lib/cutting-simulator/project-model";
import {
    computeLayout,
    projectTo2D,
    computeBBox,
    type ViewType,
    type SegmentNode2D,
} from "@/lib/cutting-simulator/project-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Eye, Move, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
    X, Trash2, Plus, CornerDownRight, RectangleHorizontal, Type, Ruler, MousePointer2, Hand
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    createStraightSegment,
    createElbow90Segment,
    type SegmentDirection,
} from "@/lib/cutting-simulator/project-model";

// ==================== VISTA LABELS ====================

const VIEW_LABELS: Record<string, string> = {
    top: 'Dall\'Alto',
    side: 'Laterale',
    iso: '3D',
};

const SIDE_FACES = ['front', 'right', 'back', 'left'] as const;
type SideFaceType = typeof SIDE_FACES[number];

const VIEW_ICONS: Record<string, typeof Eye> = {
    top: Eye,
    side: Eye,
    iso: Eye,
};

// ==================== GRIGLIA CAD ====================

function CadGrid({ bbox, gridSize }: { bbox: { minX: number; minY: number; maxX: number; maxY: number }; gridSize: number }) {
    const lines: React.ReactNode[] = [];
    const startX = Math.floor(bbox.minX / gridSize) * gridSize;
    const endX = Math.ceil(bbox.maxX / gridSize) * gridSize;
    const startY = Math.floor(bbox.minY / gridSize) * gridSize;
    const endY = Math.ceil(bbox.maxY / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
        const isMajor = x % (gridSize * 5) === 0;
        lines.push(
            <line
                key={`gx-${x}`}
                x1={x} y1={startY} x2={x} y2={endY}
                stroke="hsl(var(--foreground) / 0.06)"
                strokeWidth={isMajor ? 1 : 0.5}
            />
        );
    }
    for (let y = startY; y <= endY; y += gridSize) {
        const isMajor = y % (gridSize * 5) === 0;
        lines.push(
            <line
                key={`gy-${y}`}
                x1={startX} y1={y} x2={endX} y2={y}
                stroke="hsl(var(--foreground) / 0.06)"
                strokeWidth={isMajor ? 1 : 0.5}
            />
        );
    }

    return <g className="cad-grid">{lines}</g>;
}

// ==================== QUOTA (DIMENSION) ====================

function DimensionLine({ x1, y1, x2, y2, label, offset = 30, isSelected = false, fScale = 1 }: {
    x1: number; y1: number; x2: number; y2: number; label: string; offset?: number; isSelected?: boolean; fScale?: number;
}) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 10) return null;

    // Perpendicular offset
    const nx = -dy / len * offset * fScale;
    const ny = dx / len * offset * fScale;

    const ax = x1 + nx, ay = y1 + ny;
    const bx = x2 + nx, by = y2 + ny;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;

    const color = isSelected ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.6)";
    const extColor = isSelected ? "hsl(var(--primary) / 0.6)" : "hsl(var(--primary) / 0.4)";

    return (
        <g className="dimension-line">
            {/* Extension lines */}
            <line x1={x1} y1={y1} x2={ax} y2={ay} stroke={extColor} strokeWidth={0.5 * fScale} />
            <line x1={x2} y1={y2} x2={bx} y2={by} stroke={extColor} strokeWidth={0.5 * fScale} />
            {/* Dimension line */}
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke={color} strokeWidth={(isSelected ? 2 : 1.2) * fScale} markerStart="url(#arrow-start)" markerEnd="url(#arrow-end)" />
            {/* Label - font ingrandito per visibilità */}
            <text
                x={mx} y={my - 6 * fScale}
                textAnchor="middle"
                className="fill-primary font-mono font-bold font-sans"
                style={{ fontSize: `${14 * fScale}px`, paintOrder: 'stroke', stroke: 'hsl(var(--background))', strokeWidth: 4 * fScale, strokeLinejoin: 'round' }}
            >
                {label}
            </text>
        </g>
    );
}

// ==================== PANNELLO PROPRIETÀ ANNOTAZIONI ====================

function AnnotationPanel({
    annotation,
    onUpdate,
    onRemove,
    onClose,
}: {
    annotation: Annotation;
    onUpdate: (patch: Partial<Annotation>) => void;
    onRemove: () => void;
    onClose: () => void;
}) {
    return (
        <div className="absolute right-2 top-2 w-64 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 z-10 space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                    {annotation.type === 'note' ? '📝 Nota Testuale' : '📏 Quota Manuale'}
                </h4>
                <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
            <div className="space-y-2">
                <div>
                    <Label className="text-[10px] uppercase text-muted-foreground">Testo (opzionale)</Label>
                    <Input
                        value={annotation.text}
                        onChange={e => onUpdate({ text: e.target.value })}
                        placeholder={annotation.type === 'dimension' ? 'Auto...' : 'Scrivi qualcosa'}
                        className="h-8 text-sm"
                    />
                </div>
            </div>
            <div className="flex pt-2 border-t border-border/50">
                <Button
                    variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs w-full"
                    onClick={() => { onRemove(); onClose(); }}
                >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Elimina
                </Button>
            </div>
        </div>
    );
}

// ==================== PANNELLO PROPRIETÀ SEGMENTI ====================

function PropertiesPanel({
    segment,
    index,
    total,
    onUpdate,
    onRemove,
    onInsertAfter,
    onClose,
}: {
    segment: Segment;
    index: number;
    total: number;
    onUpdate: (index: number, patch: Partial<StraightSegment> | Partial<Elbow90Segment>) => void;
    onRemove: (index: number) => void;
    onInsertAfter: (index: number, type: 'straight' | 'elbow90') => void;
    onClose: () => void;
}) {
    return (
        <div className="absolute right-2 top-2 w-64 bg-background/95 backdrop-blur-sm border border-border rounded-lg shadow-lg p-3 z-10 space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                    {segment.type === 'straight' ? '📏 Tratto Dritto' : '↱ Angolo 90°'}
                    <span className="text-muted-foreground font-normal ml-1">#{index + 1}</span>
                </h4>
                <button onClick={onClose} className="p-1 hover:bg-muted rounded">
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            {segment.type === 'straight' ? (
                <div className="space-y-2">
                    <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Lunghezza (mm)</Label>
                        <Input
                            type="number"
                            min={50}
                            value={segment.length}
                            onChange={e => onUpdate(index, { length: Number(e.target.value) })}
                            className="h-8 text-sm"
                        />
                    </div>
                    <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Etichetta</Label>
                        <Input
                            value={segment.label || ''}
                            onChange={e => onUpdate(index, { label: e.target.value || undefined })}
                            placeholder="opzionale"
                            className="h-8 text-sm"
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label className="text-[10px] uppercase text-muted-foreground">Braccio A</Label>
                            <Input
                                type="number"
                                min={0}
                                value={(segment as Elbow90Segment).armA}
                                onChange={e => onUpdate(index, { armA: Number(e.target.value) })}
                                className="h-8 text-sm"
                            />
                        </div>
                        <div>
                            <Label className="text-[10px] uppercase text-muted-foreground">Braccio B</Label>
                            <Input
                                type="number"
                                min={0}
                                value={(segment as Elbow90Segment).armB}
                                onChange={e => onUpdate(index, { armB: Number(e.target.value) })}
                                className="h-8 text-sm"
                            />
                        </div>
                    </div>
                    <div>
                        <Label className="text-[10px] uppercase text-muted-foreground">Direzione</Label>
                        <div className="grid grid-cols-4 gap-1 mt-1">
                            {(['left', 'right', 'up', 'down'] as SegmentDirection[]).map(d => {
                                const Icon = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown }[d];
                                return (
                                    <button
                                        key={d}
                                        onClick={() => onUpdate(index, { direction: d })}
                                        className={cn(
                                            "p-1.5 rounded text-xs flex items-center justify-center",
                                            (segment as Elbow90Segment).direction === d
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted/50 hover:bg-muted"
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Azioni */}
            <div className="flex gap-1 pt-2 border-t border-border/50">
                <Button
                    variant="outline" size="sm" className="gap-1 text-xs flex-1"
                    onClick={() => onInsertAfter(index, 'straight')}
                >
                    <Plus className="h-3 w-3" /><RectangleHorizontal className="h-3 w-3" />
                </Button>
                <Button
                    variant="outline" size="sm" className="gap-1 text-xs flex-1"
                    onClick={() => onInsertAfter(index, 'elbow90')}
                >
                    <Plus className="h-3 w-3" /><CornerDownRight className="h-3 w-3" />
                </Button>
                {total > 1 && (
                    <Button
                        variant="ghost" size="sm" className="text-destructive hover:text-destructive text-xs"
                        onClick={() => { onRemove(index); onClose(); }}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>
        </div>
    );
}

// ==================== EDITOR PRINCIPALE ====================

interface ProjectEditorProps {
    project: DuctProject;
    onProjectChange: (project: DuctProject) => void;
}

export function ProjectEditor({ project, onProjectChange }: ProjectEditorProps) {
    const [viewFamily, setViewFamily] = useState<'top' | 'side' | 'iso'>('iso');
    const [sideFace, setSideFace] = useState<SideFaceType>('front');

    const view: ViewType = viewFamily === 'side' ? sideFace : viewFamily;

    const [activeTool, setActiveTool] = useState<'select' | 'pan' | 'add_note' | 'add_dim'>('select');
    const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
    const [drawingDim, setDrawingDim] = useState<{ x: number; y: number } | null>(null);
    const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [draggingAnnId, setDraggingAnnId] = useState<string | null>(null);

    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [isPanning, setIsPanning] = useState(false);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isoAngle, setIsoAngle] = useState(0);
    const svgRef = useRef<SVGSVGElement>(null);
    const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

    // Layout 3D → Proiezione 2D
    const nodes3D = useMemo(() => computeLayout(project), [project]);
    const nodes2D = useMemo(() => projectTo2D(nodes3D, view, isoAngle), [nodes3D, view, isoAngle]);
    const bbox = useMemo(() => {
        const b = computeBBox(nodes2D);
        const pad = 200;
        return {
            minX: b.minX - pad,
            minY: b.minY - pad,
            maxX: b.maxX + pad,
            maxY: b.maxY + pad,
        };
    }, [nodes2D]);

    // ViewBox con pan e zoom
    const vbW = (bbox.maxX - bbox.minX) / zoom;
    const vbH = (bbox.maxY - bbox.minY) / zoom;
    const vbX = bbox.minX + (bbox.maxX - bbox.minX - vbW) / 2 - panOffset.x;
    const vbY = bbox.minY + (bbox.maxY - bbox.minY - vbH) / 2 - panOffset.y;
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Fattore di scala dinamico per rendering font/spessori uniformi rispetto allo zoom
    const fScale = Math.max(1, vbW / 800);

    // ==================== Handlers ====================

    // ==================== Handlers ====================

    const getSvgPoint = useCallback((e: React.MouseEvent | React.TouchEvent | any) => {
        if (!svgRef.current) return { x: 0, y: 0 };
        const pt = svgRef.current.createSVGPoint();
        if (e.clientX !== undefined) {
            pt.x = e.clientX;
            pt.y = e.clientY;
        } else if (e.touches && e.touches.length > 0) {
            pt.x = e.touches[0].clientX;
            pt.y = e.touches[0].clientY;
        }
        const ctm = svgRef.current.getScreenCTM();
        if (!ctm) return { x: 0, y: 0 };
        return pt.matrixTransform(ctm.inverse());
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.max(0.2, Math.min(5, z * factor)));
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (activeTool === 'pan' || e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            panStart.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
        }
    }, [panOffset, activeTool]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const pt = getSvgPoint(e);
        setMousePos(pt);

        if (isPanning && panStart.current && svgRef.current) {
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;

            const rect = svgRef.current.getBoundingClientRect();
            const realScale = Math.max(vbW / rect.width, vbH / rect.height);

            setPanOffset({
                x: panStart.current.ox + dx * realScale,
                y: panStart.current.oy + dy * realScale
            });
        } else if (draggingAnnId) {
            const anns = project.annotations || [];
            const idx = anns.findIndex(a => a.id === draggingAnnId);
            if (idx >= 0) {
                const ann = anns[idx];
                const newAnns = [...anns];
                if (ann.type === 'note') {
                    newAnns[idx] = { ...ann, x: pt.x, y: pt.y };
                    onProjectChange({ ...project, annotations: newAnns });
                }
            }
        }
    }, [isPanning, vbW, vbH, getSvgPoint, draggingAnnId, project, onProjectChange]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
        setDraggingAnnId(null);
        panStart.current = null;
    }, []);

    const handleSegmentClick = useCallback((idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeTool === 'select') {
            setSelectedIdx(prev => prev === idx ? null : idx);
            setSelectedAnnId(null);
        }
    }, [activeTool]);

    const handleCanvasClick = useCallback((e: React.MouseEvent) => {
        if (isPanning) return;
        setSelectedIdx(null);
        setSelectedAnnId(null);

        if (view === 'iso' || activeTool === 'pan') return;

        const pt = getSvgPoint(e);

        if (activeTool === 'add_note') {
            const newAnn: Annotation = {
                id: `ann-${Date.now()}`,
                type: 'note',
                text: 'Nuova Nota',
                x: Math.round(pt.x),
                y: Math.round(pt.y),
                viewId: viewFamily === 'side' ? sideFace : viewFamily
            };
            onProjectChange({ ...project, annotations: [...(project.annotations || []), newAnn] });
            setSelectedAnnId(newAnn.id);
            setActiveTool('select');
        } else if (activeTool === 'add_dim') {
            if (!drawingDim) {
                setDrawingDim({ x: Math.round(pt.x), y: Math.round(pt.y) });
            } else {
                // Snap ortogonale
                const dx = Math.abs(pt.x - drawingDim.x);
                const dy = Math.abs(pt.y - drawingDim.y);
                const x2 = dx > dy ? Math.round(pt.x) : drawingDim.x;
                const y2 = dx > dy ? drawingDim.y : Math.round(pt.y);

                const newAnn: Annotation = {
                    id: `ann-${Date.now()}`,
                    type: 'dimension',
                    text: '', // Lasciamo in bianco che significa "inserisci testo"
                    x: drawingDim.x,
                    y: drawingDim.y,
                    x2: x2,
                    y2: y2,
                    viewId: viewFamily === 'side' ? sideFace : viewFamily
                };
                onProjectChange({ ...project, annotations: [...(project.annotations || []), newAnn] });
                setDrawingDim(null);
                setSelectedAnnId(newAnn.id);
                setActiveTool('select');
            }
        }
    }, [isPanning, activeTool, drawingDim, getSvgPoint, onProjectChange, project, view, viewFamily, sideFace]);

    const handleUpdate = useCallback((idx: number, patch: Partial<StraightSegment> | Partial<Elbow90Segment>) => {
        const newSegments = [...project.segments];
        newSegments[idx] = { ...newSegments[idx], ...patch } as Segment;
        onProjectChange({ ...project, segments: newSegments });
    }, [project, onProjectChange]);

    const handleRemove = useCallback((idx: number) => {
        const newSegments = project.segments.filter((_, i) => i !== idx);
        onProjectChange({ ...project, segments: newSegments });
        setSelectedIdx(null);
    }, [project, onProjectChange]);

    const handleInsertAfter = useCallback((idx: number, type: 'straight' | 'elbow90') => {
        const newSeg = type === 'straight' ? createStraightSegment(1000) : createElbow90Segment('right');
        const newSegments = [...project.segments];
        newSegments.splice(idx + 1, 0, newSeg);
        onProjectChange({ ...project, segments: newSegments });
        setSelectedIdx(idx + 1);
    }, [project, onProjectChange]);

    const handleResetView = useCallback(() => {
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
    }, []);

    const selectedSegment = selectedIdx !== null ? project.segments[selectedIdx] : null;

    return (
        <div className="relative border border-border rounded-lg overflow-hidden bg-background">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-2 border-b border-border/50 bg-muted/30">
                {/* Selettore vista */}
                <div className="flex gap-1 p-0.5 bg-muted/50 rounded-md shrink-0">
                    {(['top', 'side', 'iso'] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => {
                                setViewFamily(v);
                                if (v === 'iso') {
                                    setActiveTool('select');
                                    setDrawingDim(null);
                                }
                            }}
                            className={cn(
                                "px-2.5 py-1 text-xs font-medium rounded transition-all",
                                viewFamily === v
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {VIEW_LABELS[v]}
                        </button>
                    ))}
                </div>

                <div className="w-px h-6 bg-border mx-1 shrink-0" />

                <div className="flex gap-1 p-0.5 bg-muted/50 rounded-md shrink-0">
                    <button
                        title="Seleziona"
                        onClick={() => { setActiveTool('select'); setDrawingDim(null); }}
                        className={cn("p-1.5 rounded transition-all flex items-center justify-center", activeTool === 'select' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                        <MousePointer2 className="h-4 w-4" />
                    </button>
                    <button
                        title="Sposta (Pan)"
                        onClick={() => { setActiveTool('pan'); setDrawingDim(null); }}
                        className={cn("p-1.5 rounded transition-all flex items-center justify-center", activeTool === 'pan' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                        <Hand className="h-4 w-4" />
                    </button>
                    {(view === 'top' || viewFamily === 'side') && (
                        <>
                            <button
                                title="Aggiungi Nota Testuale"
                                onClick={() => { setActiveTool('add_note'); setDrawingDim(null); setSelectedAnnId(null); setSelectedIdx(null); }}
                                className={cn("p-1.5 rounded transition-all flex items-center justify-center", activeTool === 'add_note' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                            >
                                <Type className="h-4 w-4" />
                            </button>
                            <button
                                title="Aggiungi Quota"
                                onClick={() => { setActiveTool('add_dim'); setDrawingDim(null); setSelectedAnnId(null); setSelectedIdx(null); }}
                                className={cn("p-1.5 rounded transition-all flex items-center justify-center", activeTool === 'add_dim' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                            >
                                <Ruler className="h-4 w-4" />
                            </button>
                        </>
                    )}
                </div>

                {viewFamily === 'side' && (
                    <div className="flex items-center gap-1 ml-2 mr-2 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => {
                            const idx = SIDE_FACES.indexOf(sideFace);
                            setSideFace(SIDE_FACES[(idx - 1 + 4) % 4]);
                        }}>
                            <ArrowLeft className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-[10px] uppercase font-semibold text-primary w-16 text-center">
                            {sideFace === 'front' ? 'Fronte' : sideFace === 'right' ? 'Destra' : sideFace === 'back' ? 'Retro' : 'Sinistra'}
                        </span>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => {
                            const idx = SIDE_FACES.indexOf(sideFace);
                            setSideFace(SIDE_FACES[(idx + 1) % 4]);
                        }}>
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                )}

                <div className="flex-1 min-w-[20px]" />

                {/* Zoom controls e Slider Rotazione */}
                {view === 'iso' && (
                    <div className="flex items-center gap-2 mr-2 shrink-0">
                        <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Rotazione Z: {isoAngle}°</Label>
                        <input
                            type="range"
                            min="0" max="360" step="15"
                            value={isoAngle}
                            onChange={e => setIsoAngle(Number(e.target.value))}
                            className="w-24 accent-primary"
                        />
                    </div>
                )}
                <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground font-mono w-10 text-right">{(zoom * 100).toFixed(0)}%</span>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoom(z => Math.min(5, z * 1.2))}>+</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoom(z => Math.max(0.2, z / 1.2))}>−</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleResetView}>
                        <Move className="h-3 w-3" /> Reset
                    </Button>
                </div>
            </div>

            {/* Canvas SVG */}
            <svg
                ref={svgRef}
                viewBox={`${vbX.toFixed(0)} ${vbY.toFixed(0)} ${vbW.toFixed(0)} ${vbH.toFixed(0)}`}
                className="w-full bg-background"
                style={{ height: 500, cursor: isPanning ? 'grabbing' : 'crosshair' }}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onClick={handleCanvasClick}
            >
                {/* Markers per frecce quote */}
                <defs>
                    <marker id="arrow-start" markerWidth="6" markerHeight="4" refX="0" refY="2" orient="auto">
                        <path d="M6,0 L0,2 L6,4" fill="hsl(var(--primary) / 0.6)" />
                    </marker>
                    <marker id="arrow-end" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                        <path d="M0,0 L6,2 L0,4" fill="hsl(var(--primary) / 0.6)" />
                    </marker>
                </defs>

                {/* Griglia CAD */}
                <CadGrid bbox={bbox} gridSize={100} />

                {/* Assi di riferimento */}
                <line x1={bbox.minX} y1={0} x2={bbox.maxX} y2={0}
                    stroke="hsl(var(--foreground) / 0.1)" strokeWidth={1} strokeDasharray="8,4" />
                <line x1={0} y1={bbox.minY} x2={0} y2={bbox.maxY}
                    stroke="hsl(var(--foreground) / 0.1)" strokeWidth={1} strokeDasharray="8,4" />

                {/* Segmenti */}
                {nodes2D.map((node, i) => {
                    const isSelected = selectedIdx === node.index;
                    return (
                        <g key={node.segment.id} onClick={e => handleSegmentClick(node.index, e)} style={{ cursor: 'pointer' }}>
                            {/* Corpo segmento */}
                            {node.polygons && node.polygons.length > 0 ? (
                                node.polygons.map((poly, pIdx) => (
                                    <polygon
                                        key={`poly-${i}-${pIdx}`}
                                        points={poly.points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                                        fill={isSelected ? `${node.color}60` : poly.fill}
                                        stroke={poly.stroke}
                                        strokeWidth={isSelected ? 2.5 : poly.strokeWidth}
                                        strokeLinejoin="round"
                                        strokeDasharray={poly.strokeDasharray}
                                    />
                                ))
                            ) : (
                                node.rects.map((r, rIdx) => (
                                    <rect
                                        key={rIdx}
                                        x={r.x}
                                        y={r.y}
                                        width={r.width}
                                        height={r.height}
                                        fill={isSelected ? `${node.color}40` : `${node.color}20`}
                                        stroke={node.color}
                                        strokeWidth={isSelected ? 2.5 : 1.5}
                                        rx={r.rx || 0}
                                    />
                                ))
                            )}

                            {/* Etichetta */}
                            <text
                                x={node.labelX}
                                y={node.labelY}
                                textAnchor="middle"
                                dominantBaseline="central"
                                className="fill-foreground font-mono pointer-events-none"
                                style={{ fontSize: `${11 * fScale}px`, paintOrder: 'stroke', stroke: 'hsl(var(--background))', strokeWidth: 4 * fScale, strokeLinejoin: 'round' }}
                            >
                                {node.label}
                            </text>

                            {/* Indice */}
                            <circle
                                cx={node.labelX + 16 * fScale} cy={node.labelY + 16 * fScale} r={9 * fScale}
                                fill={node.color} opacity={0.8}
                            />
                            <text
                                x={node.labelX + 16 * fScale} y={node.labelY + 16 * fScale}
                                textAnchor="middle" dominantBaseline="central"
                                className="fill-white font-bold pointer-events-none"
                                style={{ fontSize: `${9 * fScale}px` }}
                            >
                                {i + 1}
                            </text>
                        </g>
                    );
                })}

                {/* Quote automatiche */}
                {nodes2D.map((node, i) => {
                    if (node.segment.type !== 'straight') return null;
                    const r = node.rects[0];
                    if (!r) return null;
                    const isHoriz = r.width > r.height;
                    return (
                        <DimensionLine
                            key={`dim-${i}`}
                            x1={isHoriz ? r.x : r.x + r.width / 2}
                            y1={isHoriz ? r.y + r.height : r.y}
                            x2={isHoriz ? r.x + r.width : r.x + r.width / 2}
                            y2={isHoriz ? r.y + r.height : r.y + r.height}
                            label={`${(node.segment as StraightSegment).length}`}
                            offset={25}
                            fScale={fScale}
                        />
                    );
                })}

                {/* Annotazioni Utente */}
                {project.annotations?.filter(a => !a.viewId || a.viewId === viewFamily || (viewFamily === 'side' && a.viewId === sideFace)).map((ann) => {
                    const isSelected = selectedAnnId === ann.id;
                    if (ann.type === 'note') {
                        return (
                            <g key={ann.id}
                                className="annotation-draggable"
                                onClick={e => { e.stopPropagation(); if (activeTool === 'select') { setSelectedAnnId(ann.id); setSelectedIdx(null); } }}
                                onMouseDown={e => {
                                    if (activeTool === 'select') {
                                        e.stopPropagation();
                                        setDraggingAnnId(ann.id);
                                    }
                                }}
                                style={{ cursor: activeTool === 'select' ? 'pointer' : 'default' }}
                            >
                                <rect
                                    x={ann.x - 5 * fScale} y={ann.y - 18 * fScale}
                                    width={(ann.text.length * 9 * fScale) + 14 * fScale} height={26 * fScale}
                                    fill={isSelected ? 'hsl(var(--primary)/0.15)' : 'hsl(var(--background)/0.9)'}
                                    stroke={isSelected ? 'hsl(var(--primary))' : 'hsl(var(--foreground)/0.4)'}
                                    strokeDasharray={isSelected ? "none" : `${2 * fScale} ${2 * fScale}`}
                                    strokeWidth={1.5 * fScale}
                                    rx={6 * fScale}
                                />
                                <text x={ann.x} y={ann.y} className="fill-foreground font-sans font-medium pointer-events-none" style={{ fontSize: `${16 * fScale}px` }}>{ann.text}</text>
                            </g>
                        );
                    } else if (ann.type === 'dimension' && ann.x2 !== undefined && ann.y2 !== undefined) {
                        const label = ann.text || `Quota ?`; // Se custom è vuota, richiede all'utente
                        return (
                            <g key={ann.id}
                                onClick={e => { e.stopPropagation(); if (activeTool === 'select') { setSelectedAnnId(ann.id); setSelectedIdx(null); } }}
                                style={{ cursor: activeTool === 'select' ? 'pointer' : 'default' }}
                            >
                                <DimensionLine x1={ann.x} y1={ann.y} x2={ann.x2} y2={ann.y2} label={label} offset={0} isSelected={isSelected} fScale={fScale} />
                                {/* Hitbox invisibile per cliccarla più facilmente */}
                                <line x1={ann.x} y1={ann.y} x2={ann.x2} y2={ann.y2} stroke="transparent" strokeWidth={30 * fScale} />
                            </g>
                        );
                    }
                    return null;
                })}

                {/* Quota in fase di disegno */}
                {activeTool === 'add_dim' && drawingDim && (
                    <g>
                        {/* Linea guida tratteggiata */}
                        {(() => {
                            const dx = Math.abs(mousePos.x - drawingDim.x);
                            const dy = Math.abs(mousePos.y - drawingDim.y);
                            const snapX = dx > dy ? mousePos.x : drawingDim.x;
                            const snapY = dx > dy ? drawingDim.y : mousePos.y;
                            return (
                                <DimensionLine x1={drawingDim.x} y1={drawingDim.y} x2={snapX} y2={snapY} label="" offset={0} fScale={fScale} />
                            )
                        })()}
                    </g>
                )}

                {/* Label vista */}
                <text
                    x={vbX + 10} y={vbY + 20}
                    className="fill-muted-foreground text-[12px] font-semibold pointer-events-none"
                    style={{ paintOrder: 'stroke', stroke: 'hsl(var(--background))', strokeWidth: 3, strokeLinejoin: 'round' }}
                >
                    Vista: {VIEW_LABELS[view]}
                </text>
            </svg>



            {/* Pannello proprietà segmenti */}
            {selectedSegment && selectedIdx !== null && activeTool === 'select' && (
                <PropertiesPanel
                    segment={selectedSegment}
                    index={selectedIdx}
                    total={project.segments.length}
                    onUpdate={handleUpdate}
                    onRemove={handleRemove}
                    onInsertAfter={handleInsertAfter}
                    onClose={() => setSelectedIdx(null)}
                />
            )}

            {/* Pannello annotazioni */}
            {selectedAnnId && activeTool === 'select' && (
                <AnnotationPanel
                    annotation={project.annotations!.find(a => a.id === selectedAnnId)!}
                    onUpdate={(patch) => {
                        const newAnns = project.annotations!.map(a => a.id === selectedAnnId ? { ...a, ...patch } : a);
                        onProjectChange({ ...project, annotations: newAnns });
                    }}
                    onRemove={() => {
                        const newAnns = project.annotations!.filter(a => a.id !== selectedAnnId);
                        onProjectChange({ ...project, annotations: newAnns });
                        setSelectedAnnId(null);
                    }}
                    onClose={() => setSelectedAnnId(null)}
                />
            )}

            {/* Istruzioni */}
            <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/60 pointer-events-none">
                Click pezzo = seleziona · Scroll = zoom · Alt+Drag = pan
            </div>
        </div>
    );
}
