"use client";

import { useState, useCallback } from "react";
import { DuctForm } from "@/components/cutting-simulator/DuctForm";
import { ElbowForm } from "@/components/cutting-simulator/ElbowForm";
import { ProjectForm } from "@/components/cutting-simulator/ProjectForm";
import { FlatPiecesForm } from "@/components/cutting-simulator/FlatPiecesForm";
import { ProjectEditor } from "@/components/cutting-simulator/ProjectEditor";
import { CutPlanViewer } from "@/components/cutting-simulator/CutPlanViewer";
import { SheetConfigForm } from "@/components/cutting-simulator/SheetConfigForm";
import { TracksAnalysisPanel } from "@/components/cutting-simulator/TracksAnalysisPanel";
import { PiecesList } from "@/components/cutting-simulator/PiecesList";
import {
    calculateRectangularDuct,
    calculateElbow90,
    calculateProject,
    explodePieces,
    type DuctInput,
    type ElbowInput,
    type CalculationResult,
} from "@/lib/cutting-simulator/calculations";
import type { DuctProject } from "@/lib/cutting-simulator/project-model";
import { defaultProject } from "@/lib/cutting-simulator/project-model";
import { nestPieces, type SheetConfig, type NestingResult } from "@/lib/cutting-simulator/nesting";
import { Scissors, Sparkles, RectangleHorizontal, CornerDownRight, Layers, LayoutGrid, List, PenTool, MousePointer2, Pin, PencilRuler, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SectionSidesSelector } from "@/components/cutting-simulator/SectionSidesSelector";

type ViewMode = "single" | "project";
type PieceType = "straight" | "elbow90" | "flatPieces";

// Helper function for initial project state
const createInitialProject = () => ({
    ...defaultProject(),
    name: "Nuovo Progetto",
    description: "Progetto di esempio per la simulazione di taglio",
});

