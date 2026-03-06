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

    const isEditorFullscreen = viewMode === "project" && projectStep !== "settings";

    return (
        <div className={cn("w-full transition-all flex flex-col", isEditorFullscreen ? "h-[calc(100vh-6rem)]" : "space-y-6")}>
            {/* Header */}
            {!isEditorFullscreen && (
                <div className="flex items-start gap-3 shrink-0">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                        <Scissors className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                            Disegno e Taglio
                        </h1>
                        <p className="text-muted-foreground text-sm mt-1">
                            Calcola i pezzi, simula il piano di taglio e ottimizza l&apos;uso del materiale
                        </p>
                    </div>
                </div>
            )}

            {/* Selettore modalità: Pezzo Singolo / Progetto */}
            {!isEditorFullscreen && (
                <div className="flex gap-2 p-1 bg-muted/50 rounded-lg w-fit shrink-0">
                    <Button
                        variant={viewMode === "single" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleViewModeChange("single")}
                        className={cn("gap-2 transition-all", viewMode === "single" && "shadow-md")}
                    >
                        <RectangleHorizontal className="h-4 w-4" />
                        Pezzo Singolo
                    </Button>
                    <Button
                        variant={viewMode === "project" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => handleViewModeChange("project")}
                        className={cn("gap-2 transition-all", viewMode === "project" && "shadow-md")}
                    >
                        <Layers className="h-4 w-4" />
                        Progetto
                    </Button>
                </div>
            )}

            {/* Contenuto principale: layout responsive */}
            <div className={cn("w-full flex-1", isEditorFullscreen ? "flex flex-col min-h-0" : "flex flex-col gap-8")}>
                {/* Sezione superiore Impostazioni (nascosta se fullscreen) */}
                {!isEditorFullscreen && (
                    <div className="flex flex-col gap-6 w-full">
                        {/* Form di Input e Configurazione Lastra */}
                        <div className="space-y-4">
                            {viewMode === "project" ? (
                                <>
                                    {/* Toggle Lista / Editor */}
                                    {/* This section is replaced by the new stepper */}
                                </>
                            ) : (
                                <>
                                    {/* Sub-selettore tipo pezzo singolo */}
                                    <div className="flex gap-1.5 p-1 bg-muted/30 rounded-lg">
                                        <button type="button"
                                            onClick={() => handleTypeChange("straight")}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
                                                pieceType === "straight"
                                                    ? "bg-background shadow-sm text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <RectangleHorizontal className="h-3.5 w-3.5" />
                                            Tratto Dritto
                                        </button>
                                        <button type="button"
                                            onClick={() => handleTypeChange("elbow90")}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
                                                pieceType === "elbow90"
                                                    ? "bg-background shadow-sm text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <CornerDownRight className="h-3.5 w-3.5" />
                                            Angolo 90°
                                        </button>
                                        <button type="button"
                                            onClick={() => handleTypeChange("flatPieces")}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
                                                pieceType === "flatPieces"
                                                    ? "bg-background shadow-sm text-foreground"
                                                    : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            <LayoutGrid className="h-3.5 w-3.5" />
                                            Pezzi Piani
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
                                </>
                            )}

                            {viewMode === "single" && <SheetConfigForm config={sheetConfig} onChange={handleSheetConfigChange} />}
                        </div>
                    </div>
                )}

                {/* Vista Progetto */}
                {viewMode === "project" && (
                    <div className={cn("flex flex-col h-full", isEditorFullscreen ? "min-h-0" : "gap-6")}>

                        {/* Stepper di navigazione del Progetto */}
                        <div className="flex bg-muted/30 p-1.5 rounded-xl gap-1 w-full shrink-0 shadow-sm border border-border/50">
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
                                            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300",
                                            isActive
                                                ? "bg-background text-primary shadow-md border border-primary/20 scale-[1.02]"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span>{step.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Contenuto degli step Misure e Produzione - Occupa tutto lo schermo disponibile se Full -> (che scatta se step !== 'settings') */}
                        {projectStep === "settings" && (
                            <div className="space-y-6">
                                <Card className="border-border/50 bg-card/50 shadow-sm">
                                    <CardHeader className="pb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-md bg-primary/10">
                                                <Layers className="h-4 w-4 text-primary" />
                                            </div>
                                            <CardTitle className="text-base font-semibold">Configurazione Materiale e Parametri</CardTitle>
                                        </div>
                                        <CardDescription className="text-sm">
                                            Seleziona il materiale (Lastre in Calciosilicato) e i parametri di base per l&apos;intero tracciato.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="bg-background rounded-lg border border-border/50 p-4 shadow-sm">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">Base (mm)</Label>
                                                    <Input
                                                        type="number"
                                                        value={project.section.innerWidth}
                                                        onChange={(e) => handleProjectPropChange('section', { ...project.section, innerWidth: Number(e.target.value) })}
                                                        min={100}
                                                        max={3000}
                                                        step={50}
                                                        className="h-10 border-border/50 bg-muted/20 text-sm focus-visible:ring-1"
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-[10px] uppercase text-muted-foreground font-bold">Altezza (mm)</Label>
                                                    <Input
                                                        type="number"
                                                        value={project.section.innerHeight}
                                                        onChange={(e) => handleProjectPropChange('section', { ...project.section, innerHeight: Number(e.target.value) })}
                                                        min={100}
                                                        max={3000}
                                                        step={50}
                                                        className="h-10 border-border/50 bg-muted/20 text-sm focus-visible:ring-1"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2 pt-2">
                                                <Label className="text-[10px] uppercase text-muted-foreground font-bold">Spessore Lastra (mm)</Label>
                                                <Input
                                                    type="number"
                                                    value={project.section.thickness}
                                                    onChange={(e) => handleProjectPropChange('section', { ...project.section, thickness: Number(e.target.value) })}
                                                    min={10}
                                                    max={50}
                                                    step={5}
                                                    className="h-10 border-border/50 bg-muted/20 text-sm focus-visible:ring-1"
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="flex justify-end pt-4 border-t border-border/10">
                                    <Button
                                        size="lg"
                                        className="gap-2 px-8 shadow-sm hover:shadow-md transition-shadow font-medium"
                                        onClick={() => setProjectStep('routing')}
                                    >
                                        Vai al Tracciato (Costruzione) <ArrowRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {projectStep === "routing" && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0">
                                {/* Left Panel - Lista Segmenti / Tracciato */}
                                <div className="lg:col-span-5 xl:col-span-4 h-full min-h-0 flex flex-col bg-background border border-border/50 rounded-xl shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-border/50 flex-shrink-0 flex items-center justify-between bg-muted/10">
                                        <div>
                                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                                <Pin className="h-4 w-4 text-primary" /> Costruzione Tracciato
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-1">Aggiungi i tratti continui principali e gli ostacoli</p>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto w-full max-w-full">
                                        <div className="w-full">
                                            <ProjectForm
                                                project={project}
                                                onProjectChange={setProject}
                                                isRoutingMode={true}
                                            />
                                        </div>
                                    </div>
                                    {/* Action footer */}
                                    <div className="p-4 border-t border-border/50 bg-muted/10 shrink-0">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1 tracking-wider">Totale Sviluppo</div>
                                                <div className="font-mono font-medium text-lg leading-none">{(project.segments.reduce((acc, s) => acc + (s.type === 'straight' ? s.length : 0), 0) / 1000).toFixed(2)}m</div>
                                            </div>
                                            <Button
                                                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white flex-1 whitespace-nowrap lg:flex-none justify-center"
                                                onClick={() => setProjectStep('engineering')}
                                            >
                                                <Scissors className="h-4 w-4" /> Esplodi Tagli
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Panel - Preview 3D per il Routing (No Editor interattivo di tagli) */}
                                <div className="lg:col-span-7 xl:col-span-8 h-full min-h-[400px] bg-background border border-border/50 rounded-xl shadow-sm overflow-hidden flex flex-col relative">
                                    <div className="absolute top-4 left-4 z-10 bg-background/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-border/50 shadow-sm flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            Preview Tracciato Completo
                                        </span>
                                    </div>
                                    <ProjectEditor
                                        project={project}
                                        onProjectChange={setProject}
                                        boardDimensions={{ width: 1200, height: 2400 }} // Non usata al momento qui
                                        hideCutPlan={true}
                                        disableInteraction={true} // Non si edita il taglio nella fase 1
                                    />
                                </div>
                            </div>
                        )}

                        {projectStep === "engineering" && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0">
                                {/* Left Panel - Sidebar (Ottimizzazione, Inviluppo, Risultati) */}
                                <div className="lg:col-span-4 h-full min-h-0 flex flex-col bg-background border border-border/50 rounded-xl shadow-sm overflow-y-auto p-4 space-y-5">
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-primary uppercase">Ottimizzazione Pannelli</p>
                                        <SheetConfigForm config={sheetConfig} onChange={handleSheetConfigChange} />
                                    </div>
                                    <div className="w-full h-px bg-border my-2" />
                                    <div className="space-y-2">
                                        <p className="text-xs font-semibold text-primary uppercase">Verifica Inviluppo Tracciato</p>
                                        <TracksAnalysisPanel project={project} />
                                    </div>

                                    {/* Preview rapida Cut Plan se calcolato */}
                                    {calcResult && nestingResult && nestingResult.sheets.length > 0 && (
                                        <>
                                            <div className="w-full h-px bg-border my-2" />
                                            <div className="space-y-2">
                                                <p className="text-xs font-semibold text-primary uppercase">Risultato Tagli Nesting</p>
                                                <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                                                    <Sparkles className="h-4 w-4 text-primary" />
                                                    <div className="text-center">
                                                        <strong>{nestingResult.totalSheets}</strong> lastr{nestingResult.totalSheets === 1 ? 'a' : 'e'}<br />
                                                        Utilizzo: <strong>{(nestingResult.sheets.reduce((s, sh) => s + sh.utilization, 0) / nestingResult.sheets.length).toFixed(1)}%</strong>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Right Panel - Project Editor per l'Ingegnerizzazione */}
                                <div className="lg:col-span-8 h-full min-h-[500px] bg-background border border-border/50 rounded-xl shadow-sm overflow-hidden flex flex-col relative">
                                    <div className="absolute top-4 left-4 z-10 bg-background/90 backdrop-blur-sm px-3 pt-1 pb-1.5 rounded-lg border border-border/50 shadow-sm flex flex-col gap-0.5 pointer-events-none">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Editor Produzione Pezzi</span>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground pl-4">Clic destro sul tracciato per tagliare gli spezzoni.</span>
                                    </div>
                                    <ProjectEditor
                                        project={project}
                                        onProjectChange={setProject}
                                        boardDimensions={{ width: 1200, height: 2400 }}
                                        hideCutPlan={true} // Il piano di taglio lo mostriamo sotto a tutto o nella colonna sx, non dentro il canvas 3D
                                        disableInteraction={false} // Lasciamo tagliare i pezzi con il tasto destro
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Sezione inferiore: Visualizzazione Piani di Taglio */}
                {viewMode === "project" && projectStep === "engineering" && nestingResult && nestingResult.sheets.length > 0 && (
                    <div className="space-y-4 w-full min-h-[500px] mt-6 bg-background border border-border/50 rounded-xl p-4 shadow-sm">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            <Scissors className="h-4 w-4 text-primary" /> Piani di Taglio Generati
                        </h3>
                        <div className="flex-1 min-h-0 overflow-y-auto pb-4">
                            <CutPlanViewer
                                sheets={nestingResult?.sheets || []}
                                sheetConfig={sheetConfig}
                                unplacedCount={nestingResult?.unplaced.length || 0}
                            />
                        </div>
                    </div>
                )}
                {/* Sezione inferiore: visualizzazione del piano SOLO in Single Mode */}
                {viewMode === "single" && (
                    <div className="space-y-4 w-full min-h-[500px]">
                        {calcResult && (
                            <PiecesList
                                pieces={calcResult.pieces}
                                totalArea={calcResult.totalArea}
                                summary={calcResult.summary}
                            />
                        )}

                        {nestingResult && nestingResult.sheets.length > 0 && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm shrink-0">
                                <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                                <span>
                                    <strong>{nestingResult.totalSheets}</strong> lastr{nestingResult.totalSheets === 1 ? 'a' : 'e'} necessar{nestingResult.totalSheets === 1 ? 'ia' : 'ie'}.
                                    {' '}Utilizzo medio:{' '}
                                    <strong>
                                        {(
                                            nestingResult.sheets.reduce((s, sh) => s + sh.utilization, 0) /
                                            nestingResult.sheets.length
                                        ).toFixed(1)}
                                        %
                                    </strong>
                                </span>
                            </div>
                        )}

                        <div className="flex-1 min-h-0 overflow-y-auto pb-4">
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
    );
}
