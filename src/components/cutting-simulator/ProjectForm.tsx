"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    Plus, Trash2, ArrowDown, ArrowUp, ArrowLeft, ArrowRight,
    CornerDownRight, Ruler, GripVertical, Layers, ChevronDown, ChevronUp, FastForward, ChevronRight
} from "lucide-react";
import { SectionSidesSelector } from "@/components/cutting-simulator/SectionSidesSelector";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
    DuctProject, Segment, StraightSegment, Elbow90Segment, TrackSeparatorSegment,
    SectionProfile, SegmentDirection, SegmentOrientation,
} from "@/lib/cutting-simulator/project-model";
import {
    defaultProject, createStraightSegment, createElbow90Segment, createTrackSeparator,
    sidesLabel,
} from "@/lib/cutting-simulator/project-model";

interface ProjectFormProps {
    project: DuctProject;
    onProjectChange: React.Dispatch<React.SetStateAction<DuctProject>>;
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

export function ProjectForm({ project, onProjectChange, onCalculateProject }: ProjectFormProps) {
    const [collapsedTracks, setCollapsedTracks] = useState<Record<string, boolean>>({});
    const [sectionOpen, setSectionOpen] = useState(true);

    // --- Sezione ---

    const updateSection = useCallback((patch: Partial<SectionProfile>) => {
        onProjectChange(p => ({ ...p, section: { ...p.section, ...patch } }));
    }, [onProjectChange]);

    // --- Segmenti ---

    const addSegment = useCallback((seg: Segment) => {
        onProjectChange(p => ({ ...p, segments: [...p.segments, seg] }));
    }, [onProjectChange]);

    const removeSegment = useCallback((id: string) => {
        onProjectChange(p => ({ ...p, segments: p.segments.filter(s => s.id !== id) }));
    }, [onProjectChange]);

    const updateSegment = useCallback((id: string, patch: Partial<StraightSegment> | Partial<Elbow90Segment>) => {
        onProjectChange(p => ({
            ...p,
            segments: p.segments.map(s => s.id === id ? { ...s, ...patch } as Segment : s),
        }));
    }, [onProjectChange]);

    const moveSegment = useCallback((id: string, dir: 'up' | 'down') => {
        onProjectChange(p => {
            const idx = p.segments.findIndex(s => s.id === id);
            if (idx < 0) return p;
            const newIdx = dir === 'up' ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= p.segments.length) return p;
            // Prevent moving a regular segment outside its TrackSeparator group or before it
            if (p.segments[idx].type !== 'trackSeparator' && p.segments[newIdx].type === 'trackSeparator') return p;
            if (p.segments[idx].type === 'trackSeparator' && p.segments[newIdx].type !== 'trackSeparator') return p;

            const segs = [...p.segments];
            [segs[idx], segs[newIdx]] = [segs[newIdx], segs[idx]];
            return { ...p, segments: segs };
        });
    }, [onProjectChange]);

    const addEmptySegment = useCallback(() => {
        const existingTracksCount = project.segments.filter(s => s.type === 'trackSeparator').length;
        const trackLetter = String.fromCharCode(65 + existingTracksCount);
        addSegment(createTrackSeparator(1000, `SEGMENTO ${trackLetter}`));
    }, [project.segments, addSegment]);

    const addSegmentToGroup = useCallback((separatorIndex: number | null, itemsCount: number, newSeg: Segment) => {
        onProjectChange(p => {
            const segs = [...p.segments];
            const insertIndex = separatorIndex === null ? itemsCount : separatorIndex + 1 + itemsCount;
            segs.splice(insertIndex, 0, newSeg);
            // Assicurati che se aggiungiamo a un gruppo, non sia collassato
            if (separatorIndex !== null) {
                const sepId = segs[separatorIndex].id;
                setCollapsedTracks(prev => ({ ...prev, [sepId]: false }));
            }
            return { ...p, segments: segs };
        });
    }, [onProjectChange]);

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
                        <CardDescription>Definisci sezione e struttura, poi genera il piano di taglio</CardDescription>
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

