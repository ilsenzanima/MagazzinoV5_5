"use client";

import { useState, useCallback } from "react";
import { DuctForm } from "@/components/cutting-simulator/DuctForm";
import { ElbowForm } from "@/components/cutting-simulator/ElbowForm";
import { FlatPiecesForm } from "@/components/cutting-simulator/FlatPiecesForm";
import { CutPlanViewer } from "@/components/cutting-simulator/CutPlanViewer";
import { SheetConfigForm } from "@/components/cutting-simulator/SheetConfigForm";
import { PiecesList } from "@/components/cutting-simulator/PiecesList";
import { SinglePiece3DView } from "@/components/cutting-simulator/SinglePiece3DView";
import {
    calculateRectangularDuct,
    calculateElbow90,
    explodePieces,
    type DuctInput,
    type ElbowInput,
    type CalculationResult,
} from "@/lib/cutting-simulator/calculations";
import { nestPieces, type SheetConfig, type NestingResult } from "@/lib/cutting-simulator/nesting";
import { Scissors, Sparkles, RectangleHorizontal, CornerDownRight, LayoutGrid, LayoutTemplate, ArrowLeft, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

type PieceType = "straight" | "elbow90" | "flatPieces";

// Estrae le dimensioni da DuctInput per la vista 3D
interface Dims3D {
    innerWidth: number;
    innerHeight: number;
    thickness: number;
    length?: number;
    direction?: "up" | "down" | "left" | "right";
}

export function SinglePieceCalculator() {
    const [pieceType, setPieceType] = useState<PieceType>("straight");
    const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
    const [nestingResult, setNestingResult] = useState<NestingResult | null>(null);
    const [dims3D, setDims3D] = useState<Dims3D>({ innerWidth: 200, innerHeight: 200, thickness: 50, length: 1000 });
    const [sheetConfig, setSheetConfig] = useState<SheetConfig>({ width: 2500, height: 1200, gap: 5 });

    const runNesting = useCallback((result: CalculationResult, config: SheetConfig) => {
        const exploded = explodePieces(result.pieces);
        setNestingResult(nestPieces(exploded, config));
    }, []);

    const handleCalculateStraight = useCallback((input: DuctInput) => {
        const result = calculateRectangularDuct(input);
        setCalcResult(result);
        runNesting(result, sheetConfig);
        setDims3D({ innerWidth: input.innerWidth, innerHeight: input.innerHeight, thickness: input.thickness, length: input.length });
    }, [sheetConfig, runNesting]);

    const handleCalculateElbow = useCallback((input: ElbowInput) => {
        const result = calculateElbow90(input);
        setCalcResult(result);
        runNesting(result, sheetConfig);
        setDims3D({ innerWidth: input.innerWidth, innerHeight: input.innerHeight, thickness: input.thickness });
    }, [sheetConfig, runNesting]);

    const handleSheetConfigChange = useCallback((newConfig: SheetConfig) => {
        setSheetConfig(newConfig);
        if (calcResult) runNesting(calcResult, newConfig);
    }, [calcResult, runNesting]);

    const handleTypeChange = (type: PieceType) => {
        setPieceType(type);
        setCalcResult(null);
        setNestingResult(null);
    };

    const pieceTypes = [
        { id: "straight",   label: "Canala Dritta", icon: RectangleHorizontal },
        { id: "elbow90",    label: "Gomito 90°",    icon: CornerDownRight },
        { id: "flatPieces", label: "Pezzi Piatti",  icon: LayoutGrid },
    ] as const;

    return (
        <div className="flex flex-col h-full bg-muted/30">

            {/* ── Header ── */}
            <div className="bg-background border-b px-4 md:px-6 py-3 flex items-center justify-between shrink-0 gap-4">
                <div className="flex items-center gap-3">
                    <Link href="/disegno-taglio">
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-base font-bold text-foreground leading-none truncate">Calcolatore Pezzi Singoli</h1>
                        <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Schema di taglio ottimizzato per un singolo elemento</p>
                    </div>
                </div>

                {/* Selettore tipo */}
                <div className="flex bg-muted p-1 rounded-xl gap-1 shrink-0">
                    {pieceTypes.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => handleTypeChange(id as PieceType)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                                pieceType === id
                                    ? "bg-background text-primary shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Contenuto scrollabile ── */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-6">

                    {/* ── RIGA 1: Form (50%) + 3D Preview (50%) ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

                        {/* Form di input */}
                        <div className="animate-in fade-in slide-in-from-left-4 duration-400">
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
                        </div>

                        {/* Anteprima 3D */}
                        <div className="animate-in fade-in slide-in-from-right-4 duration-400">
                            <div className="rounded-2xl overflow-hidden border bg-black/80 shadow-xl" style={{ aspectRatio: "16/10", minHeight: "280px" }}>
                                <div className="relative w-full h-full">
                                    <span className="absolute top-3 left-3 z-10 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] text-white font-bold uppercase tracking-wider">
                                        Anteprima 3D
                                    </span>
                                    {pieceType !== "flatPieces" ? (
                                        <SinglePiece3DView
                                            type={pieceType === "elbow90" ? "elbow90" : "straight"}
                                            dimensions={dims3D}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                                            <div className="text-center">
                                                <Box className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                                <p className="text-xs">Anteprima non disponibile per Pezzi Piatti</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── RIGA 2: Risultati pezzi (full width) ── */}
                    {calcResult && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-400">
                            <PiecesList
                                pieces={calcResult.pieces}
                                totalArea={calcResult.totalArea}
                                summary={calcResult.summary}
                            />
                        </div>
                    )}

                    {/* ── RIGA 3: Statistiche nesting + Config lastra ── */}
                    {nestingResult && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-400 delay-75">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                {/* Efficienza */}
                                <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-lg flex items-center justify-between">
                                    <div>
                                        <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-wider mb-1">Efficienza Lastra</p>
                                        <h3 className="text-3xl font-black">
                                            {(nestingResult.sheets.reduce((s, sh) => s + sh.utilization, 0) / (nestingResult.sheets.length || 1)).toFixed(1)}%
                                        </h3>
                                    </div>
                                    <div className="p-3 bg-white/20 rounded-xl"><Sparkles className="h-7 w-7" /></div>
                                </div>

                                {/* Lastre */}
                                <div className="bg-background border p-5 rounded-2xl shadow-sm flex items-center justify-between">
                                    <div>
                                        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Lastre Necessarie</p>
                                        <h3 className="text-3xl font-black text-foreground">{nestingResult.totalSheets}</h3>
                                    </div>
                                    <div className="p-3 bg-muted rounded-xl text-muted-foreground"><LayoutTemplate className="h-7 w-7" /></div>
                                </div>

                                {/* Config lastra */}
                                <SheetConfigForm config={sheetConfig} onChange={handleSheetConfigChange} />
                            </div>

                            {/* ── RIGA 4: Piano di taglio (full width) ── */}
                            {nestingResult.sheets.length > 0 && (
                                <div className="bg-background border rounded-3xl overflow-hidden shadow-xl">
                                    <div className="px-6 py-4 bg-foreground/5 border-b flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Scissors className="h-5 w-5 text-primary" />
                                            <h3 className="font-bold text-foreground tracking-tight">Piano di Taglio Ottimizzato</h3>
                                        </div>
                                        <span className="bg-primary/10 text-primary text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-primary/20">
                                            Nesting Automatico
                                        </span>
                                    </div>
                                    <div className="p-4 md:p-6 overflow-y-auto max-h-[700px]">
                                        <CutPlanViewer
                                            sheets={nestingResult.sheets}
                                            sheetConfig={sheetConfig}
                                            unplacedCount={nestingResult.unplaced.length}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Placeholder se non ancora calcolato ── */}
                    {!calcResult && (
                        <div className="h-48 flex flex-col items-center justify-center bg-background border border-dashed rounded-3xl text-center p-8">
                            <Scissors className="h-9 w-9 text-muted-foreground/20 mb-3" />
                            <p className="text-sm font-semibold text-muted-foreground">Inserisci le dimensioni e premi &quot;Calcola Pezzi&quot;</p>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
