"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { DuctProject, Segment, StraightSegment, Elbow90Segment, Annotation, ContextualElementSegment } from "@/lib/cutting-simulator/project-model";
import { createStraightSegment, createElbow90Segment, createObstacleSegment } from "@/lib/cutting-simulator/project-model";
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
    X, Trash2, Plus, CornerDownRight, RectangleHorizontal, Type, Ruler, MousePointer2, Hand, Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SegmentDirection } from "@/lib/cutting-simulator/project-model";
import dynamic from 'next/dynamic';

// Lazy-load ThreeView per evitare problemi SSR con Three.js
const ThreeView = dynamic(() => import('./ThreeView').then(m => ({ default: m.ThreeView })), { ssr: false });

// ==================== VISTA LABELS ====================

const VIEW_LABELS: Record<string, string> = {
    top: 'Dall\'Alto',
    side: 'Laterale',
    iso: 'Iso',
    '3d': '3D',
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

    const lineClass = isSelected ? "stroke-primary" : "stroke-foreground opacity-80";
    const extClass = isSelected ? "stroke-primary opacity-60" : "stroke-foreground opacity-40";

    return (
        <g className="dimension-line">
            {/* Extension lines */}
            <line x1={x1} y1={y1} x2={ax} y2={ay} className={extClass} strokeWidth={0.5 * fScale} />
            <line x1={x2} y1={y2} x2={bx} y2={by} className={extClass} strokeWidth={0.5 * fScale} />
            {/* Dimension line with dasharray per le quote manuali e fisso */}
            <line x1={ax} y1={ay} x2={bx} y2={by} className={lineClass} strokeWidth={(isSelected ? 2 : 1.2) * fScale} strokeDasharray={`${4 * fScale} ${2 * fScale}`} markerStart={isSelected ? "url(#arrow-start-sel)" : "url(#arrow-start)"} markerEnd={isSelected ? "url(#arrow-end-sel)" : "url(#arrow-end)"} />
            {/* Label - font ingrandito per visibilità */}
            <text
                x={mx} y={my - 6 * fScale}
                textAnchor="middle"
                className={isSelected ? "fill-primary font-mono font-bold font-sans" : "fill-foreground font-mono font-bold font-sans"}
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

// ==================== PANNELLO PROPRIETÀ TRATTO ====================

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
                        <Label className="text-[10px] uppercase text-muted-foreground flex justify-between items-center">
                            Lunghezza (mm)
                        </Label>
                        <Input
                            type="number"
                            value={segment.length}
                            readOnly
                            disabled
                            className="h-8 text-sm opacity-70 bg-muted cursor-not-allowed"
                            title="La lunghezza dei tratti dritti è gestita dal Wizard iniziale o dividendo/unendo i segmenti in 3D."
                        />
                        <p className="text-[9px] text-muted-foreground mt-1 leading-tight">
                            Gestito da Tagli/Unioni 3D o dal Wizard.
                        </p>
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

                    <div className="pt-2 border-t border-border/50">
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-[10px] uppercase text-muted-foreground">📌 Pendini</Label>
                            <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{(segment as StraightSegment).pendini?.length || 0}</span>
                        </div>

                        <div className="space-y-2">
                            <div className="flex gap-1">
                                <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1 px-1" onClick={() => {
                                    const current = (segment as StraightSegment).pendini || [];
                                    onUpdate(index, { pendini: [...current, { id: `pend-${Date.now()}`, distance: 500, fromEnd: false }] });
                                }}>
                                    + Singolo (500)
                                </Button>
                                <Button variant="outline" size="sm" className="h-7 text-[10px] flex-1 px-1" onClick={() => {
                                    const start = 500;
                                    const step = 1000;
                                    const len = (segment as StraightSegment).length;
                                    const newPendini = [];
                                    for (let dist = start; dist <= len - 100; dist += step) {
                                        newPendini.push({ id: `pend-${Date.now()}-${dist}`, distance: dist, fromEnd: false });
                                    }
                                    onUpdate(index, { pendini: newPendini });
                                }}>
                                    + Passo 50+100
                                </Button>
                            </div>

                            {((segment as StraightSegment).pendini || []).length > 0 && (
                                <div className="space-y-1 max-h-32 overflow-y-auto pr-1 mt-2 custom-scrollbar">
                                    {((segment as StraightSegment).pendini || []).map((p, pIdx) => (
                                        <div key={p.id} className="flex items-center gap-1 bg-muted/50 p-1 rounded">
                                            <Input
                                                className="h-6 text-[10px] w-14 px-1 text-center font-mono"
                                                type="number"
                                                value={p.distance}
                                                onChange={e => {
                                                    const arr = [...((segment as StraightSegment).pendini || [])];
                                                    arr[pIdx] = { ...arr[pIdx], distance: Number(e.target.value) };
                                                    onUpdate(index, { pendini: arr });
                                                }}
                                            />
                                            <button
                                                className="text-[9px] text-muted-foreground mr-auto hover:text-foreground cursor-pointer"
                                                title="Clicca per invertire da Inizio/Fine"
                                                onClick={() => {
                                                    const arr = [...((segment as StraightSegment).pendini || [])];
                                                    arr[pIdx] = { ...arr[pIdx], fromEnd: !arr[pIdx].fromEnd };
                                                    onUpdate(index, { pendini: arr });
                                                }}
                                            >
                                                {p.fromEnd ? 'da fine' : 'da inizio'}
                                            </button>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/10 text-destructive shrink-0" onClick={() => {
                                                const arr = [...((segment as StraightSegment).pendini || [])];
                                                arr.splice(pIdx, 1);
                                                onUpdate(index, { pendini: arr });
                                            }}>
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button variant="ghost" size="sm" className="w-full h-6 text-[9px] text-destructive hover:bg-destructive/10 mt-1" onClick={() => onUpdate(index, { pendini: [] })}>
                                        Rimuovi Tutti
                                    </Button>
                                </div>
                            )}
                        </div>
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
                                            "p-1.5 rounded text-xs flex items-center justify-center transition-colors",
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

                    <div className="pt-1 border-t border-border/50">
                        <Label className="text-[10px] uppercase text-muted-foreground mt-1 block mb-1">Costruzione Angolo</Label>
                        <div className="grid grid-cols-2 gap-1">
                            <button
                                onClick={() => onUpdate(index, { baseMode: 'split' })}
                                className={cn(
                                    "p-1.5 text-xs rounded transition-colors whitespace-nowrap overflow-hidden text-ellipsis",
                                    (segment as Elbow90Segment).baseMode === 'split' ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"
                                )}
                            >
                                2 Pezzi (Diviso)
                            </button>
                            <button
                                onClick={() => onUpdate(index, { baseMode: 'single' })}
                                className={cn(
                                    "p-1.5 text-xs rounded transition-colors whitespace-nowrap overflow-hidden text-ellipsis",
                                    (segment as Elbow90Segment).baseMode === 'single' ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80 text-foreground"
                                )}
                            >
                                Pezzo Unico
                            </button>
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
    disableInteraction?: boolean;
    hideCutPlan?: boolean;
    boardDimensions?: { width: number; height: number; };
    headerAction?: React.ReactNode;
}

