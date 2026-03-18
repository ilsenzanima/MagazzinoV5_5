"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { ProjectForm } from "@/components/cutting-simulator/ProjectForm";
import { ProjectEditor } from "@/components/cutting-simulator/ProjectEditor";
import { CutPlanViewer } from "@/components/cutting-simulator/CutPlanViewer";
import { SheetConfigForm } from "@/components/cutting-simulator/SheetConfigForm";
import { TracksAnalysisPanel } from "@/components/cutting-simulator/TracksAnalysisPanel";
import { PiecesList } from "@/components/cutting-simulator/PiecesList";
import {
    calculateProject,
    explodePieces,
    type CalculationResult,
} from "@/lib/cutting-simulator/calculations";
import type { DuctProject } from "@/lib/cutting-simulator/project-model";
import { defaultProject, migrateProject } from "@/lib/cutting-simulator/project-model";
import { nestPieces, type SheetConfig, type NestingResult } from "@/lib/cutting-simulator/nesting";
import { Scissors, Sparkles, RectangleHorizontal, CornerDownRight, Layers, LayoutGrid, List, PenTool, MousePointer2, Pin, PencilRuler, ArrowRight, LayoutTemplate, Image, Eye, EyeOff, RotateCcw, Maximize, Move } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SectionSidesSelector } from "@/components/cutting-simulator/SectionSidesSelector";

// Tipi non più necessari in questo componente
// type ViewMode = "single" | "project";
// type PieceType = "straight" | "elbow90" | "flatPieces";

// Helper function for initial project state
const createInitialProject = () => migrateProject({
    ...defaultProject(),
    name: "Nuovo Progetto",
    description: "Progetto di esempio per la simulazione di taglio",
} as DuctProject);

