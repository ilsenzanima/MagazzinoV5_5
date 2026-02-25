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
import { Scissors, Sparkles, RectangleHorizontal, CornerDownRight, Layers, LayoutGrid, List, PenTool, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ViewMode = "single" | "project";
type PieceType = "straight" | "elbow90" | "flatPieces";
type ProjectViewMode = "list" | "editor";

export function CuttingSimulatorClient() {
    const [viewMode, setViewMode] = useState<ViewMode>("single");
    const [pieceType, setPieceType] = useState<PieceType>("straight");
    const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
    const [nestingResult, setNestingResult] = useState<NestingResult | null>(null);
    const [sheetConfig, setSheetConfig] = useState<SheetConfig>({
        width: 2500,
        height: 1200,
        gap: 5,
    });
    const [projectData, setProjectData] = useState<DuctProject>(defaultProject());
    const [projectViewMode, setProjectViewMode] = useState<ProjectViewMode>('list');

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

    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode);
        setCalcResult(null);
        setNestingResult(null);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-3">
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

            {/* Selettore modalità: Pezzo Singolo / Progetto */}
            <div className="flex gap-2 p-1 bg-muted/50 rounded-lg w-fit">
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

            {/* Contenuto principale: layout responsive */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Colonna sinistra: input */}
                <div className="lg:col-span-4 space-y-4">
                    {viewMode === "project" ? (
                        <>
                            {/* Toggle Lista / Editor */}
                            <div className="flex gap-1.5 p-1 bg-muted/30 rounded-lg">
                                <button type="button"
                                    onClick={() => setProjectViewMode('list')}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
                                        projectViewMode === 'list'
                                            ? "bg-background shadow-sm text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <List className="h-3.5 w-3.5" />
                                    Lista
                                </button>
                                <button type="button"
                                    onClick={() => setProjectViewMode('editor')}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
                                        projectViewMode === 'editor'
                                            ? "bg-background shadow-sm text-foreground"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <PenTool className="h-3.5 w-3.5" />
                                    Editor
                                </button>
                            </div>

                            {projectViewMode === 'list' ? (
                                <ProjectForm
                                    project={projectData}
                                    onProjectChange={setProjectData}
                                    onCalculateProject={handleCalculateProject}
                                />
                            ) : null}
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

                    <SheetConfigForm config={sheetConfig} onChange={handleSheetConfigChange} />

                    {viewMode === 'project' && <TracksAnalysisPanel project={projectData} />}

                    {calcResult && (
                        <PiecesList
                            pieces={calcResult.pieces}
                            totalArea={calcResult.totalArea}
                            summary={calcResult.summary}
                        />
                    )}
                </div>

                {/* Colonna destra: visualizzazione */}
                <div className="lg:col-span-8 space-y-4">
                    {/* Editor visivo quando in modalità Progetto + Editor */}
                    {viewMode === 'project' && projectViewMode === 'editor' ? (
                        <>
                            <div className="md:hidden flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-600 text-sm shadow-sm">
                                <MousePointer2 className="h-4 w-4 flex-shrink-0" />
                                <span>L'editor 3D non supporta le modifiche touch. Usa un computer per la progettazione.</span>
                            </div>
                            <ProjectEditor
                                project={projectData}
                                onProjectChange={setProjectData}
                            />
                        </>
                    ) : (
                        <>
                            {nestingResult && nestingResult.sheets.length > 0 && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
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

                            <CutPlanViewer
                                sheets={nestingResult?.sheets || []}
                                sheetConfig={sheetConfig}
                                unplacedCount={nestingResult?.unplaced.length || 0}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
