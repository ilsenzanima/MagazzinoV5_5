"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Ruler, Plus, RotateCcw, Info } from "lucide-react";
import { Isometric3DView } from "@/components/cutting-simulator/Isometric3DView";
import { PreviewPopup } from "@/components/cutting-simulator/PreviewPopup";
import type { DuctInput } from "@/lib/cutting-simulator/calculations";

interface DuctFormProps {
    onCalculate: (input: DuctInput) => void;
}

/**
 * Componente tooltip inline per spiegare i campi.
 */
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

export function DuctForm({ onCalculate }: DuctFormProps) {
    const [innerWidth, setInnerWidth] = useState<string>("200");
    const [innerHeight, setInnerHeight] = useState<string>("200");
    const [length, setLength] = useState<string>("1000");
    const [thickness, setThickness] = useState<string>("50");
    const [extraMargin, setExtraMargin] = useState<string>("0");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCalculate({
            innerWidth: parseFloat(innerWidth) || 0,
            innerHeight: parseFloat(innerHeight) || 0,
            length: parseFloat(length) || 0,
            thickness: parseFloat(thickness) || 0,
            extraMargin: parseFloat(extraMargin) || 0,
        });
    };

    const handleReset = () => {
        setInnerWidth("200");
        setInnerHeight("200");
        setLength("1000");
        setThickness("50");
        setExtraMargin("0");
    };

    const w = parseFloat(innerWidth) || 0;
    const h = parseFloat(innerHeight) || 0;
    const t = parseFloat(thickness) || 0;

    return (
        <Card className="border-border/60 shadow-lg bg-gradient-to-br from-card to-card/80">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Ruler className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Canale Rettangolare</CardTitle>
                        <CardDescription>Misure interne del passaggio + spessore del materiale</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Sezione interna */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="innerWidth" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center">
                                Largh. interna
                                <FieldTip text="La misura orizzontale del buco interno dove passeranno i fumi o l'aria. Non include lo spessore del materiale." />
                            </Label>
                            <div className="relative">
                                <Input
                                    id="innerWidth"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={innerWidth}
                                    onChange={(e) => setInnerWidth(e.target.value)}
                                    className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary pr-12"
                                    placeholder="200"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="innerHeight" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center">
                                Alt. interna
                                <FieldTip text="La misura verticale del buco interno. Insieme alla larghezza definisce la sezione del canale." />
                            </Label>
                            <div className="relative">
                                <Input
                                    id="innerHeight"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={innerHeight}
                                    onChange={(e) => setInnerHeight(e.target.value)}
                                    className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary pr-12"
                                    placeholder="200"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="length" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center">
                            Lunghezza tratto
                            <FieldTip text="Quanto è lungo il tratto dritto del canale. Tutti e 4 i pannelli avranno questa lunghezza." />
                        </Label>
                        <div className="relative">
                            <Input
                                id="length"
                                type="number"
                                min="1"
                                step="1"
                                value={length}
                                onChange={(e) => setLength(e.target.value)}
                                className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary pr-12"
                                placeholder="1000"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                        </div>
                    </div>

                    <div className="border-t border-border/40 pt-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="thickness" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center">
                                    Spessore
                                    <FieldTip text="Lo spessore della lastra/pannello. I pezzi Base e Coperchio saranno più larghi di 2× questo valore perché avvolgono i fianchi." />
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="thickness"
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={thickness}
                                        onChange={(e) => setThickness(e.target.value)}
                                        className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary pr-12"
                                        placeholder="50"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="extraMargin" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center">
                                    Margine extra
                                    <FieldTip text="Margine aggiuntivo per sigillature o fissaggi speciali. Per cassonetti normali lascia 0: il sormonto è già dato dallo spessore." />
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="extraMargin"
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={extraMargin}
                                        onChange={(e) => setExtraMargin(e.target.value)}
                                        className="h-11 text-lg font-mono bg-background/50 border-border/50 focus:border-primary pr-12"
                                        placeholder="0"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Anteprime: sezione frontale + vista 3D — cliccabili per ingrandimento */}
                    <div className="border border-dashed border-border/50 rounded-lg bg-muted/30 overflow-hidden">
                        <div className="grid grid-cols-2 divide-x divide-border/30">
                            <PreviewPopup title="Vista Frontale — Sezione del Cassonetto">
                                <div className="p-3">
                                    <p className="text-xs text-muted-foreground text-center mb-2">Vista Frontale</p>
                                    <DuctAssemblyPreview
                                        innerWidth={w}
                                        innerHeight={h}
                                        thickness={t}
                                    />
                                </div>
                            </PreviewPopup>
                            <PreviewPopup title="Vista 3D Isometrica — Cassonetto Assemblato">
                                <div className="p-3">
                                    <p className="text-xs text-muted-foreground text-center mb-2">Vista 3D</p>
                                    <Isometric3DView
                                        innerWidth={w}
                                        innerHeight={h}
                                        length={parseFloat(length) || 0}
                                        thickness={t}
                                    />
                                </div>
                            </PreviewPopup>
                        </div>
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
 * Anteprima SVG del cassonetto assemblato — mostra i 4 pannelli colorati
 * nella posizione corretta e le quote principali.
 */
