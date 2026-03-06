"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    Plus, Trash2, ArrowDown, ArrowUp, ArrowLeft, ArrowRight,
    CornerDownRight, Ruler, GripVertical, Layers, ChevronDown, ChevronUp, FastForward, ChevronRight,
    AlertTriangle, CheckCircle2, Pin
} from "lucide-react";
import { SectionSidesSelector } from "@/components/cutting-simulator/SectionSidesSelector";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
    DuctProject, Segment, StraightSegment, Elbow90Segment, TrackSeparatorSegment,
    SectionProfile, SegmentDirection,
    ContextualElementSegment, ObstacleType, PendinoSegment
} from "@/lib/cutting-simulator/project-model";
import {
    defaultProject, createStraightSegment, createElbow90Segment, createTrackSeparator,
    createObstacleSegment, createPendinoSegment, sidesLabel,
} from "@/lib/cutting-simulator/project-model";

interface ProjectFormProps {
    project: DuctProject;
    onProjectChange: React.Dispatch<React.SetStateAction<DuctProject>>;
    onCalculateProject?: () => void;
    isRoutingMode?: boolean;
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

    const updateSegment = useCallback((id: string, patch: Partial<StraightSegment> | Partial<Elbow90Segment> | Partial<TrackSeparatorSegment> | Partial<ContextualElementSegment>) => {
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
        onCalculateProject?.();
    };

    // Calcola la lunghezza reale dai segmenti in un gruppo
    const computeTrackLength = useCallback((items: { seg: Segment }[]): number => {
        return items.reduce((sum, { seg }) => {
            if (seg.type === 'straight') return sum + seg.length;
            if (seg.type === 'obstacle') return sum + seg.thickness;
            if (seg.type === 'elbow90') return sum + seg.armA + seg.armB;
            return sum;
        }, 0);
    }, []);

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
                    {/* La sezione "Impostazioni di Sezione" (Largh, Alt, Spessore) è stata spostata globalmente nello Step 1 (Settings) di CuttingSimulatorClient */}

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

                    {/* === FASCE GIUNTI === */}
                    <div className="flex items-center justify-between bg-muted/20 p-3 rounded-lg border border-border/40">
                        <div className="space-y-0.5 pr-4">
                            <Label className="text-xs font-medium cursor-pointer" onClick={() => onProjectChange(p => ({ ...p, jointBands: !p.jointBands }))}>
                                Fasce Giunti
                            </Label>
                            <p className="text-[10px] text-muted-foreground leading-tight">
                                Aggiunge 4 fasce per ogni giunto tra pezzi dritti (avvolgono l'esterno della canala)
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {project.jointBands && (
                                <div className="relative">
                                    <Input type="number" min="50" max="300" step="10"
                                        value={project.jointBandWidth || 100}
                                        onChange={e => onProjectChange(p => ({ ...p, jointBandWidth: parseFloat(e.target.value) || 100 }))}
                                        className="h-6 w-16 text-[10px] pr-6 py-0 border-border/40" />
                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">mm</span>
                                </div>
                            )}
                            <button type="button"
                                onClick={() => onProjectChange(p => ({ ...p, jointBands: !p.jointBands }))}
                                className={cn(
                                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                                    project.jointBands ? "bg-primary" : "bg-input"
                                )}
                            >
                                <span className={cn(
                                    "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                                    project.jointBands ? "translate-x-4" : "translate-x-0"
                                )} />
                            </button>
                        </div>
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

                                    // Calcolo sotto-tratti: le curve separano i sotto-tratti
                                    type SubTrack = { items: { seg: Segment; index: number }[]; expectedLength: number; sourceId: string; field: string; label: string };
                                    const subTracks: SubTrack[] = [];
                                    let curItems: { seg: Segment; index: number }[] = [];
                                    let stIdx = 0;
                                    for (const item of group.items) {
                                        if (item.seg.type === 'elbow90') {
                                            subTracks.push({ items: curItems, expectedLength: stIdx === 0 ? (group.separator?.expectedLength || 0) : 0, sourceId: stIdx === 0 ? sepId : '', field: stIdx === 0 ? 'expectedLength' : '', label: `Sotto-tratto ${String.fromCharCode(65 + stIdx)}` });
                                            stIdx++;
                                            curItems = [];
                                            subTracks.push({ items: [], expectedLength: (item.seg as Elbow90Segment).expectedLengthAfter || 0, sourceId: item.seg.id, field: 'expectedLengthAfter', label: `Sotto-tratto ${String.fromCharCode(65 + stIdx)}` });
                                        } else {
                                            curItems.push(item);
                                        }
                                    }
                                    if (subTracks.length === 0) {
                                        subTracks.push({ items: curItems, expectedLength: group.separator?.expectedLength || 0, sourceId: sepId, field: 'expectedLength', label: 'Tratto' });
                                    } else if (curItems.length > 0) {
                                        subTracks[subTracks.length - 1].items = curItems;
                                    }
                                    const visibleSTs = subTracks.filter(st => st.items.length > 0);

                                    return (
                                        <div key={sepId} className="border border-border/60 rounded-lg overflow-hidden bg-card/50 shadow-sm relative">
                                            {/* Header del Gruppo (Segmento/Isola) */}
                                            {group.separator && (
                                                <div className="bg-muted/40 px-3 py-2 flex flex-col gap-1.5 border-b border-border/40">
                                                    <div className="flex items-center justify-between">
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
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] text-muted-foreground uppercase">Sp:</span>
                                                                <div className="relative">
                                                                    <Input type="number" min="0" step="0.5"
                                                                        placeholder={`${project.section.thickness}`}
                                                                        value={group.separator?.thicknessOverride ?? ''}
                                                                        onChange={e => {
                                                                            const v = e.target.value;
                                                                            updateSegment(sepId, { thicknessOverride: v === '' ? undefined : (parseFloat(v) || 0) } as any);
                                                                        }}
                                                                        className="h-7 w-20 text-xs pr-7 py-0 border-border/40 bg-background/50" />
                                                                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">mm</span>
                                                                </div>
                                                            </div>
                                                            <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive transition-colors"
                                                                onClick={() => removeSegment(sepId)}>
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Badge Misure per ogni sotto-tratto */}
                                                    {visibleSTs.map((st, i) => {
                                                        const rl = computeTrackLength(st.items);
                                                        const el = st.expectedLength;
                                                        const dd = el > 0 ? rl - el : 0;
                                                        const hw = el > 0 && Math.abs(dd) > 1;
                                                        const io = dd > 0;
                                                        return (
                                                            <div key={`st-${i}`} className={cn(
                                                                "flex items-center gap-2 px-2 py-1 rounded text-[10px] font-mono",
                                                                !hw && el > 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                                    : hw && io ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                                                        : hw ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                                            : "bg-muted/30 text-muted-foreground border border-border/30"
                                                            )}>
                                                                {hw ? <AlertTriangle className="h-3 w-3 shrink-0" />
                                                                    : el > 0 ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : null}
                                                                <span className="flex-1 truncate">
                                                                    {visibleSTs.length > 1 && <strong className="mr-1">{st.label}:</strong>}
                                                                    <strong>{rl.toFixed(0)}</strong>
                                                                    {el > 0 && <> / {el.toFixed(0)} mm{hw && <span className="font-bold ml-1">({io ? '+' : ''}{dd.toFixed(0)})</span>}</>}
                                                                </span>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <span className="text-[10px] opacity-60">Att:</span>
                                                                    <div className="relative">
                                                                        <Input type="number" min="0" step="1"
                                                                            value={st.expectedLength || 0}
                                                                            onChange={e => updateSegment(st.sourceId, { [st.field]: parseFloat(e.target.value) || 0 } as any)}
                                                                            className="h-7 w-24 text-xs pr-7 py-0 border-border/40 bg-background/50" />
                                                                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">mm</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )
                                            }

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
                                                                    <Plus className="h-3 w-3 mr-1" /> Aggiungi Tratto
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="start" className="w-48 border-border/40">
                                                                <DropdownMenuItem onClick={() => addSegmentToGroup(group.separatorIndex, group.items.length, createStraightSegment())} className="text-xs cursor-pointer">
                                                                    <Plus className="h-3 w-3 mr-1.5 opacity-70" /> Dritto
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => addSegmentToGroup(group.separatorIndex, group.items.length, createElbow90Segment())} className="text-xs cursor-pointer">
                                                                    <Plus className="h-3 w-3 mr-1.5 opacity-70" /> Angolo 90°
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => {
                                                                    let len = 0;
                                                                    let lastStraightIdx = -1;
                                                                    for (let i = group.items.length - 1; i >= 0; i--) {
                                                                        const s = group.items[i];
                                                                        if (s.seg.type === 'straight') {
                                                                            len += s.seg.length;
                                                                            if (lastStraightIdx === -1) lastStraightIdx = i;
                                                                        }
                                                                        else if (s.seg.type !== 'obstacle') break;
                                                                    }
                                                                    const obs = createObstacleSegment('wall', project.section.innerWidth, project.section.innerHeight, len);
                                                                    if (lastStraightIdx !== -1) {
                                                                        updateSegment(group.items[lastStraightIdx].seg.id, { length: (group.items[lastStraightIdx].seg as import('@/lib/cutting-simulator/project-model').StraightSegment).length + obs.thickness });
                                                                    } else {
                                                                        addSegmentToGroup(group.separatorIndex, group.items.length, createStraightSegment(obs.thickness));
                                                                    }
                                                                    addSegmentToGroup(group.separatorIndex, group.items.length, obs);
                                                                }} className="text-xs cursor-pointer">
                                                                    <Plus className="h-3 w-3 mr-1.5 opacity-70" /> Muro
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => {
                                                                    let len = 0;
                                                                    let lastStraightIdx = -1;
                                                                    for (let i = group.items.length - 1; i >= 0; i--) {
                                                                        const s = group.items[i];
                                                                        if (s.seg.type === 'straight') {
                                                                            len += s.seg.length;
                                                                            if (lastStraightIdx === -1) lastStraightIdx = i;
                                                                        }
                                                                        else if (s.seg.type !== 'obstacle') break;
                                                                    }
                                                                    const obs = createObstacleSegment('floor', project.section.innerWidth, project.section.innerHeight, len);
                                                                    if (lastStraightIdx !== -1) {
                                                                        updateSegment(group.items[lastStraightIdx].seg.id, { length: (group.items[lastStraightIdx].seg as import('@/lib/cutting-simulator/project-model').StraightSegment).length + obs.thickness });
                                                                    } else {
                                                                        addSegmentToGroup(group.separatorIndex, group.items.length, createStraightSegment(obs.thickness));
                                                                    }
                                                                    addSegmentToGroup(group.separatorIndex, group.items.length, obs);
                                                                }} className="text-xs cursor-pointer">
                                                                    <Plus className="h-3 w-3 mr-1.5 opacity-70" /> Solaio
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => {
                                                                    let len = 0;
                                                                    let lastStraightIdx = -1;
                                                                    for (let i = group.items.length - 1; i >= 0; i--) {
                                                                        const s = group.items[i];
                                                                        if (s.seg.type === 'straight') {
                                                                            len += s.seg.length;
                                                                            if (lastStraightIdx === -1) lastStraightIdx = i;
                                                                        }
                                                                        else if (s.seg.type !== 'obstacle') break;
                                                                    }
                                                                    const obs = createObstacleSegment('column', project.section.innerWidth, project.section.innerHeight, len);
                                                                    if (lastStraightIdx !== -1) {
                                                                        updateSegment(group.items[lastStraightIdx].seg.id, { length: (group.items[lastStraightIdx].seg as import('@/lib/cutting-simulator/project-model').StraightSegment).length + obs.thickness });
                                                                    } else {
                                                                        addSegmentToGroup(group.separatorIndex, group.items.length, createStraightSegment(obs.thickness));
                                                                    }
                                                                    addSegmentToGroup(group.separatorIndex, group.items.length, obs);
                                                                }} className="text-xs cursor-pointer">
                                                                    <Plus className="h-3 w-3 mr-1.5 opacity-70" /> Pilastro/Ostacolo
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => addSegmentToGroup(group.separatorIndex, group.items.length, createPendinoSegment())} className="text-xs cursor-pointer">
                                                                    <Pin className="h-3 w-3 mr-1.5 opacity-70" /> Pendino
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
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
        </Card >
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
    onUpdate: (patch: Partial<StraightSegment> | Partial<Elbow90Segment> | Partial<ContextualElementSegment>) => void;
    onRemove: () => void;
    onMove: (dir: 'up' | 'down') => void;
}) {
    const isStraight = segment.type === 'straight';
    const isObstacle = segment.type === 'obstacle';
    const isPendino = segment.type === 'pendino';
    const accent = isStraight ? 'border-l-blue-500' : isObstacle ? 'border-l-purple-500' : isPendino ? 'border-l-green-500' : 'border-l-amber-500';

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
                    <StraightFields seg={segment as StraightSegment} deductionText={deductionText} onUpdate={onUpdate as any} />
                ) : isObstacle ? (
                    <ObstacleFields seg={segment as ContextualElementSegment} onUpdate={onUpdate as any} />
                ) : isPendino ? (
                    <PendinoFields seg={segment as PendinoSegment} onUpdate={onUpdate as any} />
                ) : (
                    <ElbowFields seg={segment as Elbow90Segment} onUpdate={onUpdate as any} />
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

// ==================== Ostacolo/Muro/Solaio ====================

function ObstacleFields({ seg, onUpdate }: {
    seg: ContextualElementSegment;
    onUpdate: (patch: Partial<ContextualElementSegment>) => void;
}) {
    const typeLabel = seg.obstacleType === 'wall' ? 'Muro' : seg.obstacleType === 'floor' ? 'Solaio' : 'Ostacolo';

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <div className="p-1 rounded bg-purple-500/20 text-purple-400">
                    <Layers className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-semibold text-purple-400 w-16">{typeLabel}</span>

                <div className="flex items-center gap-1.5 flex-1 max-w-[120px]">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Spessore:</span>
                    <div className="relative flex-1">
                        <Input type="number" min="1" step="1"
                            value={seg.thickness}
                            onChange={e => onUpdate({ thickness: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs font-mono pr-6 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">mm</span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-[1.5] min-w-[120px]">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Dist. Inizio:</span>
                    <div className="relative flex-1">
                        <Input type="number" min="0" step="1"
                            value={seg.distanceFromStart ?? 0}
                            onChange={e => onUpdate({ distanceFromStart: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs font-mono pr-6 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">mm</span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-1 max-w-[100px]">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Base:</span>
                    <div className="relative flex-1">
                        <Input type="number" min="1" step="1"
                            value={seg.width}
                            onChange={e => onUpdate({ width: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs font-mono pr-6 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">mm</span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-1 max-w-[100px]">
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">Altezza:</span>
                    <div className="relative flex-1">
                        <Input type="number" min="1" step="1"
                            value={seg.height}
                            onChange={e => onUpdate({ height: parseFloat(e.target.value) || 0 })}
                            className="h-7 text-xs font-mono pr-6 w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground">mm</span>
                    </div>
                </div>

                <div className="flex items-center gap-1 ml-auto">
                    <Label className="text-[10px] text-muted-foreground mr-1 cursor-pointer" onClick={() => onUpdate({ showQuotas: !seg.showQuotas })}>
                        Quote
                    </Label>
                    <button type="button"
                        onClick={() => onUpdate({ showQuotas: !seg.showQuotas })}
                        className={cn(
                            "relative inline-flex h-4 w-7 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
                            seg.showQuotas ? "bg-purple-500" : "bg-input"
                        )}
                    >
                        <span className={cn(
                            "pointer-events-none block h-3 w-3 rounded-full bg-background shadow-lg ring-0 transition-transform",
                            seg.showQuotas ? "translate-x-3.5" : "translate-x-0"
                        )} />
                    </button>
                </div>
            </div>

            {seg.showQuotas && (
                <div className="grid grid-cols-2 gap-2 pl-8 pt-1 border-t border-border/40 animate-in fade-in slide-in-from-top-1">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground w-10">Sinistra:</span>
                        <Input type="number" placeholder="-" value={seg.quotaLeft || ''} onChange={e => onUpdate({ quotaLeft: parseFloat(e.target.value) || undefined })} className="h-6 text-[10px] pr-0 w-16" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground w-10">Destra:</span>
                        <Input type="number" placeholder="-" value={seg.quotaRight || ''} onChange={e => onUpdate({ quotaRight: parseFloat(e.target.value) || undefined })} className="h-6 text-[10px] pr-0 w-16" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground w-10">Alto:</span>
                        <Input type="number" placeholder="-" value={seg.quotaTop || ''} onChange={e => onUpdate({ quotaTop: parseFloat(e.target.value) || undefined })} className="h-6 text-[10px] pr-0 w-16" />
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground w-10">Basso:</span>
                        <Input type="number" placeholder="-" value={seg.quotaBottom || ''} onChange={e => onUpdate({ quotaBottom: parseFloat(e.target.value) || undefined })} className="h-6 text-[10px] pr-0 w-16" />
                    </div>
                </div>
            )}
        </div>
    );
}


// ==================== Pendino ====================

function PendinoFields({ seg, onUpdate }: {
    seg: PendinoSegment;
    onUpdate: (patch: Partial<PendinoSegment>) => void;
}) {
    return (
        <div className="flex items-center gap-2">
            <Pin className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span className="text-xs font-medium text-green-400">Pendino</span>
            <Input
                placeholder="Nota (opzionale)"
                value={seg.note || ''}
                onChange={e => onUpdate({ note: e.target.value })}
                className="h-5 flex-1 text-[9px] py-0 border-border/40 bg-background/50"
            />
        </div>
    );
}
