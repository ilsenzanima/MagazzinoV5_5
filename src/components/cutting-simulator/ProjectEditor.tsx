"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import type { DuctProject, Segment, StraightSegment, Elbow90Segment } from "@/lib/cutting-simulator/project-model";
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
    X, Trash2, Plus, CornerDownRight, RectangleHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    createStraightSegment,
    createElbow90Segment,
    type SegmentDirection,
} from "@/lib/cutting-simulator/project-model";

// ==================== VISTA LABELS ====================

const VIEW_LABELS: Record<ViewType, string> = {
    top: 'Dall\'Alto',
    front: 'Frontale',
    right: 'Laterale',
    iso: '3D',
};

const VIEW_ICONS: Record<ViewType, typeof Eye> = {
    top: Eye,
    front: Eye,
    right: Eye,
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

function DimensionLine({ x1, y1, x2, y2, label, offset = 30 }: {
    x1: number; y1: number; x2: number; y2: number; label: string; offset?: number;
}) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 10) return null;

    // Perpendicular offset
    const nx = -dy / len * offset;
    const ny = dx / len * offset;

    const ax = x1 + nx, ay = y1 + ny;
    const bx = x2 + nx, by = y2 + ny;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;

    return (
        <g className="dimension-line">
            {/* Extension lines */}
            <line x1={x1} y1={y1} x2={ax} y2={ay} stroke="hsl(var(--primary) / 0.4)" strokeWidth={0.5} />
            <line x1={x2} y1={y2} x2={bx} y2={by} stroke="hsl(var(--primary) / 0.4)" strokeWidth={0.5} />
            {/* Dimension line */}
            <line x1={ax} y1={ay} x2={bx} y2={by} stroke="hsl(var(--primary) / 0.6)" strokeWidth={0.8} markerStart="url(#arrow-start)" markerEnd="url(#arrow-end)" />
            {/* Label */}
            <text
                x={mx} y={my - 4}
                textAnchor="middle"
                className="fill-primary text-[10px] font-mono"
            >
                {label}
            </text>
        </g>
    );
}

