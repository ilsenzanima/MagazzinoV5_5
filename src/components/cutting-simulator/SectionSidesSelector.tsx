"use client";

import type { DuctSides } from "@/lib/cutting-simulator/project-model";

interface SectionSidesSelectorProps {
    innerWidth: number;
    innerHeight: number;
    thickness: number;
    sides: DuctSides;
    onChange: (sides: DuctSides) => void;
}

/**
 * Preview SVG interattiva della sezione frontale.
 * I 4 lati sono cliccabili: attivo = colorato, disattivato = grigio tratteggiato.
 */
export function SectionSidesSelector({
    innerWidth,
    innerHeight,
    thickness,
    sides,
    onChange,
}: SectionSidesSelectorProps) {
    const outerW = innerWidth + 2 * thickness;
    const outerH = innerHeight + 2 * thickness;

    const maxDim = Math.max(outerW, outerH);
    const scale = maxDim > 0 ? 140 / maxDim : 1;

    const pad = 32;
    const svgW = outerW * scale + pad * 2;
    const svgH = outerH * scale + pad * 2;

    const ox = pad;
    const oy = pad;
    const tw = thickness * scale;
    const iw = innerWidth * scale;
    const ih = innerHeight * scale;
    const ow = outerW * scale;
    const oh = outerH * scale;

    const toggleSide = (side: keyof DuctSides) => {
        onChange({ ...sides, [side]: !sides[side] });
    };

    const sideStyle = (active: boolean) => ({
        fill: active ? (active ? undefined : "transparent") : "hsl(var(--muted) / 0.3)",
        stroke: active ? undefined : "hsl(var(--muted-foreground) / 0.3)",
        strokeWidth: active ? 1.5 : 1,
        strokeDasharray: active ? undefined : "4,3",
        cursor: "pointer" as const,
        transition: "all 0.2s",
    });

    const blue = "#3b82f6";
    const red = "#ef4444";

    return (
        <div className="space-y-2">
            <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full max-w-[220px] mx-auto" style={{ height: Math.min(svgH, 180) }}>
                {/* Coperchio (top) */}
                <rect
                    x={ox} y={oy} width={ow} height={tw}
                    fill={sides.top ? blue + "30" : "hsl(var(--muted) / 0.15)"}
                    stroke={sides.top ? blue : "hsl(var(--muted-foreground) / 0.3)"}
                    strokeWidth={sides.top ? 1.5 : 1}
                    strokeDasharray={sides.top ? undefined : "4,3"}
                    rx={1}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => toggleSide('top')}
                />

                {/* Base (bottom) */}
                <rect
                    x={ox} y={oy + oh - tw} width={ow} height={tw}
                    fill={sides.bottom ? blue + "30" : "hsl(var(--muted) / 0.15)"}
                    stroke={sides.bottom ? blue : "hsl(var(--muted-foreground) / 0.3)"}
                    strokeWidth={sides.bottom ? 1.5 : 1}
                    strokeDasharray={sides.bottom ? undefined : "4,3"}
                    rx={1}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => toggleSide('bottom')}
                />

                {/* Fianco sinistro (left) */}
                <rect
                    x={ox} y={oy + tw} width={tw} height={ih}
                    fill={sides.left ? red + "30" : "hsl(var(--muted) / 0.15)"}
                    stroke={sides.left ? red : "hsl(var(--muted-foreground) / 0.3)"}
                    strokeWidth={sides.left ? 1.5 : 1}
                    strokeDasharray={sides.left ? undefined : "4,3"}
                    rx={1}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => toggleSide('left')}
                />

                {/* Fianco destro (right) */}
                <rect
                    x={ox + ow - tw} y={oy + tw} width={tw} height={ih}
                    fill={sides.right ? red + "30" : "hsl(var(--muted) / 0.15)"}
                    stroke={sides.right ? red : "hsl(var(--muted-foreground) / 0.3)"}
                    strokeWidth={sides.right ? 1.5 : 1}
                    strokeDasharray={sides.right ? undefined : "4,3"}
                    rx={1}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => toggleSide('right')}
                />

                {/* Cavità interna */}
                <rect
                    x={ox + tw} y={oy + tw} width={iw} height={ih}
                    fill="hsl(var(--background))"
                    stroke="hsl(var(--foreground) / 0.1)"
                    strokeWidth={0.5} strokeDasharray="3,3"
                />

                {/* Label lati */}
                <text x={ox + ow / 2} y={oy - 6} textAnchor="middle"
                    className={`text-[8px] font-mono ${sides.top ? 'fill-blue-400' : 'fill-muted-foreground/40'}`}>
                    Coperchio {sides.top ? '✓' : '✗'}
                </text>
                <text x={ox + ow / 2} y={oy + oh + 14} textAnchor="middle"
                    className={`text-[8px] font-mono ${sides.bottom ? 'fill-blue-400' : 'fill-muted-foreground/40'}`}>
                    Base {sides.bottom ? '✓' : '✗'}
                </text>
                <text x={ox - 4} y={oy + tw + ih / 2 + 3} textAnchor="end"
                    className={`text-[8px] font-mono ${sides.left ? 'fill-red-400' : 'fill-muted-foreground/40'}`}>
                    Sx {sides.left ? '✓' : '✗'}
                </text>
                <text x={ox + ow + 4} y={oy + tw + ih / 2 + 3} textAnchor="start"
                    className={`text-[8px] font-mono ${sides.right ? 'fill-red-400' : 'fill-muted-foreground/40'}`}>
                    Dx {sides.right ? '✓' : '✗'}
                </text>

                {/* Dimensione cavità */}
                <text x={ox + tw + iw / 2} y={oy + tw + ih / 2 + 3} textAnchor="middle"
                    className="fill-muted-foreground text-[9px] font-mono">
                    {innerWidth}×{innerHeight}
                </text>
            </svg>
            <p className="text-xs text-muted-foreground text-center">
                Clicca per attivare/disattivare un lato
            </p>
        </div>
    );
}