                                {/* Tappo Frontale */}
                                <div className="space-y-1.5 pt-3 border-t border-border/50">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Tappo Frontale (Testa)</Label>
                                    <div className="flex gap-1">
                                        {(['none', 'inner', 'outer'] as const).map(c => (
                                            <button key={c} type="button"
                                                onClick={() => updateSection({ cap: c })}
                                                className={cn(
                                                    "px-2 py-1 text-xs rounded transition-all flex-1 border border-border/40",
                                                    sec.cap === c
                                                        ? "bg-primary text-primary-foreground font-medium border-primary"
                                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                                )}
                                            >
                                                {c === 'none' ? 'Nessuno' : c === 'inner' ? 'Interno' : 'Esterno'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* === IMPOSTAZIONI MISURE === */}
                    <div className="flex items-center justify-between bg-muted/20 p-3 rounded-lg border border-border/40">
                        <div className="space-y-0.5 pr-4">
                            <Label className="text-xs font-medium cursor-pointer" onClick={() => onProjectChange(p => ({ ...p, globalMeasurements: !p.globalMeasurements }))}>
                                Misure finite (globali)
                            </Label>
                            <p className="text-[10px] text-muted-foreground leading-tight">
                                Sottrae in automatico l'ingombro delle curve dai tratti dritti adiacenti
                            </p>
                        </div>
                        <button type="button"
                            onClick={() => onProjectChange(p => ({ ...p, globalMeasurements: !p.globalMeasurements }))}
                            className={cn(
                                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                                project.globalMeasurements ? "bg-primary" : "bg-input"
                            )}
                        >
                            <span className={cn(
                                "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                                project.globalMeasurements ? "translate-x-4" : "translate-x-0"
                            )} />
                        </button>
                    </div>

                    {/* === STRUTTURA === */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Isole nel Progetto ({project.segments.filter(s => s.type === 'trackSeparator').length})</p>
                            <Button type="button" onClick={addEmptySegment} size="sm" className="h-7 text-xs gap-1">
                                <Plus className="h-3 w-3" /> Crea Nuovo Segmento (Isola)
                            </Button>
                        </div>

                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                            {(() => {
                                const groupedSegments: {
                                    separator: TrackSeparatorSegment | null;
                                    separatorIndex: number | null;
                                    items: { seg: Segment; index: number }[];
                                }[] = [];

                                let currentGroup: {
                                    separator: TrackSeparatorSegment | null;
                                    separatorIndex: number | null;
                                    items: { seg: Segment; index: number }[];
                                } | null = null;

                                project.segments.forEach((seg, idx) => {
                                    if (seg.type === 'trackSeparator') {
                                        if (currentGroup) groupedSegments.push(currentGroup);
                                        currentGroup = { separator: seg as TrackSeparatorSegment, separatorIndex: idx, items: [] };
                                    } else {
                                        if (!currentGroup) {
                                            currentGroup = { separator: null, separatorIndex: null, items: [] };
                                        }
                                        currentGroup.items.push({ seg, index: idx });
                                    }
                                });
                                if (currentGroup) groupedSegments.push(currentGroup);

                                return groupedSegments.map((group, groupIdx) => {
                                    const sepId = group.separator?.id || `no-sep-${groupIdx}`;
                                    const isCollapsed = collapsedTracks[sepId] || false;

                                    return (
                                        <div key={sepId} className="border border-border/60 rounded-lg overflow-hidden bg-card/50 shadow-sm relative">
                                            {/* Header del Gruppo (Segmento/Isola) */}
                                            {group.separator && (
                                                <div className="bg-muted/40 px-3 py-2 flex items-center justify-between border-b border-border/40">
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground"
                                                            onClick={() => setCollapsedTracks(prev => ({ ...prev, [sepId]: !isCollapsed }))}
                                                        >
                                                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                                        </Button>
                                                        <div className="h-3 w-3 bg-primary/80 rounded block shadow-sm" />
                                                        <span className="text-xs font-bold uppercase tracking-wider">{group.separator.name}</span>
                                                        <span className="text-[10px] text-muted-foreground ml-2 px-1.5 py-0.5 bg-background rounded-md border border-border/50">
                                                            {group.items.length} tratti
                                                        </span>
                                                    </div>
                                                    <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive transition-colors"
                                                        onClick={() => removeSegment(sepId)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            )}

                                            {!isCollapsed && (
                                                <div className="p-2 space-y-2">
                                                    {/* Lista dei Tratti concatenati */}
                                                    {group.items.length > 0 ? (
                                                        <div className="space-y-1.5 relative">
                                                            {/* Barra visiva di concatenazione */}
                                                            <div className="absolute top-4 bottom-4 left-3 w-0.5 bg-primary/20 pointer-events-none" />

                                                            {group.items.map(({ seg, index }) => {
                                                                let deductionText = '';
                                                                if (project.globalMeasurements && seg.type === 'straight') {
                                                                    const prev = project.segments.slice(0, index).reverse().find(s => s.type !== 'trackSeparator');
                                                                    const next = project.segments.slice(index + 1).find(s => s.type !== 'trackSeparator');
                                                                    let deduction = 0;
                                                                    const outerWidth = project.section.innerWidth + (2 * project.section.thickness);
                                                                    if (prev && prev.type === 'elbow90') deduction += prev.armB + outerWidth;
                                                                    if (next && next.type === 'elbow90') deduction += next.armA + outerWidth;
                                                                    if (deduction > 0) {
                                                                        const actualLength = Math.max(0, seg.length - deduction);
                                                                        deductionText = `Taglio: ${actualLength} (-${deduction})`;
                                                                    }
                                                                }

                                                                return (
                                                                    <div key={seg.id} className="relative z-10 pl-6">
                                                                        {/* Pallino di congiunzione */}
                                                                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full border-[1.5px] border-primary/50 bg-background" />
                                                                        <SegmentRow
                                                                            segment={seg as StraightSegment | Elbow90Segment}
                                                                            index={index}
                                                                            total={project.segments.length}
                                                                            deductionText={deductionText}
                                                                            onUpdate={(patch) => updateSegment(seg.id, patch)}
                                                                            onRemove={() => removeSegment(seg.id)}
                                                                            onMove={(dir) => moveSegment(seg.id, dir)}
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[11px] text-muted-foreground text-center py-4 italic">
                                                            Nessun tratto in questo segmento.
                                                        </p>
                                                    )}

                                                    {/* Toolbar di aggiunta per QUESTO gruppo */}
                                                    <div className="mt-2 ml-6 space-y-2">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px] w-full border-dashed bg-background hover:bg-muted/50">
                                                                    <Plus className="h-3 w-3 mr-1" /> Aggiungi Tratto Singolo
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="start" className="w-48 border-border/40">
                                                                <DropdownMenuItem onClick={() => addSegmentToGroup(group.separatorIndex, group.items.length, createStraightSegment())} className="text-xs cursor-pointer">
                                                                    <Plus className="h-3 w-3 mr-1.5 opacity-70" /> Dritto
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => addSegmentToGroup(group.separatorIndex, group.items.length, createElbow90Segment())} className="text-xs cursor-pointer">
                                                                    <Plus className="h-3 w-3 mr-1.5 opacity-70" /> Angolo 90°
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                                                    <Plus className="h-3 w-3 mr-1.5 opacity-70" /> Tappo (Prossimamente)
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                                                                    <Plus className="h-3 w-3 mr-1.5 opacity-70" /> Raccordo (Prossimamente)
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <TrackGenerator
                                                            onGenerate={(segs) => {
                                                                // Usa timeout per evitare React render loop issue se si fan troppi update insieme
                                                                segs.forEach((s, idx) => {
                                                                    addSegmentToGroup(group.separatorIndex, group.items.length + idx, s);
                                                                });
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                });
                            })()}

                            {project.segments.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-6 border border-dashed rounded-lg">
                                    Nessun elemento. Clicca su "Crea Nuovo Segmento (Isola)".
                                </p>
                            )}
                        </div>
                    </div>

                    {/* === AZIONI === */}
                    <Button type="submit" className="w-full h-11 font-semibold" disabled={project.segments.length === 0}>
                        <Layers className="mr-2 h-4 w-4" />
                        Genera Piano di Taglio ({project.segments.length} elementi)
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

// ==================== Riga tratto ====================

function SegmentRow({
    segment, index, total, deductionText, onUpdate, onRemove, onMove,
}: {
    segment: Segment;
    index: number;
    total: number;
    deductionText?: string;
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
                    <StraightFields seg={segment as StraightSegment} deductionText={deductionText} onUpdate={onUpdate} />
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

function StraightFields({ seg, deductionText, onUpdate }: {
    seg: StraightSegment;
    deductionText?: string;
    onUpdate: (patch: Partial<StraightSegment>) => void;
}) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <Ruler className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="text-xs font-medium text-blue-400 shrink-0 w-12">Dritto</span>

                <div className="relative flex-1 min-w-[80px]">
                    <Input type="number" min="1" step="1"
                        value={seg.length}
                        onChange={e => onUpdate({ length: parseFloat(e.target.value) || 0 })}
                        className="h-7 text-xs font-mono pr-8 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
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

            {deductionText && (
                <div className="flex items-center gap-1 pl-[64px] animate-in slide-in-from-top-1 fade-in duration-300">
                    <CornerDownRight className="h-2.5 w-2.5 text-muted-foreground/60" />
                    <span className="text-[10px] text-muted-foreground/80 font-mono tracking-tight bg-muted/40 px-1 rounded">
                        {deductionText}
                    </span>
                </div>
            )}
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
            <div className="flex gap-2 pl-5 mt-1">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-muted-foreground">A:</span>
                    <div className="relative">
                        <Input type="number" min="1" step="1"
                            value={seg.armA}
                            onChange={e => onUpdate({ armA: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-[11px] font-mono w-[84px] pr-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">mm</span>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 border-l border-border/50 pl-2">
                    <span className="text-[10px] font-medium text-muted-foreground">B:</span>
                    <div className="relative">
                        <Input type="number" min="1" step="1"
                            value={seg.armB}
                            onChange={e => onUpdate({ armB: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-[11px] font-mono w-[84px] pr-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">mm</span>
                    </div>
                </div>
            </div>
        </div >
    );
}

// ==================== Generatore Tratti Concatenati ====================

function TrackGenerator({ onGenerate }: { onGenerate: (segments: Segment[]) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [trackLength, setTrackLength] = useState(10000);
    const [standardLength, setStandardLength] = useState(2500);
    const [hasElbow, setHasElbow] = useState(false);
    const [elbowDirection, setElbowDirection] = useState<SegmentDirection>('left');
    const [armA, setArmA] = useState(150);
    const [armB, setArmB] = useState(150);

    const handleGenerate = () => {
        let remainingLength = trackLength;
        const newSegments: Segment[] = [];

        // Sottrarre l'ingombro del gomito dalla lunghezza totale dei dritti
        if (hasElbow) {
            remainingLength = Math.max(0, remainingLength - armA);
        }

        const numStandard = Math.floor(remainingLength / standardLength);
        const remainder = remainingLength - (numStandard * standardLength);

        // Aggiungi dritti standard
        for (let i = 0; i < numStandard; i++) {
            const seg = createStraightSegment();
            seg.length = standardLength;
            newSegments.push(seg);
        }

        // Aggiungi il riempitivo
        if (remainder > 0) {
            const seg = createStraightSegment();
            seg.length = remainder;
            newSegments.push(seg);
        }

        // Aggiungi l'angolo
        if (hasElbow) {
            const elbow = createElbow90Segment();
            elbow.direction = elbowDirection;
            elbow.armA = armA;
            elbow.armB = armB;
            newSegments.push(elbow);
        }

        if (newSegments.length > 0) {
            onGenerate(newSegments);
            setIsOpen(false);
        }
    };

    return (
        <div className="border border-primary/30 rounded-lg overflow-hidden bg-primary/5">
            <button type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center gap-2 px-2 py-1.5 bg-primary/10 hover:bg-primary/20 transition-colors text-left"
            >
                <FastForward className="h-3.5 w-3.5 text-primary" />
                <span className="text-[11px] font-medium flex-1 text-primary">Genera successione di Tratti da Misura</span>
                {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-primary" /> : <ChevronDown className="h-3.5 w-3.5 text-primary" />}
            </button>

            {isOpen && (
                <div className="p-3 space-y-4 border-t border-primary/20">
                    <p className="text-xs text-muted-foreground">
                        Genera automaticamente i moduli dritti e la curva finale data una misura totale.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Misura Totale</Label>
                            <div className="relative">
                                <Input type="number" min="1" step="1"
                                    value={trackLength}
                                    onChange={e => setTrackLength(parseFloat(e.target.value) || 0)}
                                    className="h-8 text-xs pr-7 border-primary/30 focus-visible:ring-primary/50" />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">mm</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] text-muted-foreground uppercase">Modulo Standard</Label>
                            <div className="relative">
                                <Input type="number" min="1" step="1"
                                    value={standardLength}
                                    onChange={e => setStandardLength(parseFloat(e.target.value) || 0)}
                                    className="h-8 text-xs pr-7 border-primary/30" />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">mm</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-primary/20 space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-medium text-foreground cursor-pointer flex items-center gap-1"
                                onClick={() => setHasElbow(!hasElbow)}>
                                <CornerDownRight className="h-3 w-3 text-amber-500" />
                                Inserisci Curva alla fine
                            </Label>
                            <button type="button"
                                onClick={() => setHasElbow(!hasElbow)}
                                className={cn(
                                    "relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                                    hasElbow ? "bg-amber-500" : "bg-muted-foreground/30"
                                )}
                            >
                                <span className={cn(
                                    "pointer-events-none block h-3 w-3 rounded-full bg-background shadow-lg ring-0 transition-transform",
                                    hasElbow ? "translate-x-3" : "translate-x-0"
                                )} />
                            </button>
                        </div>

                        {hasElbow && (
                            <div className="p-2.5 bg-background rounded border border-border/50 space-y-2 animate-in fade-in slide-in-from-top-1">
                                <div className="space-y-1">
                                    <Label className="text-[9px] text-muted-foreground uppercase">Direzione Curva</Label>
                                    <div className="flex gap-1">
                                        {(['left', 'right', 'up', 'down'] as const).map(d => {
                                            const Icon = DIRECTION_ICONS[d];
                                            return (
                                                <button key={d} type="button"
                                                    onClick={() => setElbowDirection(d)}
                                                    title={DIRECTION_LABELS[d]}
                                                    className={cn(
                                                        "p-1.5 rounded transition-all flex-1 flex justify-center border",
                                                        elbowDirection === d
                                                            ? "bg-amber-500/20 text-amber-500 border-amber-500/30"
                                                            : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80"
                                                    )}
                                                >
                                                    <Icon className="h-3.5 w-3.5" />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                    <div className="space-y-1">
                                        <Label className="text-[9px] text-muted-foreground uppercase">Braccio A (Entrata)</Label>
                                        <div className="relative">
                                            <Input type="number" min="1" step="1"
                                                value={armA}
                                                onChange={e => setArmA(parseFloat(e.target.value) || 0)}
                                                className="h-7 text-[11px] font-mono pr-6" />
                                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">mm</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] text-muted-foreground uppercase">Braccio B (Uscita)</Label>
                                        <div className="relative">
                                            <Input type="number" min="1" step="1"
                                                value={armB}
                                                onChange={e => setArmB(parseFloat(e.target.value) || 0)}
                                                className="h-7 text-[11px] font-mono pr-6" />
                                            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">mm</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <Button type="button" onClick={handleGenerate} className="w-full h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
                        Inserisci sequenza nel Segmento
                    </Button>
                </div>
            )}
        </div>
    );
}