export function ProjectEditor({ project, onProjectChange, disableInteraction, hideCutPlan, boardDimensions, headerAction }: ProjectEditorProps) {
    const [viewFamily, setViewFamily] = useState<'top' | 'side' | 'iso' | '3d'>('3d');
    const [sideFace, setSideFace] = useState<SideFaceType>('front');

    const view: ViewType = viewFamily === 'side' ? sideFace : viewFamily === '3d' ? 'iso' : viewFamily;

    const [activeTool, setActiveTool] = useState<'select' | 'pan' | 'add_note' | 'add_dim'>('select');
    const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
    const [drawingDim, setDrawingDim] = useState<{ x: number; y: number } | null>(null);
    const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [draggingAnnId, setDraggingAnnId] = useState<string | null>(null);
    const [draggingTrackId, setDraggingTrackId] = useState<string | null>(null);
    const [snapTarget, setSnapTarget] = useState<{ x: number, y: number, z: number } | null>(null);
    const [trackDragOffset, setTrackDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; segIdx?: number; annId?: string } | null>(null);
    const [splitDialog, setSplitDialog] = useState<{ mode: 'atDistance' | 'half' | 'equalParts' | 'nPartsOfX'; segIdx: number } | null>(null);
    const [splitValue, setSplitValue] = useState<number>(0);
    const [isPanning, setIsPanning] = useState(false);
    const [isRotatingIso, setIsRotatingIso] = useState(false);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isoAngle, setIsoAngle] = useState(0);
    const svgRef = useRef<SVGSVGElement>(null);
    const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
    const rotStart = useRef<{ x: number; angle: number } | null>(null);

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

    // Fattore di scala dinamico per rendering font/spessori uniformi rispetto allo zoom
    const fScale = Math.max(1, vbW / 800);

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

    useEffect(() => {
        const container = svgRef.current?.parentElement;
        if (!container) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(z => Math.max(0.2, Math.min(5, z * factor)));
        };
        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (activeTool === 'pan' || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            panStart.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
        } else if (e.button === 1) { // Click Rotellina Centrale
            if (viewFamily === 'iso') {
                setIsRotatingIso(true);
                rotStart.current = { x: e.clientX, angle: isoAngle };
            } else {
                setIsPanning(true);
                panStart.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
            }
        }
    }, [panOffset, activeTool, viewFamily, isoAngle]);

    const handleSegmentMouseDown = useCallback((trackId: string | undefined, e: React.MouseEvent) => {
        if (activeTool === 'select' && trackId) {
            e.stopPropagation();
            setDraggingTrackId(trackId);
            setTrackDragOffset({ x: 0, y: 0 });
            const pt = getSvgPoint(e);
            panStart.current = { x: pt.x, y: pt.y, ox: 0, oy: 0 };
        }
    }, [activeTool, getSvgPoint]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const pt = getSvgPoint(e);
        setMousePos(pt);

        if (isRotatingIso && rotStart.current) {
            const dx = e.clientX - rotStart.current.x;
            setIsoAngle(rotStart.current.angle + dx * 0.5); // 0.5 è la sensibilità della rotazione
        } else if (isPanning && panStart.current && svgRef.current) {
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;

            const rect = svgRef.current.getBoundingClientRect();
            const realScale = Math.max(vbW / rect.width, vbH / rect.height);

            setPanOffset({
                x: panStart.current.ox + dx * realScale,
                y: panStart.current.oy + dy * realScale
            });
        } else if (draggingTrackId && panStart.current) {
            const dx = pt.x - panStart.current.x;
            const dy = pt.y - panStart.current.y;

            // Approssimiamo lo spostamento 3D "on the fly"
            let worldDx = dx; let worldDy = dy; let worldDz = 0;
            if (viewFamily === 'top') {
                worldDy = -dy;
            } else if (viewFamily === 'side') {
                if (sideFace === 'front') { worldDx = dx; worldDz = -dy; }
                else if (sideFace === 'back') { worldDx = -dx; worldDz = -dy; }
                else if (sideFace === 'right') { worldDy = dx; worldDz = -dy; }
                else if (sideFace === 'left') { worldDy = -dx; worldDz = -dy; }
            } else if (viewFamily === 'iso') {
                const rad = (isoAngle * Math.PI) / 180;
                const cos30 = 0.866;
                const sin30 = 0.5;
                const baseDx = (dx / (2 * cos30)) + (dy / (2 * sin30));
                const baseDy = -(dx / (2 * cos30)) + (dy / (2 * sin30));
                const cosA = Math.cos(-rad);
                const sinA = Math.sin(-rad);
                worldDx = baseDx * cosA - baseDy * sinA;
                worldDy = baseDx * sinA + baseDy * cosA;
            }

            // Troviamo la posizione di origine
            const trackIdx = project.segments.findIndex(s => s.id === draggingTrackId);
            const ts = project.segments[trackIdx] as any;
            let worldPos = { x: ts.startX ?? 0, y: ts.startY ?? 0, z: ts.startZ ?? 0 };
            if (ts.startX === undefined) {
                const firstNode = nodes3D.find(n => n.index === trackIdx + 1);
                if (firstNode) worldPos = { ...firstNode.start };
            }

            const newPos = { x: worldPos.x + worldDx, y: worldPos.y + worldDy, z: worldPos.z + worldDz };

            // Cerchiamo target di snap
            let foundSnap: { x: number, y: number, z: number } | null = null;
            let minSqDist = 150 * 150; // SNAP_DISTANCE = 150mm

            for (const node of nodes3D) {
                if (node.trackId === draggingTrackId) continue;
                const endpoints = [node.end];
                if (node.segment.type === 'trackSeparator') endpoints.push(node.start); // Opzionale aggancio a inizi liberi

                for (const ep of endpoints) {
                    const distSq = Math.pow(ep.x - newPos.x, 2) + Math.pow(ep.y - newPos.y, 2) + Math.pow(ep.z - newPos.z, 2);
                    if (distSq < minSqDist) {
                        minSqDist = distSq;
                        foundSnap = { ...ep };
                    }
                }
            }

            setSnapTarget(foundSnap);

            let screenDx = dx; let screenDy = dy;
            if (foundSnap) {
                const snapWorldDx = foundSnap.x - worldPos.x;
                const snapWorldDy = foundSnap.y - worldPos.y;
                const snapWorldDz = foundSnap.z - worldPos.z;

                if (viewFamily === 'top') {
                    screenDx = snapWorldDx; screenDy = -snapWorldDy;
                } else if (viewFamily === 'side') {
                    if (sideFace === 'front') { screenDx = snapWorldDx; screenDy = -snapWorldDz; }
                    else if (sideFace === 'back') { screenDx = -snapWorldDx; screenDy = -snapWorldDz; }
                    else if (sideFace === 'right') { screenDx = snapWorldDy; screenDy = -snapWorldDz; }
                    else if (sideFace === 'left') { screenDx = -snapWorldDy; screenDy = -snapWorldDz; }
                } else if (viewFamily === 'iso') {
                    const rad = (isoAngle * Math.PI) / 180;
                    const cosA = Math.cos(rad);
                    const sinA = Math.sin(rad);
                    const rx = snapWorldDx * cosA - snapWorldDy * sinA;
                    const ry = snapWorldDx * sinA + snapWorldDy * cosA;
                    const cos30 = 0.866;
                    const sin30 = 0.5;
                    screenDx = (rx - ry) * cos30;
                    screenDy = (rx + ry) * sin30 - snapWorldDz;
                }
            }

            setTrackDragOffset({ x: screenDx, y: screenDy });
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
    }, [isPanning, vbW, vbH, getSvgPoint, draggingAnnId, draggingTrackId, project, onProjectChange]);

    const handleMouseUp = useCallback((e: React.MouseEvent) => {
        setIsPanning(false);
        setIsRotatingIso(false);
        rotStart.current = null;
        setDraggingAnnId(null);

        if (draggingTrackId && panStart.current) {
            const pt = getSvgPoint(e);
            const dx = pt.x - panStart.current.x;
            const dy = pt.y - panStart.current.y;

            if (dx !== 0 || dy !== 0) {
                const newSegments = [...project.segments];
                const trackIdx = newSegments.findIndex(s => s.id === draggingTrackId);

                if (trackIdx >= 0 && newSegments[trackIdx].type === 'trackSeparator') {
                    const ts = { ...newSegments[trackIdx] } as any;

                    // Retrieve original world absolute position from node3D if ts lacks startX/Y
                    let worldPos = { x: ts.startX ?? 0, y: ts.startY ?? 0, z: ts.startZ ?? 0 };
                    if (ts.startX === undefined) {
                        const firstSegIdx = trackIdx + 1;
                        const firstNode = nodes3D.find(n => n.index === firstSegIdx);
                        if (firstNode) {
                            worldPos = { ...firstNode.start };
                        }
                    }

                    let worldDx = dx; let worldDy = dy; let worldDz = 0;
                    if (snapTarget) {
                        ts.startX = snapTarget.x;
                        ts.startY = snapTarget.y;
                        ts.startZ = snapTarget.z;
                    } else {
                        if (viewFamily === 'top') {
                            worldDy = -dy;
                        } else if (viewFamily === 'side') {
                            if (sideFace === 'front') { worldDx = dx; worldDz = -dy; }
                            else if (sideFace === 'back') { worldDx = -dx; worldDz = -dy; }
                            else if (sideFace === 'right') { worldDy = dx; worldDz = -dy; }
                            else if (sideFace === 'left') { worldDy = -dx; worldDz = -dy; }
                        } else if (viewFamily === 'iso') {
                            const rad = (isoAngle * Math.PI) / 180;
                            const cos30 = 0.866;
                            const sin30 = 0.5;

                            const baseDx = (dx / (2 * cos30)) + (dy / (2 * sin30));
                            const baseDy = -(dx / (2 * cos30)) + (dy / (2 * sin30));

                            const cosA = Math.cos(-rad);
                            const sinA = Math.sin(-rad);
                            worldDx = baseDx * cosA - baseDy * sinA;
                            worldDy = baseDx * sinA + baseDy * cosA;
                            worldDz = 0;
                        }

                        ts.startX = Math.round(worldPos.x + worldDx);
                        ts.startY = Math.round(worldPos.y + worldDy);
                        ts.startZ = Math.round(worldPos.z + worldDz);
                    }

                    newSegments[trackIdx] = ts;
                    onProjectChange({ ...project, segments: newSegments });
                }
            }
            setDraggingTrackId(null);
            setSnapTarget(null);
            setTrackDragOffset({ x: 0, y: 0 });
        }

        panStart.current = null;
    }, [draggingTrackId, viewFamily, sideFace, getSvgPoint, project, onProjectChange, nodes3D]);

    const handleSegmentClick = useCallback((idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeTool === 'select') {
            setSelectedIdx(prev => prev === idx ? null : idx);
            setSelectedAnnId(null);
        }
    }, [activeTool]);

    // ==================== Context Menu Handler ====================
    const handleContextMenu = useCallback((segIdx: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, segIdx });
    }, []);

    // Chiudi context menu con Escape
    useEffect(() => {
        if (!contextMenu) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setContextMenu(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [contextMenu]);

    // ==================== Funzioni Context Menu ====================
    // Calcola la lunghezza cumulativa dei dritti fino all'indice indicato (per pre-compilare il muro)
    const getRunLengthUpTo = useCallback((idx: number) => {
        let len = 0;
        for (let i = idx; i >= 0; i--) {
            const s = project.segments[i];
            if (s.type === 'straight') len += s.length;
            else if (s.type !== 'obstacle') break;
        }
        return len;
    }, [project.segments]);

    const splitSegment = useCallback((segIdx: number, mode: 'half' | 'atDistance' | 'equalParts' | 'nPartsOfX', value?: number) => {
        const seg = project.segments[segIdx];
        if (seg.type !== 'straight') return;
        const sSeg = seg as StraightSegment;
        const len = sSeg.length;
        const oldObstacles = sSeg.obstacles || [];
        const newSegments = [...project.segments];

        let parts: StraightSegment[] = [];

        if (mode === 'half') {
            const half = Math.round(len / 2);
            parts.push(createStraightSegment(half));
            parts.push(createStraightSegment(len - half));
        } else if (mode === 'atDistance' && value && value > 0 && value < len) {
            parts.push(createStraightSegment(value));
            parts.push(createStraightSegment(len - value));
        } else if (mode === 'equalParts' && value && value >= 2) {
            const partLen = Math.round(len / value);
            let remaining = len;
            for (let i = 0; i < value; i++) {
                const pLen = i === value - 1 ? remaining : partLen;
                parts.push(createStraightSegment(pLen));
                remaining -= partLen;
            }
        } else if (mode === 'nPartsOfX' && value && value > 0) {
            const numParts = Math.ceil(len / value);
            let remaining = len;
            for (let i = 0; i < numParts; i++) {
                const pLen = Math.min(value, remaining);
                parts.push(createStraightSegment(pLen));
                remaining -= pLen;
            }
        } else {
            return; // Valore non valido, non fare nulla
        }

        // Riassegna gli ostacoli alle nuove parti in base al distanceFromStart
        if (oldObstacles.length > 0) {
            let currentOffset = 0;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const partStart = currentOffset;
                const partEnd = currentOffset + part.length;

                // Trova gli ostacoli che cadono in questa parte
                const partObstacles = oldObstacles.filter(o => {
                    const oDist = o.distanceFromStart || 0;
                    // L'ostacolo appartiene a questo segmento se il suo centro/inizio è contenuto
                    return oDist >= partStart && oDist < partEnd;
                });

                if (partObstacles.length > 0) {
                    part.obstacles = partObstacles.map(o => ({
                        ...o,
                        distanceFromStart: (o.distanceFromStart || 0) - partStart
                    }));
                }

                currentOffset += part.length;
            }
        }

        newSegments.splice(segIdx, 1, ...parts);

        onProjectChange({ ...project, segments: newSegments });
        setContextMenu(null);
        setSplitDialog(null);
    }, [project, onProjectChange]);

    // Unisci SOLO i segmenti dritti contigui (NON attraversa muri/solai)
    // I muri interrompono la corsa, impedendo a due tratti di fondersi passando attraverso
    const mergeRun = useCallback((segIdx: number) => {
        const segments = project.segments;
        const seg = segments[segIdx];
        if (seg?.type !== 'straight') return;

        const segs = [...project.segments];
        // Trovo l'inizio della "run" di dritti (mi fermo al primo ostacolo/curva)
        let startIndex = segIdx;
        while (startIndex > 0 && segs[startIndex - 1].type === 'straight') {
            startIndex--;
        }

        // Trovo la fine
        let endIndex = segIdx;
        while (endIndex < segs.length - 1 && segs[endIndex + 1].type === 'straight') {
            endIndex++;
        }

        if (startIndex === endIndex) return;

        const runSegments = segs.slice(startIndex, endIndex + 1);

        // Sommo la lunghezza di TUTTI i dritti contigui e colleziono gli ostacoli
        let totalLength = 0;
        const allObstacles: typeof project.segments[0][] = [];

        for (const s of runSegments) {
            const sSeg = s as StraightSegment;
            if (sSeg.obstacles && sSeg.obstacles.length > 0) {
                // Aggiungiamo il totalLength accumulato finora alla posizione dell'ostacolo
                const mappedObstacles = sSeg.obstacles.map(o => ({
                    ...o,
                    distanceFromStart: (o.distanceFromStart || 0) + totalLength
                }));
                allObstacles.push(...mappedObstacles);
            }
            totalLength += sSeg.length;
        }

        // Creo l'unico segmento dritto unificato
        const unifiedStraight = createStraightSegment(totalLength);
        if (allObstacles.length > 0) {
            unifiedStraight.obstacles = allObstacles as any;
        }

        // Sostituisco i dritti con quello unito
        segs.splice(startIndex, runSegments.length, unifiedStraight);

        onProjectChange({ ...project, segments: segs });
        setContextMenu(null);
        setSelectedIdx(startIndex); // Mantieni la selezione sul nuovo segmento

    }, [project, onProjectChange]);

    const insertSegmentAfter = useCallback((segIdx: number, newSeg: Segment) => {
        const newSegments = [...project.segments];
        newSegments.splice(segIdx + 1, 0, newSeg);
        onProjectChange({ ...project, segments: newSegments });
        setContextMenu(null);
        setSelectedIdx(segIdx + 1);
    }, [project, onProjectChange]);

    const insertObstacleAfter = useCallback((segIdx: number, obstacleType: 'wall' | 'floor' | 'column') => {
        const len = getRunLengthUpTo(segIdx);
        const obs = createObstacleSegment(obstacleType, project.section.innerWidth, project.section.innerHeight, len);

        const newSegments = [...project.segments];
        const currentSeg = newSegments[segIdx];

        if (currentSeg?.type === 'straight') {
            // Selezioniamo il dritto e lo allunghiamo dello spessore
            const updatedStraight = { ...currentSeg, length: currentSeg.length + obs.thickness };
            newSegments.splice(segIdx, 1, updatedStraight);
            newSegments.splice(segIdx + 1, 0, obs);
        } else {
            // Se non è dritto (es. curva precedente), creiamo il dritto e l'ostacolo assieme
            const passThroughStraight = createStraightSegment(obs.thickness);
            newSegments.splice(segIdx + 1, 0, passThroughStraight, obs);
        }

        onProjectChange({ ...project, segments: newSegments });
        setContextMenu(null);
        setSelectedIdx(segIdx + 1); // Rende selezionato il dritto passante se aggiunto
    }, [getRunLengthUpTo, project, onProjectChange]);

    const handleCanvasClick = useCallback((e: React.MouseEvent) => {
        if (isPanning) return;
        // Chiudi SOLO context menu se aperto. Il dialog Split ora si chiude solo da "Annulla" o "Conferma"
        if (contextMenu) { setContextMenu(null); return; }

        // Evitiamo di deselettare se c'è uno splitDialog aperto, l'utente sta puntando la quota
        if (splitDialog) return;

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
    }, [isPanning, activeTool, drawingDim, getSvgPoint, onProjectChange, project, view, viewFamily, sideFace, contextMenu, splitDialog]);

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

    const handleMoveSegment = useCallback((idx: number, direction: 'up' | 'down') => {
        if (direction === 'up' && idx <= 0) return;
        if (direction === 'down' && idx >= project.segments.length - 1) return;

        const newSegments = [...project.segments];
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        const temp = newSegments[idx];
        newSegments[idx] = newSegments[swapIdx];
        newSegments[swapIdx] = temp;

        onProjectChange({ ...project, segments: newSegments });
        setContextMenu(null);
        setSelectedIdx(swapIdx); // Manteniamo la selezione sul segmento spostato
    }, [project, onProjectChange]);

    const mergeStraightIntoElbow = useCallback((elbowIdx: number, direction: 'prev' | 'next') => {
        const newSegments = [...project.segments];
        const elbow = newSegments[elbowIdx] as Elbow90Segment;

        if (direction === 'prev') {
            const prev = newSegments[elbowIdx - 1] as StraightSegment;
            newSegments[elbowIdx] = { ...elbow, armA: (elbow.armA || 0) + prev.length };
            newSegments.splice(elbowIdx - 1, 1);
            setSelectedIdx(elbowIdx - 1);
        } else {
            const nxt = newSegments[elbowIdx + 1] as StraightSegment;
            newSegments[elbowIdx] = { ...elbow, armB: (elbow.armB || 0) + nxt.length };
            newSegments.splice(elbowIdx + 1, 1);
            setSelectedIdx(elbowIdx);
        }

        onProjectChange({ ...project, segments: newSegments });
        setContextMenu(null);
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
        <div className="relative w-full h-full flex flex-col overflow-hidden shrink-0 border border-border rounded-xl bg-muted/20" tabIndex={0} onKeyDown={e => {
            const activeEl = document.activeElement;
            const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'SELECT' || activeEl?.getAttribute('contenteditable') === 'true';

            if (!isInput && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (selectedIdx !== null) handleRemove(selectedIdx);
                else if (selectedAnnId !== null) {
                    onProjectChange({ ...project, annotations: project.annotations?.filter(a => a.id !== selectedAnnId) });
                    setSelectedAnnId(null);
                }
            }
        }}>
            {/* Toolbar superiore fissa */}
            <div className="absolute top-2 left-2 right-2 flex items-center gap-2 z-10 flex-wrap shrink-0">

                <div className="flex bg-muted/50 p-0.5 rounded-md backdrop-blur-sm shadow-sm">
                    {/* Selettore vista */}
                    <div className="flex gap-1 p-0.5 bg-muted/50 rounded-md shrink-0">
                        {(['top', 'side', 'iso', '3d'] as const).map(v => (
                            <button
                                key={v}
                                onClick={() => {
                                    setViewFamily(v);
                                    if (v === 'iso' || v === '3d') {
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

                    {headerAction && (
                        <div className="flex items-center ml-2 border-l border-border/50 pl-2">
                            {headerAction}
                        </div>
                    )}
                </div>
            </div>

            {/* ===== CANVAS 3D (Three.js) oppure SVG ===== */}
            {viewFamily === '3d' ? (
                <div className="w-full flex-1" style={{ minHeight: 500 }}
                    onContextMenu={(e) => {
                        e.preventDefault();
                        // Click destro nella vista 3D → apre context menu sul segmento selezionato
                        if (selectedIdx !== null && selectedIdx >= 0) {
                            handleContextMenu(selectedIdx, e);
                        }
                    }}
                >
                    <ThreeView
                        nodes3D={nodes3D}
                        section={project.section}
                        selectedIdx={selectedIdx}
                        onSelect={(idx) => { setSelectedIdx(idx >= 0 ? idx : null); }}
                        jointBands={project.jointBands}
                        jointBandWidth={project.jointBandWidth}
                    />
                </div>
            ) : (
                <svg
                    ref={svgRef}
                    viewBox={`${vbX.toFixed(0)} ${vbY.toFixed(0)} ${vbW.toFixed(0)} ${vbH.toFixed(0)}`}
                    className="w-full h-full flex-1 bg-background touch-none"
                    style={{ cursor: isPanning ? 'grabbing' : 'crosshair', minHeight: 500 }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onClick={handleCanvasClick}
                >
                    {/* Markers per frecce quote */}
                    <defs>
                        <marker id="arrow-start" markerWidth="6" markerHeight="4" refX="0" refY="2" orient="auto">
                            <path d="M6,0 L0,2 L6,4" fill="currentColor" className="text-foreground opacity-80" />
                        </marker>
                        <marker id="arrow-end" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                            <path d="M0,0 L6,2 L0,4" fill="currentColor" className="text-foreground opacity-80" />
                        </marker>
                        <marker id="arrow-start-sel" markerWidth="6" markerHeight="4" refX="0" refY="2" orient="auto">
                            <path d="M6,0 L0,2 L6,4" fill="currentColor" className="text-primary" />
                        </marker>
                        <marker id="arrow-end-sel" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
                            <path d="M0,0 L6,2 L0,4" fill="currentColor" className="text-primary" />
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
                        const isDraggingThisTrack = node.trackId === draggingTrackId && draggingTrackId !== null;
                        return (
                            <g
                                key={node.segment.id}
                                onClick={e => handleSegmentClick(node.index, e)}
                                onContextMenu={e => handleContextMenu(node.index, e)}
                                onMouseDown={e => handleSegmentMouseDown(node.trackId, e)}
                                style={{
                                    cursor: isDraggingThisTrack ? 'grabbing' : (activeTool === 'select' ? (node.trackId ? 'grab' : 'pointer') : 'default'),
                                    transform: isDraggingThisTrack ? `translate(${trackDragOffset.x}px, ${trackDragOffset.y}px)` : undefined,
                                    transition: isDraggingThisTrack ? 'none' : 'transform 0.1s ease-out'
                                }}
                            >
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
                                    node.rects.map((r, rIdx) => {
                                        const rectColor = r.color || node.color;
                                        return (
                                            <rect
                                                key={rIdx}
                                                x={r.x}
                                                y={r.y}
                                                width={r.width}
                                                height={r.height}
                                                fill={isSelected ? `${rectColor}50` : `${rectColor}25`}
                                                stroke={rectColor}
                                                strokeWidth={isSelected ? 3 : 1.5}
                                                rx={r.rx || 0}
                                            />
                                        );
                                    })
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

                                {/* Quote ostacolo in testo */}
                                {node.segment.type === 'obstacle' && (node.segment as ContextualElementSegment).showQuotas && (
                                    <g transform={`translate(${node.labelX}, ${node.labelY + 36 * fScale})`}>
                                        <rect x={-30 * fScale} y={-10 * fScale} width={60 * fScale} height={16 * fScale} fill="hsl(var(--background)/0.8)" rx={4 * fScale} />
                                        <text textAnchor="middle" className="fill-purple-500 font-mono font-bold pointer-events-none" style={{ fontSize: `${10 * fScale}px` }}>
                                            {(() => {
                                                const o = node.segment as ContextualElementSegment;
                                                const q = [];
                                                if (o.quotaLeft) q.push(`←${o.quotaLeft}`);
                                                if (o.quotaRight) q.push(`${o.quotaRight}→`);
                                                if (o.quotaTop) q.push(`↑${o.quotaTop}`);
                                                if (o.quotaBottom) q.push(`↓${o.quotaBottom}`);
                                                return q.join(' ');
                                            })()}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })}

                    {/* Indicatore visivo Snap */}
                    {snapTarget && draggingTrackId && (() => {
                        // Proiettiamo in 2D la posizione world dello snap
                        let sx = 0, sy = 0;
                        // Mock rapido di proiezione 2D
                        if (viewFamily === 'top') {
                            sx = snapTarget.x; sy = -snapTarget.y;
                        } else if (viewFamily === 'side') {
                            if (sideFace === 'front') { sx = snapTarget.x; sy = -snapTarget.z; }
                            else if (sideFace === 'back') { sx = -snapTarget.x; sy = -snapTarget.z; }
                            else if (sideFace === 'right') { sx = snapTarget.y; sy = -snapTarget.z; }
                            else if (sideFace === 'left') { sx = -snapTarget.y; sy = -snapTarget.z; }
                        } else if (viewFamily === 'iso') {
                            const rad = (isoAngle * Math.PI) / 180;
                            const cosA = Math.cos(rad); const sinA = Math.sin(rad);
                            const rx = snapTarget.x * cosA - snapTarget.y * sinA;
                            const ry = snapTarget.x * sinA + snapTarget.y * cosA;
                            const cos30 = 0.866; const sin30 = 0.5;
                            sx = (rx - ry) * cos30;
                            sy = (rx + ry) * sin30 - snapTarget.z;
                        }

                        return (
                            <g>
                                <circle cx={sx} cy={sy} r={25 * fScale} fill="hsl(var(--primary)/0.2)" stroke="hsl(var(--primary))" strokeWidth={2 * fScale} />
                                <circle cx={sx} cy={sy} r={8 * fScale} fill="hsl(var(--primary))" />
                                <line x1={sx - 40 * fScale} y1={sy} x2={sx + 40 * fScale} y2={sy} stroke="hsl(var(--primary))" strokeWidth={1 * fScale} pointerEvents="none" strokeDasharray="4 4" />
                                <line x1={sx} y1={sy - 40 * fScale} x2={sx} y2={sy + 40 * fScale} stroke="hsl(var(--primary))" strokeWidth={1 * fScale} pointerEvents="none" strokeDasharray="4 4" />
                            </g>
                        );
                    })()}

                    {/* TODO: Quote automatiche rimosse per evitare sovrapposizioni con l'etichetta base */}

                    {/* Annotazioni Utente */}
                    {project.annotations?.filter(a => !a.viewId || a.viewId === viewFamily || (viewFamily === 'side' && a.viewId === sideFace)).map((ann) => {
                        const isSelected = selectedAnnId === ann.id;
                        if (ann.type === 'note') {
                            return (
                                <g key={ann.id}
                                    className="annotation-draggable"
                                    onClick={e => { e.stopPropagation(); if (activeTool === 'select') { setSelectedAnnId(ann.id); setSelectedIdx(null); } }}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (disableInteraction) return;
                                        setContextMenu({ x: e.clientX, y: e.clientY, annId: ann.id });
                                        setSelectedAnnId(ann.id);
                                    }}
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
                            const x1 = ann.x;
                            const y1 = ann.y;
                            const x2 = ann.x2;
                            const y2 = ann.y2;
                            const offset = 0; // Manual dimensions don't have an auto offset

                            // Calculate dimension line points
                            const angle = Math.atan2(y2 - y1, x2 - x1);
                            const perpAngle = angle + Math.PI / 2;

                            const ax = x1 + Math.cos(perpAngle) * offset;
                            const ay = y1 + Math.sin(perpAngle) * offset;
                            const bx = x2 + Math.cos(perpAngle) * offset;
                            const by = y2 + Math.sin(perpAngle) * offset;

                            // Calculate label position
                            const mx = (ax + bx) / 2;
                            const my = (ay + by) / 2;

                            const lineClass = isSelected ? "stroke-primary" : "stroke-foreground opacity-80";
                            const extClass = isSelected ? "stroke-primary opacity-60" : "stroke-foreground opacity-40";

                            return (
                                <g key={ann.id}
                                    onClick={e => { e.stopPropagation(); if (activeTool === 'select') { setSelectedAnnId(ann.id); setSelectedIdx(null); } }}
                                    style={{ cursor: activeTool === 'select' ? 'pointer' : 'default' }}
                                >
                                    {/* Extension lines */}
                                    <line x1={x1} y1={y1} x2={ax} y2={ay} className={extClass} strokeWidth={0.5 * fScale} />
                                    <line x1={x2} y1={y2} x2={bx} y2={by} className={extClass} strokeWidth={0.5 * fScale} />
                                    {/* Dimension line with dasharray per le quote manuali e fisso */}
                                    <line x1={ax} y1={ay} x2={bx} y2={by} className={lineClass} strokeWidth={(isSelected ? 2 : 1.2) * fScale} strokeDasharray={`${4 * fScale} ${2 * fScale}`} markerStart={isSelected ? "url(#arrow-start-sel)" : "url(#arrow-start)"} markerEnd={isSelected ? "url(#arrow-end-sel)" : "url(#arrow-end)"} />
                                    {/* Label - font ingrandito per visibilità */}
                                    <text
                                        x={mx} y={my - 6 * fScale}
                                        textAnchor="middle"
                                        className={isSelected ? "fill-primary font-mono font-bold font-sans" : "fill-foreground font-mono font-bold font-sans"}
                                        style={{ fontSize: `${14 * fScale}px`, paintOrder: 'stroke', stroke: 'hsl(var(--background))', strokeWidth: 4 * fScale, strokeLinejoin: 'round' }}
                                    >
                                        {label}
                                    </text>
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

                                const x1 = drawingDim.x;
                                const y1 = drawingDim.y;
                                const x2 = snapX;
                                const y2 = snapY;
                                const label = ""; // No label during drawing
                                const offset = 0;
                                const isSelected = true;

                                // Calculate dimension line points
                                const angle = Math.atan2(y2 - y1, x2 - x1);
                                const perpAngle = angle + Math.PI / 2;

                                const ax = x1 + Math.cos(perpAngle) * offset;
                                const ay = y1 + Math.sin(perpAngle) * offset;
                                const bx = x2 + Math.cos(perpAngle) * offset;
                                const by = y2 + Math.sin(perpAngle) * offset;

                                // Calculate label position
                                const mx = (ax + bx) / 2;
                                const my = (ay + by) / 2;

                                const lineClass = isSelected ? "stroke-primary" : "stroke-foreground opacity-80";
                                const extClass = isSelected ? "stroke-primary opacity-60" : "stroke-foreground opacity-40";

                                return (
                                    <>
                                        <line x1={drawingDim.x} y1={drawingDim.y} x2={snapX} y2={snapY} stroke="hsl(var(--primary))" strokeWidth={1.5 * fScale} strokeDasharray={`${6 * fScale},${4 * fScale}`} opacity={0.6} />
                                        <g className="dimension-line">
                                            {/* Extension lines */}
                                            <line x1={x1} y1={y1} x2={ax} y2={ay} className={extClass} strokeWidth={0.5 * fScale} />
                                            <line x1={x2} y1={y2} x2={bx} y2={by} className={extClass} strokeWidth={0.5 * fScale} />
                                            {/* Dimension line with dasharray per le quote manuali e fisso */}
                                            <line x1={ax} y1={ay} x2={bx} y2={by} className={lineClass} strokeWidth={(isSelected ? 2 : 1.2) * fScale} strokeDasharray={`${4 * fScale} ${2 * fScale}`} markerStart={isSelected ? "url(#arrow-start-sel)" : "url(#arrow-start)"} markerEnd={isSelected ? "url(#arrow-end-sel)" : "url(#arrow-end)"} />
                                            {/* Label - font ingrandito per visibilità */}
                                            <text
                                                x={mx} y={my - 6 * fScale}
                                                textAnchor="middle"
                                                className={isSelected ? "fill-primary font-mono font-bold font-sans" : "fill-foreground font-mono font-bold font-sans"}
                                                style={{ fontSize: `${14 * fScale}px`, paintOrder: 'stroke', stroke: 'hsl(var(--background))', strokeWidth: 4 * fScale, strokeLinejoin: 'round' }}
                                            >
                                                {label}
                                            </text>
                                        </g>
                                    </>
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
            )}


            {/* Pannello proprietà segmenti */}
            {selectedSegment && selectedIdx !== null && activeTool === 'select' && !disableInteraction && (
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

            {!selectedSegment && selectedIdx === null && selectedAnnId === null && activeTool === 'select' && (
                <div className="absolute right-2 top-2 p-2 bg-background/50 backdrop-blur border rounded-md text-xs text-muted-foreground opacity-60 pointer-events-none">
                    Nessuna selezione
                </div>
            )}

            {/* Istruzioni */}
            <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/60 pointer-events-none">
                Click pezzo = seleziona · Tasto destro = opzioni · Scroll = zoom · Alt+Drag = pan
            </div>

            {/* ==================== CONTEXT MENU ==================== */}
            {contextMenu && !disableInteraction && (() => {
                if (contextMenu.segIdx === undefined) return null;
                const seg = project.segments[contextMenu.segIdx];
                const isStraight = seg?.type === 'straight';
                // Controlla se ci sono dritti adiacenti da unire
                const canMerge = (() => {
                    const segs = project.segments;
                    const idx = contextMenu.segIdx;
                    if (segs[idx]?.type !== 'straight') return false;
                    const prevOk = idx > 0 && segs[idx - 1].type === 'straight';
                    const nextOk = idx < segs.length - 1 && segs[idx + 1].type === 'straight';
                    return prevOk || nextOk;
                })();
                // Calcola lunghezza totale run di soli dritti
                const runTotal = (() => {
                    if (!canMerge) return 0;
                    const segs = project.segments;
                    let start = contextMenu.segIdx;
                    while (start > 0 && segs[start - 1].type === 'straight') start--;
                    let end = contextMenu.segIdx;
                    while (end < segs.length - 1 && segs[end + 1].type === 'straight') end++;
                    let total = 0;
                    for (let i = start; i <= end; i++) total += (segs[i] as StraightSegment).length;
                    return total;
                })();
                return (
                    <>
                        {/* Backdrop overlay — click per chiudere */}
                        <div className="fixed inset-0 z-[9998]" onClick={() => setContextMenu(null)} />
                        <div
                            className="fixed z-[9999] min-w-[220px] bg-popover border border-border rounded-lg shadow-xl py-1 animate-in fade-in zoom-in-95"
                            style={{ left: contextMenu.x, top: contextMenu.y }}
                        >
                            {/* Titolo */}
                            <div className="px-3 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wide border-b border-border/50">
                                {seg?.type === 'straight' ? `Dritto ${(seg as StraightSegment).length}mm` :
                                    seg?.type === 'elbow90' ? 'Curva 90°' :
                                        seg?.type === 'obstacle' ? `Ostacolo (${(seg as ContextualElementSegment).obstacleType})` :
                                            'Segmento'}
                            </div>

                            {/* Opzioni Divisione (solo per dritti) */}
                            {isStraight && (
                                <>
                                    <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2"
                                        onClick={() => { splitSegment(contextMenu.segIdx as number, 'half'); }}>
                                        ✂️ Dividi a metà
                                    </button>
                                    <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2"
                                        onClick={() => { setSplitDialog({ mode: 'atDistance', segIdx: contextMenu.segIdx as number }); setSplitValue(Math.round((seg as StraightSegment).length / 2)); setContextMenu(null); }}>
                                        📏 Dividi a X mm dall&apos;inizio
                                    </button>
                                    <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2"
                                        onClick={() => { setSplitDialog({ mode: 'equalParts', segIdx: contextMenu.segIdx as number }); setSplitValue(2); setContextMenu(null); }}>
                                        📐 Dividi in N parti uguali
                                    </button>
                                    <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2"
                                        onClick={() => { setSplitDialog({ mode: 'nPartsOfX', segIdx: contextMenu.segIdx as number }); setSplitValue(500); setContextMenu(null); }}>
                                        📐 Dividi in pezzi da X mm
                                    </button>
                                    <div className="border-t border-border/50 my-1" />
                                </>
                            )}

                            {/* Unisci dritti adiacenti (i muri restano) */}
                            {canMerge && (
                                <>
                                    <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2"
                                        onClick={() => mergeRun(contextMenu.segIdx as number)}>
                                        🔗 Unisci dritti adiacenti ({runTotal}mm)
                                    </button>
                                    <div className="border-t border-border/50 my-1" />
                                </>
                            )}

                            {/* Azioni Curva 90° */}
                            {seg?.type === 'elbow90' && (() => {
                                const idx = contextMenu.segIdx as number;
                                const prevIsStraight = idx > 0 && project.segments[idx - 1].type === 'straight';
                                const nextIsStraight = idx < project.segments.length - 1 && project.segments[idx + 1].type === 'straight';

                                if (!prevIsStraight && !nextIsStraight) return null;

                                return (
                                    <>
                                        {prevIsStraight && (
                                            <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2 text-primary"
                                                onClick={() => mergeStraightIntoElbow(idx, 'prev')}>
                                                ↩️ Allunga braccio ingresso con segmento precedente
                                            </button>
                                        )}
                                        {nextIsStraight && (
                                            <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent flex items-center gap-2 text-primary"
                                                onClick={() => mergeStraightIntoElbow(idx, 'next')}>
                                                ↪️ Allunga braccio uscita con segmento successivo
                                            </button>
                                        )}
                                        <div className="border-t border-border/50 my-1" />
                                    </>
                                );
                            })()}

                            {/* Riordino (Sposta prima/Dopo) */}
                            {contextMenu.segIdx !== undefined && seg?.type !== 'trackSeparator' && (
                                <>
                                    <div className="flex w-full divide-x divide-border/50">
                                        {(contextMenu.segIdx as number) > 0 && (
                                            <button className="flex-1 px-2 py-1.5 text-xs text-center hover:bg-accent" title="Sposta Prima"
                                                onClick={() => handleMoveSegment(contextMenu.segIdx as number, 'up')}>
                                                ⬆️ Sposta
                                            </button>
                                        )}
                                        {(contextMenu.segIdx as number) < project.segments.length - 1 && (
                                            <button className="flex-1 px-2 py-1.5 text-xs text-center hover:bg-accent" title="Sposta Dopo"
                                                onClick={() => handleMoveSegment(contextMenu.segIdx as number, 'down')}>
                                                ⬇️ Sposta
                                            </button>
                                        )}
                                    </div>
                                    <div className="border-t border-border/50 my-1" />
                                </>
                            )}

                            {/* Elimina / Merge */}
                            {seg?.type === 'straight' && canMerge ? (
                                <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-destructive/10 text-destructive flex items-center gap-2"
                                    onClick={() => {
                                        // "Elimina" per un pezzo dritto in una run significa fonderlo.
                                        mergeRun(contextMenu.segIdx as number);
                                        setContextMenu(null);
                                    }}>
                                    🗑️ Elimina (Fondi tratto)
                                </button>
                            ) : (
                                seg?.type !== 'straight' && (
                                    <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-destructive/10 text-destructive flex items-center gap-2"
                                        onClick={() => { handleRemove(contextMenu.segIdx as number); setContextMenu(null); }}>
                                        🗑️ Elimina elemento
                                    </button>
                                )
                            )}
                        </div>
                    </>
                );
            })()}

            {/* ==================== SPLIT DIALOG ==================== */}
            {splitDialog && (() => {
                const seg = project.segments[splitDialog.segIdx] as StraightSegment;
                if (!seg || seg.type !== 'straight') return null;
                return (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSplitDialog(null)}>
                        <div className="bg-popover border border-border rounded-xl shadow-2xl p-4 min-w-[280px] space-y-3 animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
                            <h3 className="text-sm font-semibold">
                                {splitDialog.mode === 'atDistance' ? '📏 Dividi a distanza' :
                                    splitDialog.mode === 'nPartsOfX' ? '📐 Dividi in pezzi da X mm' :
                                        '📐 Dividi in parti uguali'}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Segmento dritto: <strong>{seg.length}mm</strong>
                            </p>
                            <div className="space-y-1">
                                <label className="text-xs text-muted-foreground">
                                    {splitDialog.mode === 'atDistance' ? 'Distanza dall\'inizio (mm)' :
                                        splitDialog.mode === 'nPartsOfX' ? 'Lunghezza di ogni pezzo (mm)' :
                                            'Numero di parti'}
                                </label>
                                <input
                                    type="number"
                                    min={splitDialog.mode === 'atDistance' ? 1 : splitDialog.mode === 'nPartsOfX' ? 1 : 2}
                                    max={splitDialog.mode === 'atDistance' ? seg.length - 1 : splitDialog.mode === 'nPartsOfX' ? seg.length : 20}
                                    step={1}
                                    value={splitValue}
                                    onChange={e => setSplitValue(parseInt(e.target.value) || 0)}
                                    className="w-full h-9 px-3 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                                    autoFocus
                                />
                                {splitDialog.mode === 'equalParts' && splitValue >= 2 && (
                                    <p className="text-[10px] text-muted-foreground">
                                        Ogni parte: ~{Math.round(seg.length / splitValue)}mm
                                    </p>
                                )}
                                {splitDialog.mode === 'nPartsOfX' && splitValue > 0 && (
                                    <p className="text-[10px] text-muted-foreground">
                                        {Math.ceil(seg.length / splitValue)} pezzi
                                        {seg.length % splitValue !== 0 && ` (ultimo: ${seg.length % splitValue}mm)`}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2 pt-1">
                                <button
                                    className="flex-1 h-8 text-xs bg-muted hover:bg-muted/80 rounded-md transition-colors"
                                    onClick={() => setSplitDialog(null)}>
                                    Annulla
                                </button>
                                <button
                                    className="flex-1 h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors font-medium"
                                    onClick={() => splitSegment(splitDialog.segIdx, splitDialog.mode, splitValue)}>
                                    Dividi
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div >
    );
}
