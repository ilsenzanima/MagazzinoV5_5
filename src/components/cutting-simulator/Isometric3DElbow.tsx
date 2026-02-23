"use client";

/**
 * Vista isometrica (pseudo-3D) di un gomito a 90°, resa in SVG puro.
 * Mostra i due bracci del cassonetto che si incontrano a 90°.
 */

interface Isometric3DElbowProps {
    innerWidth: number;
    innerHeight: number;
    armA: number;
    armB: number;
    thickness: number;
}

// Proiezione isometrica
function iso(x: number, y: number, z: number): { px: number; py: number } {
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

export function Isometric3DElbow({
    innerWidth,
    innerHeight,
    armA,
    armB,
    thickness,
}: Isometric3DElbowProps) {
    if (!innerWidth || !innerHeight || !armA || !armB || !thickness) return null;

    const W = innerWidth + 2 * thickness; // larghezza esterna
    const H = innerHeight + 2 * thickness; // altezza esterna

    // Scala
    const maxDim = Math.max(W + armB, W + armA, H);
    const s = maxDim > 0 ? 100 / maxDim : 1;

    const sW = W * s;
    const sH = H * s;
    const sA = armA * s;
    const sB = armB * s;

    // Calcola bounding box
    // Braccio A va in direzione Y (profondità), Braccio B in direzione X (destra)
    const allCorners = [
        // Braccio A (colonna verticale in profondità)
        iso(0, 0, 0), iso(sW, 0, 0), iso(sW, sA + sW, 0), iso(0, sA + sW, 0),
        iso(0, 0, sH), iso(sW, 0, sH), iso(sW, sA + sW, sH), iso(0, sA + sW, sH),
        // Braccio B (va verso destra)
        iso(sW, sA, 0), iso(sW + sB, sA, 0), iso(sW + sB, sA + sW, 0),
        iso(sW, sA, sH), iso(sW + sB, sA, sH), iso(sW + sB, sA + sW, sH),
    ];

    const minPx = Math.min(...allCorners.map(c => c.px));
    const maxPx = Math.max(...allCorners.map(c => c.px));
    const minPy = Math.min(...allCorners.map(c => c.py));
    const maxPy = Math.max(...allCorners.map(c => c.py));

    const pad = 16;
    const vw = maxPx - minPx + pad * 2;
    const vh = maxPy - minPy + pad * 2;
    const offsetX = -minPx + pad;
    const offsetY = -minPy + pad;

    const blue = "#3b82f6";
    const green = "#22c55e";
    const amber = "#f59e0b";

    // Braccio A: box dal fondo verso la zona angolo (direzione Y)
    const armATop = [
        { x: 0, y: 0, z: sH },
        { x: sW, y: 0, z: sH },
        { x: sW, y: sA, z: sH },
        { x: 0, y: sA, z: sH },
    ];
    const armALeft = [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: sH },
        { x: 0, y: sA + sW, z: sH },
        { x: 0, y: sA + sW, z: 0 },
    ];
    const armAFront = [
        { x: 0, y: 0, z: 0 },
        { x: sW, y: 0, z: 0 },
        { x: sW, y: 0, z: sH },
        { x: 0, y: 0, z: sH },
    ];

    // Zona angolo (cubo di giunzione)
    const junctionTop = [
        { x: 0, y: sA, z: sH },
        { x: sW, y: sA, z: sH },
        { x: sW, y: sA + sW, z: sH },
        { x: 0, y: sA + sW, z: sH },
    ];

    // Braccio B: box dalla zona angolo verso destra (direzione X)
    const armBTop = [
        { x: sW, y: sA, z: sH },
        { x: sW + sB, y: sA, z: sH },
        { x: sW + sB, y: sA + sW, z: sH },
        { x: sW, y: sA + sW, z: sH },
    ];
    const armBRight = [
        { x: sW + sB, y: sA, z: 0 },
        { x: sW + sB, y: sA, z: sH },
        { x: sW + sB, y: sA + sW, z: sH },
        { x: sW + sB, y: sA + sW, z: 0 },
    ];
    const armBFront = [
        { x: sW, y: sA, z: 0 },
        { x: sW + sB, y: sA, z: 0 },
        { x: sW + sB, y: sA, z: sH },
        { x: sW, y: sA, z: sH },
    ];
    const armBBottom = [
        { x: 0, y: sA + sW, z: 0 },
        { x: sW + sB, y: sA + sW, z: 0 },
        { x: sW + sB, y: sA + sW, z: sH },
        { x: 0, y: sA + sW, z: sH },
    ];

    return (
        <svg
            viewBox={`0 0 ${vw.toFixed(0)} ${vh.toFixed(0)}`}
            className="w-full max-w-[320px] mx-auto"
            style={{ height: Math.min(vh, 220) }}
        >
            <g transform={`translate(${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`}>
                {/* Facce posteriori (disegnate prima) */}
                <path d={isoPath(armBBottom)} fill={green + "10"} stroke={green} strokeWidth={0.8} />
                <path d={isoPath(armALeft)} fill={blue + "15"} stroke={blue} strokeWidth={0.8} />

                {/* Facce frontali */}
                <path d={isoPath(armAFront)} fill={blue + "25"} stroke={blue} strokeWidth={1} />
                <path d={isoPath(armBFront)} fill={green + "15"} stroke={green} strokeWidth={0.8} />
                <path d={isoPath(armBRight)} fill={green + "25"} stroke={green} strokeWidth={1} />

                {/* Facce superiori */}
                <path d={isoPath(armATop)} fill={blue + "35"} stroke={blue} strokeWidth={1.2} />
                <path d={isoPath(junctionTop)} fill={amber + "40"} stroke={amber} strokeWidth={1.5} strokeDasharray="4,3" />
                <path d={isoPath(armBTop)} fill={green + "35"} stroke={green} strokeWidth={1.2} />

                {/* Labels */}
                {(() => {
                    const labelA = iso(sW / 2, sA / 2, sH + 8);
                    const labelB = iso(sW + sB / 2, sA + sW / 2, sH + 8);
                    return (
                        <>
                            <text x={labelA.px} y={labelA.py} textAnchor="middle"
                                className="fill-blue-400 text-[8px] font-mono font-bold">A</text>
                            <text x={labelB.px} y={labelB.py} textAnchor="middle"
                                className="fill-green-400 text-[8px] font-mono font-bold">B</text>
                        </>
                    );
                })()}
            </g>
        </svg>
    );
}
