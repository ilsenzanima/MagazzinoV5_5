"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CornerDownRight, Plus, RotateCcw, Info } from "lucide-react";
import { PreviewPopup } from "@/components/cutting-simulator/PreviewPopup";
import { SinglePiece3DView } from "@/components/cutting-simulator/SinglePiece3DView";
import type { ElbowInput } from "@/lib/cutting-simulator/calculations";

interface ElbowFormProps {
    onCalculate: (input: ElbowInput) => void;
}

function FieldTip({ text }: { text: string }) {
    return (
        <span className="inline-flex items-center ml-1 group relative cursor-help">
            <Info className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs bg-popover text-popover-foreground border border-border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-52 text-center z-50 leading-relaxed">
                {text}
            </span>
        </span>
    );
}

export function ElbowForm({ onCalculate }: ElbowFormProps) {
    const [innerWidth, setInnerWidth] = useState<string>("200");
    const [innerHeight, setInnerHeight] = useState<string>("200");
    const [thickness, setThickness] = useState<string>("50");
    const [armA, setArmA] = useState<string>("500");
    const [armB, setArmB] = useState<string>("500");
    const [extraMargin, setExtraMargin] = useState<string>("0");
    const [baseMode, setBaseMode] = useState<'split' | 'single'>('split');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCalculate({
            innerWidth: parseFloat(innerWidth) || 0,
            innerHeight: parseFloat(innerHeight) || 0,
            thickness: parseFloat(thickness) || 0,
            armA: parseFloat(armA) || 0,
            armB: parseFloat(armB) || 0,
            extraMargin: parseFloat(extraMargin) || 0,
            baseMode,
        });
    };

    const handleReset = () => {
        setInnerWidth("200");
        setInnerHeight("200");
        setThickness("50");
        setArmA("500");
        setArmB("500");
        setExtraMargin("0");
        setBaseMode('split');
    };

    const w = parseFloat(innerWidth) || 0;
    const h = parseFloat(innerHeight) || 0;
    const t = parseFloat(thickness) || 0;
    const a = parseFloat(armA) || 0;
    const b = parseFloat(armB) || 0;

    return (
        <Card className="border-border/60 shadow-lg bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                        <CornerDownRight className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Angolo a 90°</CardTitle>
                        <CardDescription>Gomito con due bracci e taglio a 45° nella zona dell&apos;angolo</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Selettore modalità base */}
                    <div className="flex gap-1.5 p-1 bg-muted/50 rounded-lg">
                        <button type="button"
                            onClick={() => setBaseMode('split')}
                            className={cn(
                                "flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
                                baseMode === 'split'
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Base Separata
                        </button>
                        <button type="button"
                            onClick={() => setBaseMode('single')}
                            className={cn(
                                "flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all",
                                baseMode === 'single'
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            Base Unica (L)
                        </button>
                    </div>
                    {/* Sezione interna */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="elbowInnerWidth" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center">
                                Largh. interna
                                <FieldTip text="La stessa sezione interna del canale dritto a cui si collega l'angolo." />
                            </Label>
                            <div className="relative">
                                <Input id="elbowInnerWidth" type="number" min="1" step="1"
                                    value={innerWidth} onChange={(e) => setInnerWidth(e.target.value)}
                                    className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary pr-12" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="elbowInnerHeight" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center">
                                Alt. interna
                                <FieldTip text="Altezza interna della sezione. Definisce l'altezza dei fianchi." />
                            </Label>
                            <div className="relative">
                                <Input id="elbowInnerHeight" type="number" min="1" step="1"
                                    value={innerHeight} onChange={(e) => setInnerHeight(e.target.value)}
                                    className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary pr-12" />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                            </div>
                        </div>
                    </div>

                    {/* Bracci */}
                    <div className="border-t border-border/40 pt-4">
                        <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide font-medium">Lunghezza dei Bracci</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="armA" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center">
                                    Braccio A (ingresso)
                                    <FieldTip text="La lunghezza del primo tratto dritto del gomito, prima della curva. Il canale arriva da questa direzione." />
                                </Label>
                                <div className="relative">
                                    <Input id="armA" type="number" min="1" step="1"
                                        value={armA} onChange={(e) => setArmA(e.target.value)}
                                        className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary pr-12" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="armB" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center">
                                    Braccio B (uscita)
                                    <FieldTip text="La lunghezza del secondo tratto dritto, dopo la curva. Il canale prosegue in questa direzione a 90°." />
                                </Label>
                                <div className="relative">
                                    <Input id="armB" type="number" min="1" step="1"
                                        value={armB} onChange={(e) => setArmB(e.target.value)}
                                        className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary pr-12" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Spessore e margine */}
                    <div className="border-t border-border/40 pt-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="elbowThickness" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center">
                                    Spessore
                                    <FieldTip text="Spessore del materiale. Deve essere uguale a quello del tratto dritto a cui si collega." />
                                </Label>
                                <div className="relative">
                                    <Input id="elbowThickness" type="number" min="0" step="0.5"
                                        value={thickness} onChange={(e) => setThickness(e.target.value)}
                                        className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary pr-12" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="elbowExtraMargin" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center">
                                    Margine extra
                                    <FieldTip text="Margine aggiuntivo per giunzioni. Per cassonetti normali lascia 0." />
                                </Label>
                                <div className="relative">
                                    <Input id="elbowExtraMargin" type="number" min="0" step="1"
                                        value={extraMargin} onChange={(e) => setExtraMargin(e.target.value)}
                                        className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary pr-12" />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Anteprima 3D Reale */}
                    <div className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-900 group relative">
                        <div className="absolute top-3 left-3 z-10 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-md text-[10px] text-white font-bold uppercase tracking-wider">
                            Anteprima 3D
                        </div>
                        <SinglePiece3DView 
                            type="elbow90"
                            dimensions={{
                                innerWidth: w,
                                innerHeight: h,
                                thickness: t,
                                direction: "right" // Default preview direction
                            }}
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="submit" className="flex-1 h-12 font-bold text-base shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] active:scale-[0.98] bg-slate-900 hover:bg-slate-800">
                            <Plus className="mr-2 h-5 w-5" />
                            Calcola Pezzi
                        </Button>
                        <Button type="button" variant="outline" onClick={handleReset} className="h-12 w-12 border-slate-200">
                            <RotateCcw className="h-5 w-5 text-slate-400" />
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

/**
 * Preview SVG del gomito a 90° visto dall'alto
 */
function ElbowPreview({
    innerWidth,
    thickness,
    armA,
    armB,
}: {
    innerWidth: number;
    thickness: number;
    armA: number;
    armB: number;
}) {
    if (!innerWidth || !thickness || !armA || !armB) return null;

    const ow = innerWidth + 2 * thickness;

    // Scala
    const totalW = ow + armB;
    const totalH = ow + armA;
    const maxDim = Math.max(totalW, totalH);
    const s = maxDim > 0 ? 160 / maxDim : 1;

    const pad = 30;
    const svgW = totalW * s + pad * 2;
    const svgH = totalH * s + pad * 2;

    const sow = ow * s;
    const sArmA = armA * s;
    const sArmB = armB * s;
    const st = thickness * s;

    // Origine: angolo in alto a sinistra
    const ox = pad;
    const oy = pad;

    const blue = "#3b82f6";
    const red = "#ef4444";
    const green = "#22c55e";
    const amber = "#f59e0b";

    return (
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[260px] mx-auto" style={{ height: Math.min(svgH, 200) }}>
            {/* Braccio A (verticale, va dall'alto verso la zona angolo) */}
            <rect x={ox} y={oy} width={sow} height={sArmA + sow}
                fill={blue + "15"} stroke={blue} strokeWidth={1.2} rx={1} />

            {/* Braccio B (orizzontale, va dalla zona angolo verso destra) */}
            <rect x={ox + sow} y={oy + sArmA} width={sArmB} height={sow}
                fill={green + "15"} stroke={green} strokeWidth={1.2} rx={1} />

            {/* Zona angolo (sovrapposta) */}
            <rect x={ox} y={oy + sArmA} width={sow} height={sow}
                fill={amber + "25"} stroke={amber} strokeWidth={1.5} strokeDasharray="4,3" rx={1} />

            {/* Taglio a 45° */}
            <line
                x1={ox} y1={oy + sArmA}
                x2={ox + sow} y2={oy + sArmA + sow}
                stroke={red} strokeWidth={2} strokeDasharray="6,3"
            />

            {/* Cavità interna braccio A */}
            <rect x={ox + st} y={oy + st} width={sow - 2 * st} height={sArmA - st + sow}
                fill="none" stroke="hsl(var(--foreground) / 0.1)" strokeWidth={0.5} strokeDasharray="3,3" />

            {/* Quote */}
            {/* Braccio A a sinistra */}
            <line x1={ox - 10} y1={oy} x2={ox - 10} y2={oy + sArmA} stroke="hsl(var(--foreground) / 0.3)" strokeWidth={0.8} />
            <line x1={ox - 14} y1={oy} x2={ox - 6} y2={oy} stroke="hsl(var(--foreground) / 0.3)" strokeWidth={0.8} />
            <line x1={ox - 14} y1={oy + sArmA} x2={ox - 6} y2={oy + sArmA} stroke="hsl(var(--foreground) / 0.3)" strokeWidth={0.8} />
            <text x={ox - 16} y={oy + sArmA / 2 + 3}
                textAnchor="end" className="fill-primary text-[8px] font-mono">A:{armA}</text>

            {/* Braccio B in basso */}
            <line x1={ox + sow} y1={oy + sArmA + sow + 10} x2={ox + sow + sArmB} y2={oy + sArmA + sow + 10}
                stroke="hsl(var(--foreground) / 0.3)" strokeWidth={0.8} />
            <line x1={ox + sow} y1={oy + sArmA + sow + 6} x2={ox + sow} y2={oy + sArmA + sow + 14}
                stroke="hsl(var(--foreground) / 0.3)" strokeWidth={0.8} />
            <line x1={ox + sow + sArmB} y1={oy + sArmA + sow + 6} x2={ox + sow + sArmB} y2={oy + sArmA + sow + 14}
                stroke="hsl(var(--foreground) / 0.3)" strokeWidth={0.8} />
            <text x={ox + sow + sArmB / 2} y={oy + sArmA + sow + 22}
                textAnchor="middle" className="fill-primary text-[8px] font-mono">B:{armB}</text>

            {/* Label taglio */}
            <text x={ox + sow / 2 - 4} y={oy + sArmA + sow / 2 + 3}
                textAnchor="middle" className="fill-destructive text-[8px] font-bold">45°</text>
        </svg>
    );
}
