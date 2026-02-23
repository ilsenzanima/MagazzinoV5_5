"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    Plus, Trash2, ArrowDown, ArrowUp, ArrowLeft, ArrowRight,
    CornerDownRight, Ruler, GripVertical, Layers, ChevronDown, ChevronUp,
} from "lucide-react";
import { SectionSidesSelector } from "@/components/cutting-simulator/SectionSidesSelector";
import type {
    DuctProject, Segment, StraightSegment, Elbow90Segment,
    SectionProfile, SegmentDirection, SegmentOrientation,
} from "@/lib/cutting-simulator/project-model";
import {
    defaultProject, createStraightSegment, createElbow90Segment,
    sidesLabel,
} from "@/lib/cutting-simulator/project-model";

interface ProjectFormProps {
    onCalculateProject: (project: DuctProject) => void;
}

const DIRECTION_ICONS: Record<SegmentDirection, typeof ArrowRight> = {
    right: ArrowRight,
    left: ArrowLeft,
    up: ArrowUp,
    down: ArrowDown,
};
const DIRECTION_LABELS: Record<SegmentDirection, string> = {
    right: 'Destra', left: 'Sinistra', up: 'Sopra', down: 'Sotto',
};
const ORIENTATION_LABELS: Record<SegmentOrientation, string> = {
    horizontal: 'Orizzontale', vertical: 'Verticale',
};

