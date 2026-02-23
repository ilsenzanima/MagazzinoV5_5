"use client";

import { useState, useCallback } from "react";
import { DuctForm } from "@/components/cutting-simulator/DuctForm";
import { CutPlanViewer } from "@/components/cutting-simulator/CutPlanViewer";
import { SheetConfigForm } from "@/components/cutting-simulator/SheetConfigForm";
import { PiecesList } from "@/components/cutting-simulator/PiecesList";
import {
    calculateRectangularDuct,
    explodePieces,
    type DuctInput,
    type CutPiece,
    type CalculationResult,
} from "@/lib/cutting-simulator/calculations";
import { nestPieces, type SheetConfig, type NestingResult } from "@/lib/cutting-simulator/nesting";
import { Scissors, Sparkles } from "lucide-react";

export function CuttingSimulatorClient() {
    const [calcResult, setCalcResult] = useState<CalculationResult | null>(null);
    const [nestingResult, setNestingResult] = useState<NestingResult | null>(null);
    const [sheetConfig, setSheetConfig] = useState<SheetConfig>({
        width: 2000,
        height: 1200,
        gap: 5,
    });

    const handleCalculate = useCallback(
        (input: DuctInput) => {
            const result = calculateRectangularDuct(input);
            setCalcResult(result);

            // Esplode e nesta automaticamente
            const exploded = explodePieces(result.pieces);
            const nesting = nestPieces(exploded, sheetConfig);
            setNestingResult(nesting);
        },
        [sheetConfig]
    );

    const handleSheetConfigChange = useCallback(
        (newConfig: SheetConfig) => {
            setSheetConfig(newConfig);
            // Ricalcola automaticamente se ci sono pezzi
            if (calcResult) {
                const exploded = explodePieces(calcResult.pieces);
                const nesting = nestPieces(exploded, newConfig);
                setNestingResult(nesting);
            }
        },
        [calcResult]
    );

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

            {/* Contenuto principale: layout responsive */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Colonna sinistra: input */}
                <div className="lg:col-span-4 space-y-4">
                    <DuctForm onCalculate={handleCalculate} />
                    <SheetConfigForm config={sheetConfig} onChange={handleSheetConfigChange} />

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
                </div>
            </div>
        </div>
    );
}
