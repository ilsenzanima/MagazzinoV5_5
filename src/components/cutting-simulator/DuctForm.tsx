"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Ruler, Plus, RotateCcw } from "lucide-react";
import type { DuctInput } from "@/lib/cutting-simulator/calculations";

interface DuctFormProps {
    onCalculate: (input: DuctInput) => void;
}

export function DuctForm({ onCalculate }: DuctFormProps) {
    const [innerWidth, setInnerWidth] = useState<string>("200");
    const [innerHeight, setInnerHeight] = useState<string>("200");
    const [length, setLength] = useState<string>("1000");
    const [thickness, setThickness] = useState<string>("50");
    const [overlap, setOverlap] = useState<string>("30");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCalculate({
            innerWidth: parseFloat(innerWidth) || 0,
            innerHeight: parseFloat(innerHeight) || 0,
            length: parseFloat(length) || 0,
            thickness: parseFloat(thickness) || 0,
            overlap: parseFloat(overlap) || 0,
        });
    };

    const handleReset = () => {
        setInnerWidth("200");
        setInnerHeight("200");
        setLength("1000");
        setThickness("50");
        setOverlap("30");
    };

    return (
        <Card className="border-border/60 shadow-lg bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Ruler className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Canale Rettangolare</CardTitle>
                        <CardDescription>Inserisci le misure interne e lo spessore del materiale</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Sezione interna */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="innerWidth" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Largh. interna (mm)
                            </Label>
                            <Input
                                id="innerWidth"
                                type="number"
                                min="1"
                                step="1"
                                value={innerWidth}
                                onChange={(e) => setInnerWidth(e.target.value)}
                                className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary"
                                placeholder="200"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="innerHeight" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                Alt. interna (mm)
                            </Label>
                            <Input
                                id="innerHeight"
                                type="number"
                                min="1"
                                step="1"
                                value={innerHeight}
                                onChange={(e) => setInnerHeight(e.target.value)}
                                className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary"
                                placeholder="200"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="length" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Lunghezza tratto (mm)
                        </Label>
                        <Input
                            id="length"
                            type="number"
                            min="1"
                            step="1"
                            value={length}
                            onChange={(e) => setLength(e.target.value)}
                            className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary"
                            placeholder="1000"
                        />
                    </div>

                    <div className="border-t border-border/40 pt-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="thickness" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Spessore (mm)
                                </Label>
                                <Input
                                    id="thickness"
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={thickness}
                                    onChange={(e) => setThickness(e.target.value)}
                                    className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary"
                                    placeholder="50"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="overlap" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Sormonto (mm)
                                </Label>
                                <Input
                                    id="overlap"
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={overlap}
                                    onChange={(e) => setOverlap(e.target.value)}
                                    className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary"
                                    placeholder="30"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Sezione grafica: anteprima della sezione del canale */}
                    <div className="border border-dashed border-border/50 rounded-lg p-3 bg-muted/30">
                        <p className="text-xs text-muted-foreground text-center mb-2">Sezione del canale (vista frontale)</p>
                        <DuctCrossSection
                            innerWidth={parseFloat(innerWidth) || 0}
                            innerHeight={parseFloat(innerHeight) || 0}
                            thickness={parseFloat(thickness) || 0}
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="submit" className="flex-1 h-11 font-semibold">
                            <Plus className="mr-2 h-4 w-4" />
                            Calcola Pezzi
                        </Button>
                        <Button type="button" variant="outline" onClick={handleReset} className="h-11">
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

/**
 * Mini-anteprima SVG della sezione trasversale del canale.
 */
function DuctCrossSection({
    innerWidth,
    innerHeight,
    thickness,
}: {
    innerWidth: number;
    innerHeight: number;
    thickness: number;
}) {
    if (!innerWidth || !innerHeight) return null;

    const outerW = innerWidth + 2 * thickness;
    const outerH = innerHeight + 2 * thickness;

    // Scala per entrare in un riquadro di ~180px
    const maxDim = Math.max(outerW, outerH);
    const scale = maxDim > 0 ? 160 / maxDim : 1;

    const svgW = outerW * scale + 20;
    const svgH = outerH * scale + 20;

    const ox = 10;
    const oy = 10;

    return (
        <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full max-w-[200px] mx-auto"
            style={{ height: Math.min(svgH, 140) }}
        >
            {/* Pannello esterno */}
            <rect
                x={ox}
                y={oy}
                width={outerW * scale}
                height={outerH * scale}
                fill="hsl(var(--primary) / 0.15)"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                rx={2}
            />
            {/* Cavità interna */}
            <rect
                x={ox + thickness * scale}
                y={oy + thickness * scale}
                width={innerWidth * scale}
                height={innerHeight * scale}
                fill="hsl(var(--background))"
                stroke="hsl(var(--primary) / 0.5)"
                strokeWidth={1}
                strokeDasharray="3,3"
                rx={1}
            />
            {/* Quota larghezza interna */}
            <text
                x={ox + outerW * scale / 2}
                y={oy + thickness * scale + innerHeight * scale / 2 + 4}
                textAnchor="middle"
                className="fill-primary text-[10px] font-mono"
            >
                {innerWidth}×{innerHeight}
            </text>
        </svg>
    );
}
