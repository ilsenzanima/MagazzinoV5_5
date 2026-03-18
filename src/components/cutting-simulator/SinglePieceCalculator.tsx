"use client";

import { useState, useCallback } from "react";
import { DuctForm } from "@/components/cutting-simulator/DuctForm";
import { ElbowForm } from "@/components/cutting-simulator/ElbowForm";
import { FlatPiecesForm } from "@/components/cutting-simulator/FlatPiecesForm";
import { CutPlanViewer } from "@/components/cutting-simulator/CutPlanViewer";
import { SheetConfigForm } from "@/components/cutting-simulator/SheetConfigForm";
import { PiecesList } from "@/components/cutting-simulator/PiecesList";
import {
    calculateRectangularDuct,
    calculateElbow90,
    explodePieces,
    type DuctInput,
    type ElbowInput,
    type CalculationResult,
} from "@/lib/cutting-simulator/calculations";
import { nestPieces, type SheetConfig, type NestingResult } from "@/lib/cutting-simulator/nesting";
import { Scissors, Sparkles, RectangleHorizontal, CornerDownRight, LayoutGrid, LayoutTemplate, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

type PieceType = "straight" | "elbow90" | "flatPieces";

export function SinglePieceCalculator() {
    const [pieceType, setPieceType] = useState<PieceType>("straight");
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

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header compatto */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/disegno-taglio">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 leading-tight">Calcolatore Pezzi Singoli</h1>
                        <p className="text-sm text-slate-500">Configura un singolo elemento e ottieni lo schema di taglio ottimizzato</p>
                    </div>
                </div>

                {/* Selettore tipo pezzo */}
                <div className="flex bg-slate-100 p-1 rounded-xl gap-1 ring-1 ring-slate-200">
                    {[
                        { id: "straight", label: "Canala Dritta", icon: RectangleHorizontal },
                        { id: "elbow90", label: "Gomito 90°", icon: CornerDownRight },
                        { id: "flatPieces", label: "Pezzi Piatti", icon: LayoutGrid }
                    ].map(type => {
                        const Icon = type.icon;
                        const isActive = pieceType === type.id;
                        return (
                            <button
                                key={type.id}
                                onClick={() => handleTypeChange(type.id as PieceType)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                                    isActive
                                        ? "bg-white text-blue-600 shadow-sm"
                                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                                )}
                            >
                                <Icon className="h-4 w-4" />
                                {type.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Area principale scrollabile */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Colonna Sinistra: Form e Parametri */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="animate-in fade-in slide-in-from-left-4 duration-500">
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

                        <div className="animate-in fade-in slide-in-from-left-4 duration-500 delay-150">
                            <SheetConfigForm config={sheetConfig} onChange={handleSheetConfigChange} />
                        </div>
                    </div>

                    {/* Colonna Destra: Risultati e Nesting */}
                    <div className="lg:col-span-8 space-y-6">
                        {calcResult ? (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <PiecesList
                                        pieces={calcResult.pieces}
                                        totalArea={calcResult.totalArea}
                                        summary={calcResult.summary}
                                    />
                                    
                                    {nestingResult && (
                                        <div className="flex flex-col gap-4">
                                            <div className="bg-emerald-600 text-white p-6 rounded-2xl shadow-lg shadow-emerald-200 flex items-center justify-between">
                                                <div>
                                                    <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Efficienza Lastra</p>
                                                    <h3 className="text-3xl font-black">
                                                        {(nestingResult.sheets.reduce((s, sh) => s + sh.utilization, 0) / (nestingResult.sheets.length || 1)).toFixed(1)}%
                                                    </h3>
                                                </div>
                                                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                                                    <Sparkles className="h-8 w-8" />
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center justify-between">
                                                <div>
                                                    <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Lastre Necessarie</p>
                                                    <h3 className="text-3xl font-black text-slate-900">{nestingResult.totalSheets}</h3>
                                                </div>
                                                <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
                                                    <LayoutTemplate className="h-8 w-8" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {nestingResult && nestingResult.sheets.length > 0 && (
                                    <div className="mt-6 bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden shadow-slate-200/50">
                                        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <Scissors className="h-5 w-5 text-blue-400" />
                                                <h3 className="font-bold text-white tracking-tight">Piano di Taglio Ottimizzato</h3>
                                            </div>
                                            <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-blue-500/30">
                                                Nesting Automatico
                                            </span>
                                        </div>
                                        <div className="p-6 overflow-y-auto max-h-[700px]">
                                            <CutPlanViewer 
                                                sheets={nestingResult.sheets} 
                                                sheetConfig={sheetConfig} 
                                                unplacedCount={nestingResult.unplaced.length} 
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white border border-dashed border-slate-300 rounded-3xl text-center p-12 animate-pulse">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                                    <Scissors className="h-10 w-10 text-slate-300" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-400">Pronto per il calcolo</h3>
                                <p className="text-slate-400 max-w-xs mt-2">Inserisci le dimensioni a sinistra e premi "Calcola Pezzi" per vedere il risultato.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
