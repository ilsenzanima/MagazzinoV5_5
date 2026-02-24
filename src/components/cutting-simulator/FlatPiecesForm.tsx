"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LayoutGrid, Plus, Trash2, Calculator } from "lucide-react";
import type { CalculationResult } from "@/lib/cutting-simulator/calculations";
import type { SheetConfig } from "@/lib/cutting-simulator/nesting";

export interface FlatPieceRow {
    id: string;
    label: string;
    width: number;
    height: number;
    quantity: number;
}

interface FlatPiecesFormProps {
    sheetConfig: SheetConfig;
    onCalculate: (result: CalculationResult) => void;
}

const FLAT_COLORS = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b',
    '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
    '#14b8a6', '#6366f1', '#d946ef', '#84cc16',
];

let nextId = 1;

function createEmptyRow(): FlatPieceRow {
    return { id: `flat-${nextId++}`, label: '', width: 0, height: 0, quantity: 1 };
}

/**
 * Calcola quanti pezzi di dimensione (pw × ph) si possono ricavare
 * da una lastra (sw × sh), considerando anche la rotazione 90°.
 * Gap tra i pezzi incluso.
 */
function piecesPerSheet(pw: number, ph: number, sw: number, sh: number, gap: number): number {
    if (pw <= 0 || ph <= 0) return 0;

    // Orientazione normale
    const colsN = Math.floor((sw + gap) / (pw + gap));
    const rowsN = Math.floor((sh + gap) / (ph + gap));
    const normalCount = colsN * rowsN;

    // Orientazione ruotata 90°
    const colsR = Math.floor((sw + gap) / (ph + gap));
    const rowsR = Math.floor((sh + gap) / (pw + gap));
    const rotatedCount = colsR * rowsR;

    return Math.max(normalCount, rotatedCount);
}

export function FlatPiecesForm({ sheetConfig, onCalculate }: FlatPiecesFormProps) {
    const [rows, setRows] = useState<FlatPieceRow[]>([createEmptyRow()]);

    const addRow = useCallback(() => {
        setRows(prev => [...prev, createEmptyRow()]);
    }, []);

    const removeRow = useCallback((id: string) => {
        setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
    }, []);

    const updateRow = useCallback((id: string, field: keyof FlatPieceRow, value: string | number) => {
        setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    }, []);

    const handleCalculate = useCallback(() => {
        const validRows = rows.filter(r => r.width > 0 && r.height > 0 && r.quantity > 0);
        if (validRows.length === 0) return;

        const pieces = validRows.map((r, i) => ({
            id: `flat-piece-${i}`,
            label: r.label || `Pezzo ${i + 1}`,
            width: r.width,
            height: r.height,
            quantity: r.quantity,
            color: FLAT_COLORS[i % FLAT_COLORS.length],
            formula: `${r.width} × ${r.height} mm — ${r.quantity} pz`,
        }));

        const totalArea = pieces.reduce((sum, p) => sum + p.width * p.height * p.quantity, 0);
        const totalPieces = pieces.reduce((sum, p) => sum + p.quantity, 0);

        const result: CalculationResult = {
            pieces,
            totalArea,
            summary: `Pezzi piani: ${totalPieces} pezzi totali, ${validRows.length} dimensioni diverse`,
            outerWidth: 0,
            outerHeight: 0,
        };

        onCalculate(result);
    }, [rows, onCalculate]);

    const validRows = rows.filter(r => r.width > 0 && r.height > 0 && r.quantity > 0);

    return (
        <Card className="border-border/60">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500">
                        <LayoutGrid className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Pezzi Piani</CardTitle>
                        <CardDescription>Rettangoli liberi da tagliare sulla lastra</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Lista righe */}
                {rows.map((row, idx) => (
                    <div
                        key={row.id}
                        className="flex items-end gap-2 p-3 rounded-lg bg-muted/30 border border-border/40"
                    >
                        <div className="flex-1 grid grid-cols-4 gap-2">
                            <div className="col-span-4 sm:col-span-1">
                                <Label className="text-[10px] uppercase text-muted-foreground">Nome</Label>
                                <Input
                                    value={row.label}
                                    onChange={e => updateRow(row.id, 'label', e.target.value)}
                                    placeholder={`Pezzo ${idx + 1}`}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div>
                                <Label className="text-[10px] uppercase text-muted-foreground">Base (mm)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={row.width || ''}
                                    onChange={e => updateRow(row.id, 'width', Number(e.target.value))}
                                    placeholder="mm"
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div>
                                <Label className="text-[10px] uppercase text-muted-foreground">Altezza (mm)</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={row.height || ''}
                                    onChange={e => updateRow(row.id, 'height', Number(e.target.value))}
                                    placeholder="mm"
                                    className="h-8 text-sm"
                                />
                            </div>
                            <div>
                                <Label className="text-[10px] uppercase text-muted-foreground">Quantità</Label>
                                <Input
                                    type="number"
                                    min={1}
                                    value={row.quantity || ''}
                                    onChange={e => updateRow(row.id, 'quantity', Math.max(1, Number(e.target.value)))}
                                    placeholder="pz"
                                    className="h-8 text-sm"
                                />
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                            onClick={() => removeRow(row.id)}
                            disabled={rows.length <= 1}
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                ))}

                {/* Bottoni azione */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={addRow}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Aggiungi Pezzo
                    </Button>
                    <Button
                        size="sm"
                        className="gap-1.5 ml-auto"
                        onClick={handleCalculate}
                        disabled={validRows.length === 0}
                    >
                        <Calculator className="h-3.5 w-3.5" />
                        Calcola Piano di Taglio
                    </Button>
                </div>

                {/* Riassunto pezzi/lastra */}
                {validRows.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                        <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                            📐 Stima pezzi per lastra ({sheetConfig.width}×{sheetConfig.height} mm)
                        </p>
                        {validRows.map((row, idx) => {
                            const pps = piecesPerSheet(
                                row.width, row.height,
                                sheetConfig.width, sheetConfig.height,
                                sheetConfig.gap
                            );
                            const sheetsNeeded = Math.ceil(row.quantity / pps);
                            return (
                                <div key={row.id} className="flex items-center justify-between text-sm">
                                    <span className="flex items-center gap-2">
                                        <span
                                            className="w-3 h-3 rounded-sm inline-block"
                                            style={{ backgroundColor: FLAT_COLORS[idx % FLAT_COLORS.length] }}
                                        />
                                        <span className="font-medium">{row.label || `Pezzo ${idx + 1}`}</span>
                                        <span className="text-muted-foreground">
                                            {row.width}×{row.height}
                                        </span>
                                    </span>
                                    <span className="font-mono text-xs">
                                        <strong>{pps}</strong> pz/lastra
                                        {row.quantity > pps && (
                                            <span className="text-muted-foreground ml-1">
                                                → {sheetsNeeded} lastre per {row.quantity} pz
                                            </span>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
