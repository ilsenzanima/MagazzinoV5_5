"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
import type { CutPiece } from "@/lib/cutting-simulator/calculations";

interface PiecesListProps {
    pieces: CutPiece[];
    totalArea: number;
    summary: string;
}

export function PiecesList({ pieces, totalArea, summary }: PiecesListProps) {
    if (pieces.length === 0) return null;

    return (
        <Card className="border-border/60 shadow-lg">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                        <Package className="h-5 w-5 text-emerald-500" />
                    </div>
                    <CardTitle className="text-lg">Pezzi Calcolati</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                {pieces.map((piece) => (
                    <div
                        key={piece.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-muted/20"
                    >
                        <div
                            className="w-4 h-4 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: piece.color }}
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{piece.label}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                                {piece.width.toFixed(0)} × {piece.height.toFixed(0)} mm
                            </p>
                        </div>
                        <Badge variant="secondary" className="font-mono text-xs">
                            ×{piece.quantity}
                        </Badge>
                    </div>
                ))}

                <div className="border-t border-border/40 pt-3 mt-3">
                    <p className="text-xs text-muted-foreground whitespace-pre-line">{summary}</p>
                    <p className="text-sm font-semibold mt-1">
                        Superficie totale:{" "}
                        <span className="text-primary font-mono">
                            {(totalArea / 1_000_000).toFixed(3)} m²
                        </span>
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
