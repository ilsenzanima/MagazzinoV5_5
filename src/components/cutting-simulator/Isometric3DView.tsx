"use client";

/**
 * Vista isometrica (pseudo-3D) del cassonetto assemblato, resa in SVG puro.
 * Usa una proiezione isometrica semplificata:
 *   - Asse X → verso destra-basso (30°)
 *   - Asse Y → verso sinistra-basso (30°)
 *   - Asse Z → verso l'alto
 */

interface Isometric3DViewProps {
    innerWidth: number;
    innerHeight: number;
    length: number;
    thickness: number;
}

// Proiezione isometrica: converte coordinate 3D → 2D
function iso(x: number, y: number, z: number): { px: number; py: number } {
    // Angolo isometrico standard ~30°
    const cos30 = 0.866;
    const sin30 = 0.5;
    return {
        px: (x - y) * cos30,
        py: (x + y) * sin30 - z,
    };
}

function isoPath(points: { x: number; y: number; z: number }[]): string {
    return points
        .map((p, i) => {
            const { px, py } = iso(p.x, p.y, p.z);
            return `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`;
        })
        .join(" ") + " Z";
}

export function Isometric3DView({
    innerWidth,
    innerHeight,
    length,
    thickness,
}: Isometric3DViewProps) {
    if (!innerWidth || !innerHeight || !length || !thickness) return null;

    const W = innerWidth + 2 * thickness; // larghezza esterna
    const H = innerHeight + 2 * thickness; // altezza esterna
    const L = length; // profondità
    const T = thickness;

    // Scala: fit within ~300px
    const maxDim = Math.max(W, H, L);
    const s = maxDim > 0 ? 120 / maxDim : 1;

    const sW = W * s;
    const sH = H * s;
    const sL = L * s;
    const sT = T * s;

    // Calcola bounding box per centrare
    const corners = [
        iso(0, 0, 0),
        iso(sW, 0, 0),
        iso(0, sL, 0),
        iso(sW, sL, 0),
        iso(0, 0, sH),
        iso(sW, 0, sH),
        iso(0, sL, sH),
        iso(sW, sL, sH),
    ];
    const minPx = Math.min(...corners.map((c) => c.px));
    const maxPx = Math.max(...corners.map((c) => c.px));
    const minPy = Math.min(...corners.map((c) => c.py));
    const maxPy = Math.max(...corners.map((c) => c.py));

    const pad = 20;
    const vw = maxPx - minPx + pad * 2;
    const vh = maxPy - minPy + pad * 2;
    const offsetX = -minPx + pad;
    const offsetY = -minPy + pad;

    const blue = "#3b82f6";
    const red = "#ef4444";
    const blueLight = "#3b82f620";
    const blueMed = "#3b82f640";
    const redLight = "#ef444420";
    const redMed = "#ef444440";

    // Definizione dei pannelli (dal più lontano al più vicino per z-order corretto)

    // --- PANNELLO BASE (orizzontale, z=0) ---
    const baseFront = [
        { x: 0, y: 0, z: 0 },
        { x: sW, y: 0, z: 0 },
        { x: sW, y: sL, z: 0 },
        { x: 0, y: sL, z: 0 },
    ];
    const baseTop = [
        { x: 0, y: 0, z: sT },
        { x: sW, y: 0, z: sT },
        { x: sW, y: sL, z: sT },
        { x: 0, y: sL, z: sT },
    ];

    // --- FIANCO SINISTRO (verticale, x=0) --- 
    const leftOuter = [
        { x: 0, y: 0, z: sT },
        { x: 0, y: sL, z: sT },
        { x: 0, y: sL, z: sH - sT },
        { x: 0, y: 0, z: sH - sT },
    ];
    const leftInner = [
        { x: sT, y: 0, z: sT },
        { x: sT, y: sL, z: sT },
        { x: sT, y: sL, z: sH - sT },
        { x: sT, y: 0, z: sH - sT },
    ];

    // --- FIANCO DESTRO (verticale, x=W) --- visibile in isometrica
    const rightOuter = [
        { x: sW, y: 0, z: sT },
        { x: sW, y: sL, z: sT },
        { x: sW, y: sL, z: sH - sT },
        { x: sW, y: 0, z: sH - sT },
    ];
    const rightInner = [
        { x: sW - sT, y: 0, z: sT },
        { x: sW - sT, y: sL, z: sT },
        { x: sW - sT, y: sL, z: sH - sT },
        { x: sW - sT, y: 0, z: sH - sT },
    ];

    // --- COPERCHIO (orizzontale, z=H-T→H) ---
    const topBottom = [
        { x: 0, y: 0, z: sH - sT },
        { x: sW, y: 0, z: sH - sT },
        { x: sW, y: sL, z: sH - sT },
        { x: 0, y: sL, z: sH - sT },
    ];
    const topTop = [
        { x: 0, y: 0, z: sH },
        { x: sW, y: 0, z: sH },
        { x: sW, y: sL, z: sH },
        { x: 0, y: sL, z: sH },
    ];

    // Faccia frontale della cavità (y=0, tra i fianchi)
    const cavityFront = [
        { x: sT, y: 0, z: sT },
        { x: sW - sT, y: 0, z: sT },
        { x: sW - sT, y: 0, z: sH - sT },
        { x: sT, y: 0, z: sH - sT },
    ];

    return (
        <svg
            viewBox={`0 0 ${vw.toFixed(0)} ${vh.toFixed(0)}`}
            className="w-full max-w-[320px] mx-auto"
            style={{ height: Math.min(vh, 220) }}
        >
            <g transform={`translate(${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`}>
                {/* Base bottom face */}
                <path d={isoPath(baseFront)} fill={blueMed} stroke={blue} strokeWidth={1} />
                {/* Base top face */}
                <path d={isoPath(baseTop)} fill={blueLight} stroke={blue} strokeWidth={0.8} />

                {/* Fianco sinistro (dietro, lato Y lungo) */}
                <path d={isoPath(leftOuter)} fill={redMed} stroke={red} strokeWidth={1} />

                {/* Fianco destro (davanti) */}
                <path d={isoPath(rightOuter)} fill={redLight} stroke={red} strokeWidth={1} />
                <path d={isoPath(rightInner)} fill="none" stroke={red} strokeWidth={0.5} strokeDasharray="3,3" />

                {/* Fianco sinistro interno (tratteggiato) */}
                <path d={isoPath(leftInner)} fill="none" stroke={red} strokeWidth={0.5} strokeDasharray="3,3" />

                {/* Cavità frontale */}
                <path d={isoPath(cavityFront)} fill="hsl(var(--background) / 0.6)" stroke="hsl(var(--foreground) / 0.15)" strokeWidth={0.5} strokeDasharray="4,3" />

                {/* Coperchio */}
                <path d={isoPath(topBottom)} fill={blueLight} stroke={blue} strokeWidth={0.5} strokeDasharray="3,3" />
                <path d={isoPath(topTop)} fill={blueMed} stroke={blue} strokeWidth={1} />

                {/* Label al centro della faccia superiore */}
                {(() => {
                    const center = iso(sW / 2, sL / 2, sH + 8);
                    return (
                        <text
                            x={center.px}
                            y={center.py}
                            textAnchor="middle"
                            className="fill-muted-foreground text-[9px] font-mono"
                        >
                            {innerWidth + 2 * thickness}×{innerHeight + 2 * thickness}×{length}
                        </text>
                    );
                })()}
            </g>
        </svg>
    );
}