export default function CuttingSimulatorClient() {
    // Mode
    const [viewMode, setViewMode] = useState<"single" | "project">("project");

    // Project workflow step
    const [projectStep, setProjectStep] = useState<"settings" | "routing" | "engineering">("settings");

    // Form states
    const [project, setProject] = useState<DuctProject>(createInitialProject());
    const [singlePieceDimensions, setSinglePieceDimensions] = useState({
        innerWidth: 300,
        innerHeight: 300,
        length: 1000
    });
    const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
    const [nestingResult, setNestingResult] = useState<NestingResult | null>(null);
    const [sheetConfig, setSheetConfig] = useState<SheetConfig>({
        width: 2500,
        height: 1200,
        gap: 5,
    });
    const [pieceType, setPieceType] = useState<PieceType>("straight");

    const runNesting = useCallback((result: CalculationResult, config: SheetConfig) => {
        const exploded = explodePieces(result.pieces);
        const nesting = nestPieces(exploded, config);
        setNestingResult(nesting);
    }, []);

    const handleCalculateStraight = useCallback(
        (input: DuctInput) => {
            const result = calculateRectangularDuct(input);
            setCalcResult(result);
            runNesting(result, sheetConfig);
        },
        [sheetConfig, runNesting]
    );

    const handleCalculateElbow = useCallback(
        (input: ElbowInput) => {
            const result = calculateElbow90(input);
            setCalcResult(result);
            runNesting(result, sheetConfig);
        },
        [sheetConfig, runNesting]
    );

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

    const handleTypeChange = (type: PieceType) => {
        setPieceType(type);
        setCalcResult(null);
        setNestingResult(null);
    };

    const handleViewModeChange = (mode: "single" | "project") => {
        setViewMode(mode);
    };

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
                    <a href="/disegno-taglio" className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-500">
                        <ArrowRight className="h-5 w-5 rotate-180" />
                    </a>
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-md bg-blue-600/10 text-blue-600">
                            <Scissors className="h-4 w-4" />
                        </div>
                        <h1 className="text-lg font-semibold tracking-tight text-slate-800">
                            {viewMode === 'project' ? project.name : "Calcolo Pezzo Singolo"}
                        </h1>
                    </div>
                </div>

                {/* Selettore modalità: Pezzo Singolo / Progetto SEMPRE VISIBILE */}
                <div className="flex gap-1 p-1 bg-slate-200/50 rounded-lg shadow-inner">
                    <Button
                        variant={viewMode === "single" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleViewModeChange("single")}
                        className={cn("gap-2 transition-all h-8 text-xs font-medium", viewMode === "single" ? "shadow-sm bg-background text-primary hover:bg-background" : "text-muted-foreground hover:text-foreground")}
                    >
                        <RectangleHorizontal className="h-3.5 w-3.5" />
                        Pezzo Singolo
                    </Button>
                    <Button
                        variant={viewMode === "project" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleViewModeChange("project")}
                        className={cn("gap-2 transition-all h-8 text-xs font-medium", viewMode === "project" ? "shadow-sm bg-background text-primary hover:bg-background" : "text-muted-foreground hover:text-foreground")}
                    >
                        <Layers className="h-3.5 w-3.5" />
                        Progetto Continuo
                    </Button>
                </div>
            </div>

            {/* Contenuto principale */}
            <div className="flex-1 flex flex-col overflow-hidden w-full mx-auto relative px-2 sm:px-4 lg:px-6 py-4 gap-4">

                {/* STEPPER PROGETTO */}
                {viewMode === "project" && (
                    <div className="flex bg-card p-1 rounded-xl gap-1 w-full max-w-2xl mx-auto shrink-0 shadow-sm border border-border/60">
                        {[
                            { id: "settings", label: "1. Parametri Canala", icon: PencilRuler },
                            { id: "routing", label: "2. Tracciato Principale", icon: Pin },
                            { id: "engineering", label: "3. Taglio Pezzi", icon: Scissors }
                        ].map(step => {
                            const Icon = step.icon;
                            const isActive = projectStep === step.id;
                            return (
                                <button
                                    key={step.id}
                                    onClick={() => setProjectStep(step.id as "settings" | "routing" | "engineering")}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300",
                                        isActive
                                            ? "bg-primary text-primary-foreground shadow-md scale-[1.02]"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Icon className="h-4 w-4 hidden sm:block" />
                                    <span className="truncate">{step.label}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* AREA CONTENUTO CENTRALE CON SCROLL (Solo questo sckrollerà) */}
                <div className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center pb-8 scrollbar-hide sm:scrollbar-default">
                    {/* ===== VISTA PEZZO SINGOLO ===== */}
                    {viewMode === "single" && (
                        <div className="w-full max-w-4xl space-y-6 animate-in fade-in duration-300">
                            <div className="flex flex-col sm:flex-row gap-6 w-full items-start">
                                {/* Form */}
                                <div className="w-full sm:w-1/2 space-y-4">
                                    {/* Sub-selettore tipo pezzo singolo */}
                                    <div className="flex flex-wrap gap-1.5 p-1 bg-card border border-border rounded-lg shadow-sm">
                                        <button type="button"
                                            onClick={() => handleTypeChange("straight")}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-md transition-all",
                                                pieceType === "straight"
                                                    ? "bg-muted text-foreground"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <RectangleHorizontal className="h-3.5 w-3.5" />
                                            Dritto
                                        </button>
                                        <button type="button"
                                            onClick={() => handleTypeChange("elbow90")}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-md transition-all",
                                                pieceType === "elbow90"
                                                    ? "bg-muted text-foreground"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <CornerDownRight className="h-3.5 w-3.5" />
                                            Curva
                                        </button>
                                        <button type="button"
                                            onClick={() => handleTypeChange("flatPieces")}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold rounded-md transition-all",
                                                pieceType === "flatPieces"
                                                    ? "bg-muted text-foreground"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                            )}
                                        >
                                            <LayoutGrid className="h-3.5 w-3.5" />
                                            Piani
                                        </button>
                                    </div>

                                    {pieceType === "straight" ? (
                                        <DuctForm onCalculate={handleCalculateStraight} />
                                    ) : pieceType === "elbow90" ? (
                                        <ElbowForm onCalculate={handleCalculateElbow} />
                                    ) : (
                                        <FlatPiecesForm
                                            sheetConfig={sheetConfig}
                                            onCalculate={(result) => {
                                                setCalcResult(result);
                                                runNesting(result, sheetConfig);
                                            }}
                                        />
                                    )}
                                    <SheetConfigForm config={sheetConfig} onChange={handleSheetConfigChange} />
                                </div>

                                {/* Risultato */}
                                <div className="w-full sm:w-1/2 space-y-4">
                                    {calcResult && (
                                        <PiecesList
                                            pieces={calcResult.pieces}
                                            totalArea={calcResult.totalArea}
                                            summary={calcResult.summary}
                                        />
                                    )}
                                    {nestingResult && nestingResult.sheets.length > 0 && (
                                        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm shadow-sm">
                                            <Sparkles className="h-5 w-5 flex-shrink-0" />
                                            <span>
                                                <strong>{nestingResult.totalSheets}</strong> lastre (util. <strong>{(nestingResult.sheets.reduce((s, sh) => s + sh.utilization, 0) / nestingResult.sheets.length).toFixed(1)}%</strong>)
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {nestingResult && nestingResult.sheets.length > 0 && (
                                <div className="w-full border border-border rounded-xl bg-card shadow-sm overflow-hidden h-[600px] flex flex-col mt-6">
                                    <div className="p-3 bg-muted border-b border-border font-semibold text-sm text-foreground">Preview di Taglio</div>
                                    <div className="flex-1 min-h-0 overflow-y-auto p-4">
                                        <CutPlanViewer sheets={nestingResult?.sheets || []} sheetConfig={sheetConfig} unplacedCount={nestingResult?.unplaced.length || 0} />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}


                    {/* ===== VISTA PROGETTO ===== */}
                    {viewMode === "project" && projectStep === "settings" && (
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

                    {viewMode === "project" && projectStep === "routing" && (
                        <div className="w-full max-w-4xl h-full min-h-[500px] flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden animate-in fade-in duration-300">
                            <div className="p-4 border-b border-border flex-shrink-0 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-muted gap-4">
                                <div>
                                    <h3 className="font-semibold text-base flex items-center gap-2 text-slate-800">
                                        <Pin className="h-5 w-5 text-blue-600" /> Costruzione Tracciato Architettonico
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">Costruisci il percorso continuo. Aggiungi i tratti e le curve come in cantiere.</p>
                                </div>
                                <div className="bg-background border border-border px-4 py-2 rounded-lg shadow-sm w-full sm:w-auto text-center sm:text-left">
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5 tracking-wider">Totale Sviluppo Impianto</div>
                                    <div className="font-mono font-bold text-xl leading-none text-foreground">{(project.segments.reduce((acc, s) => acc + (s.type === 'straight' ? s.length : 0), 0) / 1000).toFixed(2)} <span className="text-sm text-muted-foreground">m</span></div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 bg-muted/30">
                                {/* Il form del rilievo (verrà riprogettato) */}
                                <ProjectForm
                                    project={project}
                                    onProjectChange={setProject}
                                    isRoutingMode={true}
                                />
                            </div>

                            <div className="p-4 border-t border-border bg-card shrink-0 flex justify-end">
                                <Button
                                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md font-medium text-base w-full sm:w-auto px-8 py-6 h-auto"
                                    onClick={() => setProjectStep('engineering')}
                                >
                                    <Scissors className="h-5 w-5" /> Esplodi Tagli e Genera Produzione
                                </Button>
                            </div>
                        </div>
                    )}

                    {viewMode === "project" && projectStep === "engineering" && (
                        <div className="w-full h-full min-h-0 flex flex-col xl:flex-row gap-4 animate-in fade-in duration-300">
                            {/* Colonna Editor 3D - Prende quasi tutto lo spazio */}
                            <div className="flex-1 xl:w-3/4 h-[60vh] xl:h-full min-h-[400px] bg-slate-900 rounded-xl overflow-hidden relative shadow-lg ring-1 ring-slate-800">
                                {/* UI Sovrapposta al 3D */}
                                <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur-[2px] px-3 py-2 rounded-lg border border-slate-700 shadow-xl pointer-events-none">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Editor Taglio Produzione</span>
                                    </div>
                                    <span className="text-[11px] text-slate-400">Tasto Destro sui tratti per tagliare gli spezzoni. Clic SX per selezionare.</span>
                                </div>

                                <ProjectEditor
                                    project={project}
                                    onProjectChange={setProject}
                                    boardDimensions={{ width: sheetConfig.width, height: sheetConfig.height }}
                                    hideCutPlan={true}
                                    disableInteraction={false}
                                />
                            </div>

                            {/* Colonna Risultati e Verifica (Scrollabile Verticalmente a lato) */}
                            <div className="w-full xl:w-1/4 xl:h-full flex flex-col gap-4 overflow-y-auto pr-1 pb-4 shrink-0">
                                <div className="bg-card border border-border rounded-xl shadow-sm p-4 space-y-4">
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-blue-500" />
                                            Dimensione Lastra
                                        </h4>
                                        <SheetConfigForm config={sheetConfig} onChange={handleSheetConfigChange} inline={true} />
                                    </div>
                                </div>

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

                                <Button
                                    className="w-full gap-2 bg-slate-800 hover:bg-slate-900 text-white shadow-md font-medium text-sm py-6 h-auto"
                                    onClick={() => handleCalculateProject(project)}
                                >
                                    <Layers className="h-5 w-5" /> Ricalcola Piano di Taglio
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Visualizzatore Piani di Taglio Nesting Sotto al 3D (se ingegnerizzazione attiva e nested) */}
                    {viewMode === "project" && projectStep === "engineering" && nestingResult && nestingResult.sheets.length > 0 && (
                        <div className="w-full border border-border rounded-xl bg-card shadow-md overflow-hidden min-h-[600px] flex flex-col mt-6 flex-shrink-0 animate-in slide-in-from-bottom-8">
                            <div className="p-4 bg-muted border-b border-border text-foreground flex items-center gap-3">
                                <Scissors className="h-5 w-5 text-primary" />
                                <h3 className="font-semibold text-lg">Piano di Produzione Macchina (G-Code)</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 bg-muted/30">
                                <CutPlanViewer
                                    sheets={nestingResult?.sheets || []}
                                    sheetConfig={sheetConfig}
                                    unplacedCount={nestingResult?.unplaced.length || 0}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
