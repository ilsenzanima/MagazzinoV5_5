"use client";

import { useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Scissors, AlertTriangle } from "lucide-react";
import type { NestingSheet, SheetConfig, Remnant } from "@/lib/cutting-simulator/nesting";

interface CutPlanViewerProps {
    sheets: NestingSheet[];
    sheetConfig: SheetConfig;
    unplacedCount: number;
}

export function CutPlanViewer({ sheets, sheetConfig, unplacedCount }: CutPlanViewerProps) {
    if (sheets.length === 0) {
        return (
            <Card className="border-border/60 shadow-lg">
                <CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
                    <Scissors className="h-12 w-12 opacity-30" />
                    <p className="text-sm">Inserisci le misure e premi "Calcola Pezzi" per vedere il piano di taglio</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {unplacedCount > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span>{unplacedCount} pezz{unplacedCount === 1 ? 'o' : 'i'} non entrano nella lastra. Aumenta le dimensioni della lastra.</span>
                </div>
            )}

            {sheets.map((sheet) => (
                <SheetCanvas
                    key={sheet.index}
                    sheet={sheet}
                    sheetConfig={sheetConfig}
                />
            ))}
        </div>
    );
}

function SheetCanvas({
    sheet,
    sheetConfig,
}: {
    sheet: NestingSheet;
    sheetConfig: SheetConfig;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;

        // Calcola la scala per far entrare la lastra nella width disponibile
        const containerWidth = canvas.parentElement?.clientWidth || 600;
        const padding = 16;
        const availableWidth = containerWidth - padding * 2;

        const scale = Math.min(
            availableWidth / sheetConfig.width,
            400 / sheetConfig.height,
            1 // non zoommare oltre 1:1
        );

        const canvasW = sheetConfig.width * scale + padding * 2;
        const canvasH = sheetConfig.height * scale + padding * 2;

        canvas.style.width = `${canvasW}px`;
        canvas.style.height = `${canvasH}px`;
        canvas.width = canvasW * dpr;
        canvas.height = canvasH * dpr;
        ctx.scale(dpr, dpr);

        // Sfondo
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(0, 0, canvasW, canvasH);

        // Lastra
        ctx.fillStyle = "#1a1a2e";
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 1;
        ctx.fillRect(padding, padding, sheetConfig.width * scale, sheetConfig.height * scale);
        ctx.strokeRect(padding, padding, sheetConfig.width * scale, sheetConfig.height * scale);

        // Griglia leggera ogni 100mm
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 0.5;
        const step = 100 * scale;
        for (let x = step; x < sheetConfig.width * scale; x += step) {
            ctx.beginPath();
            ctx.moveTo(padding + x, padding);
            ctx.lineTo(padding + x, padding + sheetConfig.height * scale);
            ctx.stroke();
        }
        for (let y = step; y < sheetConfig.height * scale; y += step) {
            ctx.beginPath();
            ctx.moveTo(padding, padding + y);
            ctx.lineTo(padding + sheetConfig.width * scale, padding + y);
            ctx.stroke();
        }

        // Pezzi
        for (const placement of sheet.placements) {
            const px = padding + placement.x * scale;
            const py = padding + placement.y * scale;
            const pw = placement.width * scale;
            const ph = placement.height * scale;

            // Costruisci il percorso del pezzo (rettangolo o L)
            ctx.beginPath();
            if (placement.isLShaped && placement.lNotch) {
                const nw = placement.lNotch.w * scale;
                const nh = placement.lNotch.h * scale;
                const c = placement.lNotch.corner;

                // Disegna la sagoma a L (percorso orario)
                if (c === 'tr') {
                    // Incavo in alto a destra
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + pw - nw, py);
                    ctx.lineTo(px + pw - nw, py + nh);
                    ctx.lineTo(px + pw, py + nh);
                    ctx.lineTo(px + pw, py + ph);
                    ctx.lineTo(px, py + ph);
                } else if (c === 'tl') {
                    // Incavo in alto a sinistra
                    ctx.moveTo(px + nw, py);
                    ctx.lineTo(px + pw, py);
                    ctx.lineTo(px + pw, py + ph);
                    ctx.lineTo(px, py + ph);
                    ctx.lineTo(px, py + nh);
                    ctx.lineTo(px + nw, py + nh);
                } else if (c === 'br') {
                    // Incavo in basso a destra
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + pw, py);
                    ctx.lineTo(px + pw, py + ph - nh);
                    ctx.lineTo(px + pw - nw, py + ph - nh);
                    ctx.lineTo(px + pw - nw, py + ph);
                    ctx.lineTo(px, py + ph);
                } else {
                    // Incavo in basso a sinistra (bl)
                    ctx.moveTo(px, py);
                    ctx.lineTo(px + pw, py);
                    ctx.lineTo(px + pw, py + ph);
                    ctx.lineTo(px + nw, py + ph);
                    ctx.lineTo(px + nw, py + ph - nh);
                    ctx.lineTo(px, py + ph - nh);
                }
                ctx.closePath();
            } else {
                ctx.rect(px, py, pw, ph);
            }

            // Sfondo pezzo
            ctx.fillStyle = placement.piece.color + "40";
            ctx.fill();

            // Bordo pezzo
            ctx.strokeStyle = placement.piece.color;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Etichetta
            // Per pezzi a L, centrare leggermente nella parte con più materiale
            let labelCX = px + pw / 2;
            let labelCY = py + ph / 2;
            if (placement.isLShaped && placement.lNotch) {
                const c = placement.lNotch.corner;
                const nw = placement.lNotch.w * scale;
                const nh = placement.lNotch.h * scale;
                // Sposta il centro verso la zona con materiale
                if (c === 'tr') { labelCX -= nw * 0.2; labelCY += nh * 0.15; }
                else if (c === 'tl') { labelCX += nw * 0.2; labelCY += nh * 0.15; }
                else if (c === 'br') { labelCX -= nw * 0.2; labelCY -= nh * 0.15; }
                else { labelCX += nw * 0.2; labelCY -= nh * 0.15; }
            }

            const fontSize = Math.max(9, Math.min(14, Math.min(pw, ph) * 0.12));
            ctx.fillStyle = "#e2e8f0";
            ctx.font = `bold ${fontSize}px Inter, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const labelText = placement.piece.id.toUpperCase();
            ctx.fillText(labelText, labelCX, labelCY - fontSize * 0.6);

            // Dimensioni
            ctx.font = `${fontSize * 0.85}px monospace`;
            ctx.fillStyle = "#94a3b8";
            const dimText = `${placement.width.toFixed(0)}×${placement.height.toFixed(0)}`;
            ctx.fillText(dimText, labelCX, labelCY + fontSize * 0.5);

            // Indicatore rotazione
            if (placement.rotated) {
                ctx.font = `${fontSize * 0.7}px sans-serif`;
                ctx.fillStyle = "#f59e0b";
                ctx.fillText("↻", labelCX, labelCY + fontSize * 1.4);
            }

            // Indicatore forma L
            if (placement.isLShaped) {
                ctx.font = `${fontSize * 0.7}px sans-serif`;
                ctx.fillStyle = "#a78bfa";
                ctx.fillText("⌐ L", labelCX, labelCY + fontSize * (placement.rotated ? 2.2 : 1.4));
            }
        }

        // Avanzi riutilizzabili (rettangoli verdi tratteggiati)
        for (const rem of sheet.remnants) {
            const rx = padding + rem.x * scale;
            const ry = padding + rem.y * scale;
            const rw = rem.width * scale;
            const rh = rem.height * scale;

            // Sfondo leggero verde
            ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
            ctx.fillRect(rx, ry, rw, rh);

            // Bordo tratteggiato verde
            ctx.strokeStyle = "rgba(34, 197, 94, 0.5)";
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.setLineDash([]);

            // Dimensioni dell'avanzo (solo se abbastanza grande da leggersi)
            if (rw > 40 && rh > 20) {
                const remFontSize = Math.max(8, Math.min(11, Math.min(rw, rh) * 0.15));
                ctx.fillStyle = "rgba(34, 197, 94, 0.6)";
                ctx.font = `${remFontSize}px monospace`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(
                    `${rem.width.toFixed(0)}×${rem.height.toFixed(0)}`,
                    rx + rw / 2,
                    ry + rh / 2
                );
            }
        }

        // Quota lastra in basso
        ctx.fillStyle = "#64748b";
        ctx.font = "11px Inter, sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(
            `Lastra ${sheetConfig.width}×${sheetConfig.height} mm`,
            padding,
            canvasH - 3
        );
    }, [sheet, sheetConfig]);

    useEffect(() => {
        draw();
        window.addEventListener("resize", draw);
        return () => window.removeEventListener("resize", draw);
    }, [draw]);

    return (
        <Card className="border-border/60 shadow-lg overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base">
                            Lastra #{sheet.index + 1}
                        </CardTitle>
                        <Badge variant="outline" className="font-mono text-xs">
                            {sheet.placements.length} pezz{sheet.placements.length === 1 ? 'o' : 'i'}
                        </Badge>
                    </div>
                    <Badge
                        variant={sheet.utilization >= 70 ? "default" : "secondary"}
                        className="font-mono"
                    >
                        {sheet.utilization}% utilizzo
                    </Badge>
                </div>
                <CardDescription className="text-xs">
                    {sheet.placements.map((p) => p.piece.id.toUpperCase()).join(" · ")}
                </CardDescription>
                {sheet.remnants.length > 0 && (() => {
                    const biggest = sheet.remnants.reduce((best, r) =>
                        r.width * r.height > best.width * best.height ? r : best
                        , sheet.remnants[0]);
                    return (
                        <p className="text-[10px] text-emerald-500/80 mt-0.5">
                            🟩 Avanzo più grande: {biggest.width}×{biggest.height} mm
                            {sheet.remnants.length > 1 && ` (+${sheet.remnants.length - 1} altri)`}
                        </p>
                    );
                })()}
            </CardHeader>
            <CardContent className="p-2 flex justify-center bg-black/20 rounded-b-lg">
                <canvas ref={canvasRef} className="max-w-full" />
            </CardContent>
        </Card>
    );
}