export function ProjectForm({ onCalculateProject }: ProjectFormProps) {
    const [project, setProject] = useState<DuctProject>(defaultProject);
    const [sectionOpen, setSectionOpen] = useState(true);

    // --- Sezione ---

    const updateSection = useCallback((patch: Partial<SectionProfile>) => {
        setProject(p => ({ ...p, section: { ...p.section, ...patch } }));
    }, []);

    // --- Segmenti ---

    const addSegment = useCallback((seg: Segment) => {
        setProject(p => ({ ...p, segments: [...p.segments, seg] }));
    }, []);

    const removeSegment = useCallback((id: string) => {
        setProject(p => ({ ...p, segments: p.segments.filter(s => s.id !== id) }));
    }, []);

    const updateSegment = useCallback((id: string, patch: Partial<StraightSegment> | Partial<Elbow90Segment>) => {
        setProject(p => ({
            ...p,
            segments: p.segments.map(s => s.id === id ? { ...s, ...patch } as Segment : s),
        }));
    }, []);

    const moveSegment = useCallback((id: string, dir: 'up' | 'down') => {
        setProject(p => {
            const idx = p.segments.findIndex(s => s.id === id);
            if (idx < 0) return p;
            const newIdx = dir === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= p.segments.length) return p;
            const segs = [...p.segments];
            [segs[idx], segs[newIdx]] = [segs[newIdx], segs[idx]];
            return { ...p, segments: segs };
        });
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCalculateProject(project);
    };

    const sec = project.section;

    return (
        <Card className="border-border/60 shadow-lg bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Layers className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-lg">Progetto Canalizzazione</CardTitle>
                        <CardDescription>Definisci sezione e segmenti, poi genera il piano di taglio</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* === SEZIONE === */}
                    <div className="border border-border/50 rounded-lg overflow-hidden">
                        <button type="button"
                            onClick={() => setSectionOpen(!sectionOpen)}
                            className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                        >
                            <Ruler className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium flex-1">
                                Sezione: {sec.innerWidth}×{sec.innerHeight} mm — sp. {sec.thickness} — {sidesLabel(sec.sides)}
                            </span>
                            {sectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>

                        {sectionOpen && (
                            <div className="p-3 space-y-3">
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Largh.</Label>
                                        <div className="relative">
                                            <Input type="number" min="1" step="1"
                                                value={sec.innerWidth}
                                                onChange={e => updateSection({ innerWidth: parseFloat(e.target.value) || 0 })}
                                                className="h-9 text-sm font-mono pr-10" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">mm</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Altezza</Label>
                                        <div className="relative">
                                            <Input type="number" min="1" step="1"
                                                value={sec.innerHeight}
                                                onChange={e => updateSection({ innerHeight: parseFloat(e.target.value) || 0 })}
                                                className="h-9 text-sm font-mono pr-10" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">mm</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Spessore</Label>
                                        <div className="relative">
                                            <Input type="number" min="0" step="0.5"
                                                value={sec.thickness}
                                                onChange={e => updateSection({ thickness: parseFloat(e.target.value) || 0 })}
                                                className="h-9 text-sm font-mono pr-10" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">mm</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Selettore lati */}
                                <SectionSidesSelector
                                    innerWidth={sec.innerWidth}
                                    innerHeight={sec.innerHeight}
                                    thickness={sec.thickness}
                                    sides={sec.sides}
                                    onChange={sides => updateSection({ sides })}
                                />
                            </div>
                        )}
                    </div>

                    {/* === SEGMENTI === */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Segmenti ({project.segments.length})</p>
                            <div className="flex gap-1">
                                <Button type="button" variant="outline" size="sm"
                                    onClick={() => addSegment(createStraightSegment())}
                                    className="h-7 text-xs gap-1"
                                >
                                    <Plus className="h-3 w-3" /> Dritto
                                </Button>
                                <Button type="button" variant="outline" size="sm"
                                    onClick={() => addSegment(createElbow90Segment())}
                                    className="h-7 text-xs gap-1"
                                >
                                    <Plus className="h-3 w-3" /> Angolo 90°
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                            {project.segments.map((seg, idx) => (
                                <SegmentRow
                                    key={seg.id}
                                    segment={seg}
                                    index={idx}
                                    total={project.segments.length}
                                    onUpdate={(patch) => updateSegment(seg.id, patch)}
                                    onRemove={() => removeSegment(seg.id)}
                                    onMove={(dir) => moveSegment(seg.id, dir)}
                                />
                            ))}
                            {project.segments.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                                    Nessun segmento. Aggiungi un tratto dritto o un angolo.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* === AZIONI === */}
                    <Button type="submit" className="w-full h-11 font-semibold" disabled={project.segments.length === 0}>
                        <Layers className="mr-2 h-4 w-4" />
                        Genera Piano di Taglio ({project.segments.length} segmenti)
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

// ==================== Riga segmento ====================

function SegmentRow({
    segment, index, total, onUpdate, onRemove, onMove,
}: {
    segment: Segment;
    index: number;
    total: number;
    onUpdate: (patch: Partial<StraightSegment> | Partial<Elbow90Segment>) => void;
    onRemove: () => void;
    onMove: (dir: 'up' | 'down') => void;
}) {
    const isStraight = segment.type === 'straight';
    const accent = isStraight ? 'border-l-blue-500' : 'border-l-amber-500';

    return (
        <div className={cn(
            "flex items-center gap-1.5 p-2 rounded-lg bg-muted/20 border border-border/40 border-l-[3px]",
            accent
        )}>
            {/* Ordine */}
            <div className="flex flex-col items-center gap-0.5">
                <button type="button" onClick={() => onMove('up')} disabled={index === 0}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity">
                    <ChevronUp className="h-3 w-3" />
                </button>
                <span className="text-[10px] text-muted-foreground font-mono w-4 text-center">{index + 1}</span>
                <button type="button" onClick={() => onMove('down')} disabled={index === total - 1}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-opacity">
                    <ChevronDown className="h-3 w-3" />
                </button>
            </div>

            {/* Contenuto */}
            <div className="flex-1 min-w-0">
                {isStraight ? (
                    <StraightFields seg={segment as StraightSegment} onUpdate={onUpdate} />
                ) : (
                    <ElbowFields seg={segment as Elbow90Segment} onUpdate={onUpdate} />
                )}
            </div>

            {/* Elimina */}
            <button type="button" onClick={onRemove}
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    );
}

// ==================== Tratto Dritto ====================

function StraightFields({ seg, onUpdate }: {
    seg: StraightSegment;
    onUpdate: (patch: Partial<StraightSegment>) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <Ruler className="h-3.5 w-3.5 text-blue-400 shrink-0" />
            <span className="text-xs font-medium text-blue-400 shrink-0 w-12">Dritto</span>

            <div className="relative flex-1 max-w-[120px]">
                <Input type="number" min="1" step="1"
                    value={seg.length}
                    onChange={e => onUpdate({ length: parseFloat(e.target.value) || 0 })}
                    className="h-7 text-xs font-mono pr-8" />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">mm</span>
            </div>

            {/* Orientamento */}
            <div className="flex gap-0.5">
                {(['horizontal', 'vertical'] as const).map(o => (
                    <button key={o} type="button"
                        onClick={() => onUpdate({ orientation: o })}
                        className={cn(
                            "px-1.5 py-0.5 text-[9px] rounded transition-all",
                            seg.orientation === o
                                ? "bg-blue-500/20 text-blue-300 font-medium"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {o === 'horizontal' ? 'Oriz.' : 'Vert.'}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ==================== Angolo 90° ====================

function ElbowFields({ seg, onUpdate }: {
    seg: Elbow90Segment;
    onUpdate: (patch: Partial<Elbow90Segment>) => void;
}) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <CornerDownRight className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                <span className="text-xs font-medium text-amber-400 shrink-0">Angolo</span>

                {/* Direzione */}
                <div className="flex gap-0.5">
                    {(['left', 'right', 'up', 'down'] as const).map(d => {
                        const Icon = DIRECTION_ICONS[d];
                        return (
                            <button key={d} type="button"
                                onClick={() => onUpdate({ direction: d })}
                                title={DIRECTION_LABELS[d]}
                                className={cn(
                                    "p-1 rounded transition-all",
                                    seg.direction === d
                                        ? "bg-amber-500/20 text-amber-300"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Icon className="h-3 w-3" />
                            </button>
                        );
                    })}
                </div>

                {/* Base mode */}
                <div className="flex gap-0.5 ml-auto">
                    {(['split', 'single'] as const).map(m => (
                        <button key={m} type="button"
                            onClick={() => onUpdate({ baseMode: m })}
                            className={cn(
                                "px-1.5 py-0.5 text-[9px] rounded transition-all",
                                seg.baseMode === m
                                    ? "bg-amber-500/20 text-amber-300 font-medium"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {m === 'split' ? 'Sep.' : 'Unica'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bracci */}
            <div className="flex gap-2 pl-5">
                <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">A:</span>
                    <div className="relative">
                        <Input type="number" min="1" step="1"
                            value={seg.armA}
                            onChange={e => onUpdate({ armA: parseFloat(e.target.value) || 0 })}
                            className="h-6 text-[11px] font-mono w-[80px] pr-7" />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">mm</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">B:</span>
                    <div className="relative">
                        <Input type="number" min="1" step="1"
                            value={seg.armB}
                            onChange={e => onUpdate({ armB: parseFloat(e.target.value) || 0 })}
                            className="h-6 text-[11px] font-mono w-[80px] pr-7" />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">mm</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