function DuctAssemblyPreview({
    innerWidth,
    innerHeight,
    thickness,
}: {
    innerWidth: number;
    innerHeight: number;
    thickness: number;
}) {
    if (!innerWidth || !innerHeight || !thickness) return null;

    const outerW = innerWidth + 2 * thickness;
    const outerH = innerHeight + 2 * thickness;

    // Scala per riquadro ~220px
    const maxDim = Math.max(outerW, outerH);
    const scale = maxDim > 0 ? 180 / maxDim : 1;

    // Spazio per le quote
    const quotePadding = 40;
    const svgW = outerW * scale + quotePadding * 2;
    const svgH = outerH * scale + quotePadding * 2;

    const ox = quotePadding; // offset x
    const oy = quotePadding; // offset y

    const tw = thickness * scale; // spessore scalato
    const iw = innerWidth * scale;
    const ih = innerHeight * scale;
    const ow = outerW * scale;
    const oh = outerH * scale;

    const blue = "#3b82f6";
    const red = "#ef4444";

    return (
        <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            className="w-full max-w-[280px] mx-auto"
            style={{ height: Math.min(svgH, 200) }}
        >
            {/* Base (pannello orizzontale inferiore) */}
            <rect x={ox} y={oy + oh - tw} width={ow} height={tw}
                fill={blue + "30"} stroke={blue} strokeWidth={1.5} rx={1} />

            {/* Coperchio (pannello orizzontale superiore) */}
            <rect x={ox} y={oy} width={ow} height={tw}
                fill={blue + "30"} stroke={blue} strokeWidth={1.5} rx={1} />

            {/* Fianco sinistro (pannello verticale) */}
            <rect x={ox} y={oy + tw} width={tw} height={ih}
                fill={red + "30"} stroke={red} strokeWidth={1.5} rx={1} />

            {/* Fianco destro (pannello verticale) */}
            <rect x={ox + ow - tw} y={oy + tw} width={tw} height={ih}
                fill={red + "30"} stroke={red} strokeWidth={1.5} rx={1} />

            {/* Cavità interna */}
            <rect x={ox + tw} y={oy + tw} width={iw} height={ih}
                fill="hsl(var(--background))" stroke="hsl(var(--foreground) / 0.15)"
                strokeWidth={0.5} strokeDasharray="4,3" />

            {/* Testo cavità */}
            <text x={ox + tw + iw / 2} y={oy + tw + ih / 2 + 4}
                textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono">
                {innerWidth}×{innerHeight}
            </text>

            {/* --- QUOTE --- */}

            {/* Quota orizzontale esterna (sopra) */}
            <line x1={ox} y1={oy - 12} x2={ox + ow} y2={oy - 12}
                stroke="hsl(var(--foreground) / 0.4)" strokeWidth={0.8} />
            <line x1={ox} y1={oy - 16} x2={ox} y2={oy - 8}
                stroke="hsl(var(--foreground) / 0.4)" strokeWidth={0.8} />
            <line x1={ox + ow} y1={oy - 16} x2={ox + ow} y2={oy - 8}
                stroke="hsl(var(--foreground) / 0.4)" strokeWidth={0.8} />
            <text x={ox + ow / 2} y={oy - 16}
                textAnchor="middle" className="fill-primary text-[9px] font-mono font-bold">
                {outerW}
            </text>

            {/* Quota verticale esterna (a destra) */}
            <line x1={ox + ow + 12} y1={oy} x2={ox + ow + 12} y2={oy + oh}
                stroke="hsl(var(--foreground) / 0.4)" strokeWidth={0.8} />
            <line x1={ox + ow + 8} y1={oy} x2={ox + ow + 16} y2={oy}
                stroke="hsl(var(--foreground) / 0.4)" strokeWidth={0.8} />
            <line x1={ox + ow + 8} y1={oy + oh} x2={ox + ow + 16} y2={oy + oh}
                stroke="hsl(var(--foreground) / 0.4)" strokeWidth={0.8} />
            <text x={ox + ow + 24} y={oy + oh / 2 + 3}
                textAnchor="middle" className="fill-primary text-[9px] font-mono font-bold"
                transform={`rotate(90, ${ox + ow + 24}, ${oy + oh / 2 + 3})`}>
                {outerH}
            </text>

            {/* Quota spessore (in basso a sinistra) */}
            {tw > 8 && (
                <text x={ox + tw / 2} y={oy + oh + 16}
                    textAnchor="middle" className="fill-muted-foreground text-[8px] font-mono">
                    sp.{thickness}
                </text>
            )}

            {/* Legenda colori */}
            <rect x={ox} y={oy + oh + 24} width={8} height={8} fill={blue + "60"} stroke={blue} strokeWidth={0.8} rx={1} />
            <text x={ox + 12} y={oy + oh + 31} className="fill-foreground text-[8px]">Base/Coperchio</text>

            <rect x={ox + 85} y={oy + oh + 24} width={8} height={8} fill={red + "60"} stroke={red} strokeWidth={0.8} rx={1} />
            <text x={ox + 97} y={oy + oh + 31} className="fill-foreground text-[8px]">Fianchi</text>
        </svg>
    );
}