// ==================== PANNELLO PROPRIETÀ ====================

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
    const [view, setView] = useState<ViewType>('top');
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
    const vbX = bbox.minX + (bbox.maxX - bbox.minX - vbW) / 2 - panOffset.x / zoom;
    const vbY = bbox.minY + (bbox.maxY - bbox.minY - vbH) / 2 - panOffset.y / zoom;
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // ==================== Info Tratti (Controllo Quote) ====================
    const tracksInfo = useMemo(() => {
        const tracks: { id: string, name: string, expected: number, actual: number, isMismatch: boolean }[] = [];
        let currentTrack: { id: string, name: string, expected: number } | null = null;
        let currentActual = 0;

        for (const seg of project.segments) {
            if (seg.type === 'trackSeparator') {
                if (currentTrack) {
                    tracks.push({ ...currentTrack, actual: currentActual, isMismatch: currentActual !== currentTrack.expected });
                }
                currentTrack = { id: seg.id, name: seg.name, expected: seg.expectedLength };
                currentActual = 0;
            } else if (currentTrack) {
                if (seg.type === 'straight') {
                    currentActual += seg.length;
                } else if (seg.type === 'elbow90') {
                    currentActual += seg.armA; // L'ingombro del gomito che "ruba" quota al tratto è il braccio A
                }
            }
        }
        if (currentTrack) {
            tracks.push({ ...currentTrack, actual: currentActual, isMismatch: currentActual !== currentTrack.expected });
        }
        return tracks;
    }, [project.segments]);

    // ==================== Handlers ====================

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.max(0.2, Math.min(5, z * factor)));
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            setIsPanning(true);
            panStart.current = { x: e.clientX, y: e.clientY, ox: panOffset.x, oy: panOffset.y };
        }
    }, [panOffset]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isPanning && panStart.current && svgRef.current) {
            const dx = e.clientX - panStart.current.x;
            const dy = e.clientY - panStart.current.y;

            // Calcolo proporzione per movimento coerente
            const rect = svgRef.current.getBoundingClientRect();
            // Il reale fattore di scala è dominato dalla dimensione che fitta il viewBox!
            const realScale = Math.max(vbW / rect.width, vbH / rect.height);

            setPanOffset({
                x: panStart.current.ox + dx * realScale,
                y: panStart.current.oy + dy * realScale
            });
        }
    }, [isPanning, vbW, vbH]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
        panStart.current = null;
    }, []);

    const handleSegmentClick = useCallback((idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIdx(prev => prev === idx ? null : idx);
    }, []);

    const handleCanvasClick = useCallback(() => {
        setSelectedIdx(null);
    }, []);

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
            <div className="flex items-center gap-2 p-2 border-b border-border/50 bg-muted/30">
                {/* Selettore vista */}
                <div className="flex gap-1 p-0.5 bg-muted/50 rounded-md">
                    {(['top', 'front', 'right', 'iso'] as ViewType[]).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={cn(
                                "px-2.5 py-1 text-xs font-medium rounded transition-all",
                                view === v
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {VIEW_LABELS[v]}
                        </button>
                    ))}
                </div>

                <div className="flex-1" />

                {/* Zoom controls e Slider Rotazione */}
                {view === 'iso' && (
                    <div className="flex items-center gap-2 mr-2">
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
                <span className="text-xs text-muted-foreground font-mono">{(zoom * 100).toFixed(0)}%</span>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoom(z => Math.min(5, z * 1.2))}>+</Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setZoom(z => Math.max(0.2, z / 1.2))}>−</Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleResetView}>
                    <Move className="h-3 w-3" /> Reset
                </Button>
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
                                className="fill-foreground text-[11px] font-mono pointer-events-none"
                                style={{ paintOrder: 'stroke', stroke: 'hsl(var(--background))', strokeWidth: 4, strokeLinejoin: 'round' }}
                            >
                                {node.label}
                            </text>

                            {/* Indice */}
                            <circle
                                cx={node.labelX + 12} cy={node.labelY + 12} r={8}
                                fill={node.color} opacity={0.8}
                            />
                            <text
                                x={node.labelX + 12} y={node.labelY + 12}
                                textAnchor="middle" dominantBaseline="central"
                                className="fill-white text-[8px] font-bold pointer-events-none"
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
                        />
                    );
                })}

                {/* Label vista */}
                <text
                    x={vbX + 10} y={vbY + 20}
                    className="fill-muted-foreground text-[12px] font-semibold pointer-events-none"
                    style={{ paintOrder: 'stroke', stroke: 'hsl(var(--background))', strokeWidth: 3, strokeLinejoin: 'round' }}
                >
                    Vista: {VIEW_LABELS[view]}
                </text>
            </svg>

            {/* Overlay Tratti (Tracks Info) */}
            {tracksInfo.length > 0 && (
                <div className="absolute bottom-4 right-4 bg-background/95 backdrop-blur-md p-3 rounded border border-border/50 shadow-sm min-w-[200px] z-10 pointer-events-none">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Verifica Tratti Rapidi</p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pointer-events-auto">
                        {tracksInfo.map(t => (
                            <div key={t.id} className="flex flex-col gap-0.5 text-[11px] bg-muted/40 p-2 rounded border border-border/30">
                                <span className="font-semibold text-foreground">{t.name}</span>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-muted-foreground">Teorica: {t.expected} mm</span>
                                    <span className={cn(
                                        "font-mono font-black",
                                        t.isMismatch ? "text-destructive" : "text-emerald-500"
                                    )}>
                                        Attuale: {t.actual} mm
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Pannello proprietà */}
            {selectedSegment && selectedIdx !== null && (
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

            {/* Istruzioni */}
            <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/60 pointer-events-none">
                Click pezzo = seleziona · Scroll = zoom · Alt+Drag = pan
            </div>
        </div>
    );
}