export default function CuttingSimulatorClient() {
    const params = useParams();
    // Project workflow step
    const [projectStep, setProjectStep] = useState<"settings" | "routing" | "engineering" | "nesting">("settings");

    // Form states
    const [project, setProject] = useState<DuctProject>(createInitialProject());
    const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
    const [nestingResult, setNestingResult] = useState<NestingResult | null>(null);
    const [sheetConfig, setSheetConfig] = useState<SheetConfig>({
        width: 2500,
        height: 1200,
        gap: 5,
    });

    const runNesting = useCallback((result: CalculationResult, config: SheetConfig) => {
        const exploded = explodePieces(result.pieces);
        const nesting = nestPieces(exploded, config);
        setNestingResult(nesting);
    }, []);



    const handleCalculateProject = useCallback(
        (project: DuctProject) => {
            const result = calculateProject(project);
            setCalcResult(result);
            runNesting(result, sheetConfig);
        },
        [sheetConfig, runNesting]
    );

    const handleSheetConfigChange = useCallback(
        (newConfig: SheetConfig) => {
            setSheetConfig(newConfig);
            if (calcResult) {
                runNesting(calcResult, newConfig);
            }
        },
        [calcResult, runNesting]
    );



    const handleProjectPropChange = useCallback((key: keyof DuctProject, value: any) => {
        setProject(prev => ({ ...prev, [key]: value }));
    }, []);

    // isEditorFullscreen = viewMode === "project" && projectStep !== "settings";
    // Ora gestiamo lo spazio al 100% dell'altezza viewport per tutto l'editor (100dvh).
    return (
        <div className="w-full h-[100dvh] flex flex-col bg-background overflow-hidden text-foreground border-none m-0 p-0">
            {/* TOP BAR / HEADER COMPATTO (Sempre Visibile) */}
            <div className="h-14 border-b border-border/50 bg-background flex items-center justify-between px-4 shrink-0 shadow-sm z-10 w-full">
                <div className="flex items-center gap-3">
                    <a href={`/disegno-taglio/${params.id}`} className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-500">
                        <ArrowRight className="h-5 w-5 rotate-180" />
                    </a>
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-blue-600/10 text-blue-600">
                            <Scissors className="h-4 w-4" />
                        </div>
                        <h1 className="text-lg font-semibold tracking-tight text-slate-800">
                            Editor Progetto: {project.name}
                        </h1>
                    </div>
                </div>

                {/* Stepper del Progetto integrato nell'header */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg gap-0.5 shadow-inner border border-slate-200">
                    {[
                        { id: "settings", label: "Parametri", icon: PencilRuler },
                        { id: "routing", label: "Tracciato", icon: Pin },
                        { id: "engineering", label: "Dettaglio", icon: Scissors },
                        { id: "nesting", label: "Nesting", icon: LayoutTemplate }
                    ].map(step => {
                        const Icon = step.icon;
                        const isActive = projectStep === step.id;
                        return (
                            <button
                                key={step.id}
                                onClick={() => setProjectStep(step.id as any)}
                                className={cn(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-tight transition-all",
                                    isActive
                                        ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
                                        : "text-slate-500 hover:text-slate-800"
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" />
                                <span className="hidden lg:block">{step.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Contenuto principale */}
            <div className="flex-1 flex flex-col overflow-hidden w-full mx-auto relative px-2 sm:px-4 lg:px-6 py-4 gap-4">

            {/* AREA CONTENUTO CENTRALE CON SCROLL (Solo questo sckrollerà) */}
            <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center pb-8 scrollbar-hide sm:scrollbar-default">


                    {/* ===== VISTA PROGETTO ===== */}
                    {projectStep === "settings" && (
                        <div className="w-full max-w-2xl mt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <Card className="border-border shadow-sm bg-card">
                                <CardHeader className="pb-4 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-md bg-blue-50">
                                            <Layers className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg font-semibold text-slate-800">Parametri Globali Progetto</CardTitle>
                                            <CardDescription className="text-sm mt-0.5">
                                                Imposta le dimensioni della canala e lo spessore delle lastre per tutto il tracciato.
                                            </CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6 pt-6 bg-muted/50">
                                    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Base Interna (mm)</Label>
                                                <Input
                                                    type="number"
                                                    value={project.section.innerWidth}
                                                    onChange={(e) => handleProjectPropChange('section', { ...project.section, innerWidth: Number(e.target.value) })}
                                                    min={100} max={3000} step={50}
                                                    className="h-12 border-border text-base font-medium focus-visible:ring-primary shadow-inner bg-background"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Altezza Interna (mm)</Label>
                                                <Input
                                                    type="number"
                                                    value={project.section.innerHeight}
                                                    onChange={(e) => handleProjectPropChange('section', { ...project.section, innerHeight: Number(e.target.value) })}
                                                    min={100} max={3000} step={50}
                                                    className="h-12 border-border text-base font-medium focus-visible:ring-primary shadow-inner bg-background"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2 pt-5 mt-5 border-t border-slate-100">
                                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                                                Spessore Lastra (mm)
                                                <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-semibold">Importante</span>
                                            </Label>
                                            <Input
                                                type="number"
                                                value={project.section.thickness}
                                                onChange={(e) => handleProjectPropChange('section', { ...project.section, thickness: Number(e.target.value) })}
                                                min={10} max={50} step={5}
                                                className="h-12 border-border text-base font-medium focus-visible:ring-primary shadow-inner bg-background max-w-[200px]"
                                            />
                                        </div>
                                    </div>

                                    {/* Sezione Blueprint (Fase C) */}
                                    <div className="bg-card rounded-xl border border-border p-5 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
                                                    <Image className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <Label className="text-sm font-bold text-slate-800">Piantina di Riferimento (Blueprint)</Label>
                                                    <p className="text-[10px] text-muted-foreground">Usa un'immagine come guida per il tracciato 3D</p>
                                                </div>
                                            </div>
                                            <Switch 
                                                checked={project.blueprint?.visible} 
                                                onCheckedChange={(checked) => handleProjectPropChange('blueprint', { ...project.blueprint, visible: checked })} 
                                            />
                                        </div>

                                        {project.blueprint?.visible && (
                                            <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">URL Immagine Piantina</Label>
                                                    <Input 
                                                        placeholder="https://esempio.it/piantina.jpg"
                                                        value={project.blueprint?.url || ''}
                                                        onChange={(e) => handleProjectPropChange('blueprint', { ...project.blueprint, url: e.target.value })}
                                                        className="h-9 text-sm border-slate-200"
                                                    />
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Opacità</Label>
                                                            <span className="text-[10px] font-mono text-slate-500">{Math.round((project.blueprint?.opacity || 0.5) * 100)}%</span>
                                                        </div>
                                                        <input 
                                                            type="range" min="0" max="1" step="0.05"
                                                            className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                            value={project.blueprint?.opacity || 0.5}
                                                            onChange={(e) => handleProjectPropChange('blueprint', { ...project.blueprint, opacity: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Scala (mm/px)</Label>
                                                            <span className="text-[10px] font-mono text-slate-500">{project.blueprint?.scale || 1}x</span>
                                                        </div>
                                                        <Input 
                                                            type="number" step="0.1"
                                                            className="h-8 text-xs font-mono"
                                                            value={project.blueprint?.scale || 1}
                                                            onChange={(e) => handleProjectPropChange('blueprint', { ...project.blueprint, scale: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Rotazione (°)</Label>
                                                        <div className="flex items-center gap-2">
                                                            <RotateCcw className="h-3.5 w-3.5 text-slate-400" />
                                                            <Input 
                                                                type="number"
                                                                className="h-8 text-xs font-mono"
                                                                value={project.blueprint?.rotation || 0}
                                                                onChange={(e) => handleProjectPropChange('blueprint', { ...project.blueprint, rotation: Number(e.target.value) })}
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Offset X/Y (mm)</Label>
                                                        <div className="flex items-center gap-2">
                                                            <Move className="h-3.5 w-3.5 text-slate-400" />
                                                            <Input 
                                                                type="text"
                                                                placeholder="0, 0"
                                                                className="h-8 text-xs font-mono"
                                                                value={`${project.blueprint?.offset.x || 0}, ${project.blueprint?.offset.y || 0}`}
                                                                onChange={(e) => {
                                                                    const parts = e.target.value.split(',').map(p => Number(p.trim()));
                                                                    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                                                                        handleProjectPropChange('blueprint', { 
                                                                            ...project.blueprint, 
                                                                            offset: { x: parts[0], y: parts[1] } 
                                                                        });
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                                <div className="p-4 bg-muted border-t border-border flex justify-end rounded-b-xl">
                                    <Button
                                        size="lg"
                                        className="gap-2 px-8 shadow-md hover:shadow-lg transition-all bg-blue-600 hover:bg-blue-700 text-white font-medium"
                                        onClick={() => setProjectStep('routing')}
                                    >
                                        Avanti: Traccia Percorso <ArrowRight className="h-5 w-5 ml-1" />
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    )}

                    {projectStep === "routing" && (
                        <div className="w-full h-full flex flex-col animate-in fade-in duration-300">
                            <div className="pb-4 flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-semibold text-lg flex items-center gap-2 text-foreground">
                                        <Pin className="h-5 w-5 text-primary" /> Costruzione Tracciato Architettonico
                                    </h3>
                                    <p className="text-sm text-muted-foreground mt-1">Costruisci il percorso continuo. Aggiungi i tratti e le curve come in cantiere.</p>
                                </div>
                                <div className="bg-card border border-border px-4 py-2 rounded-lg shadow-sm w-full sm:w-auto text-center sm:text-left">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5 tracking-wider">Totale Sviluppo Impianto</div>
                                    <div className="font-mono font-bold text-xl leading-none text-foreground">{(project.segments.reduce((acc, s) => acc + (s.type === 'straight' ? s.length : 0), 0) / 1000).toFixed(2)} <span className="text-sm text-muted-foreground">m</span></div>
                                </div>
                            </div>

                            <div className="flex-1 w-full relative">
                                {/* Il form del rilievo (verrà riprogettato) */}
                                <ProjectForm
                                    project={project}
                                    onProjectChange={setProject}
                                    isRoutingMode={true}
                                />
                            </div>

                            <div className="pt-6 shrink-0 flex justify-end">
                                <Button
                                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md font-medium text-base w-full sm:w-auto px-8 py-6 h-auto"
                                    onClick={() => setProjectStep('engineering')}
                                >
                                    <Scissors className="h-5 w-5" /> Esplodi Tagli e Genera Produzione
                                </Button>
                            </div>
                        </div>
                    )}

                    {projectStep === "engineering" && (
                        <div className="w-full h-full min-h-0 flex flex-col xl:flex-row gap-4 animate-in fade-in duration-300">
                            {/* Colonna Editor 3D - Prende quasi tutto lo spazio */}
                            <div className="flex-1 xl:w-3/4 h-[60vh] xl:h-full min-h-[400px] bg-muted/20 rounded-xl overflow-hidden relative shadow-md ring-1 ring-border">
                                {/* UI Sovrapposta al 3D */}
                                <div className="absolute top-4 left-4 z-10 bg-background/80 backdrop-blur-[2px] px-3 py-2 rounded-lg border border-border shadow-md pointer-events-none">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-foreground">Editor Taglio Produzione</span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">Tasto Destro sui tratti per tagliare gli spezzoni. Clic SX per selezionare.</span>
                                </div>

                                <ProjectEditor
                                    project={project}
                                    onProjectChange={setProject}
                                    boardDimensions={{ width: sheetConfig.width, height: sheetConfig.height }}
                                    hideCutPlan={true}
                                    disableInteraction={false}
                                    headerAction={(
                                        <Button
                                            size="sm"
                                            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-medium transition-all"
                                            onClick={() => {
                                                handleCalculateProject(project);
                                                setProjectStep("nesting");
                                            }}
                                        >
                                            {nestingResult ? "Ricalcola Taglio Lastra" : "Calcola e Vai al Taglio"}
                                            <ArrowRight className="h-4 w-4" />
                                        </Button>
                                    )}
                                />
                            </div>

                            {/* Colonna Risultati e Verifica (Scrollabile Verticalmente a lato) */}
                            <div className="w-full xl:w-80 xl:h-full flex flex-col gap-4 overflow-y-auto pr-1 pb-4 shrink-0">

                                <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        Verifica Inviluppo
                                    </h4>
                                    <TracksAnalysisPanel project={project} />
                                </div>

                                {/* Se abbiamo già Nesting mostriamo riepilogo */}
                                {calcResult && nestingResult && nestingResult.sheets.length > 0 && (
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 shadow-sm text-emerald-900 dark:text-emerald-400 space-y-2">
                                        <h4 className="text-xs font-bold uppercase tracking-wider opacity-80 mb-2">Risultato Produzione</h4>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex justify-between items-center bg-background/50 px-3 py-2 rounded-md">
                                                <span className="text-sm">Lastre Totali</span>
                                                <span className="font-bold font-mono text-lg">{nestingResult.totalSheets}</span>
                                            </div>
                                            <div className="flex justify-between items-center bg-background/50 px-3 py-2 rounded-md">
                                                <span className="text-sm">Efficienza Taglio</span>
                                                <span className="font-bold font-mono text-lg">{(nestingResult.sheets.reduce((s, sh) => s + sh.utilization, 0) / nestingResult.sheets.length).toFixed(1)}%</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* VISTA TAGLIO LASTRA (Nesting) */}
                    {projectStep === "nesting" && (
                        <div className="w-full h-full flex flex-col gap-4 animate-in fade-in duration-300">
                            {nestingResult && nestingResult.sheets.length > 0 ? (
                                <div className="w-full h-full border border-border rounded-xl bg-card shadow-md flex flex-col">
                                    <div className="p-4 bg-muted border-b border-border flex items-center justify-between gap-3 shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                                                <LayoutTemplate className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-foreground leading-tight">Mappa di Taglio Lastre</h3>
                                                <p className="text-sm text-muted-foreground leading-tight">Ottimizzazione dei pezzi sulla lastra {sheetConfig.width}x{sheetConfig.height}mm</p>
                                            </div>
                                        </div>

                                        {/* Dimensione Lastra Form nello Step 4 */}
                                        <div className="bg-background rounded p-2 flex border border-border/50 items-center justify-center gap-2 shadow-sm shrink-0">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase px-2">Imposta Lastra:</div>
                                            <SheetConfigForm config={sheetConfig} onChange={handleSheetConfigChange} inline={true} />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 bg-muted/30">
                                        <CutPlanViewer
                                            sheets={nestingResult?.sheets || []}
                                            sheetConfig={sheetConfig}
                                            unplacedCount={nestingResult?.unplaced.length || 0}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-center p-8 bg-card rounded-xl border border-dashed border-border/60">
                                    <div className="text-center space-y-4 max-w-sm">
                                        <LayoutTemplate className="h-12 w-12 mx-auto text-muted-foreground opacity-50" />
                                        <p className="text-muted-foreground">Nessun piano di taglio calcolato. Torna allo Step 3 ed esplodi i pezzi per generarlo.</p>
                                        <Button variant="outline" onClick={() => setProjectStep('engineering')}>
                                            Torna al Taglio Pezzi
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
