"use client";

/**
 * Vista isometrica (pseudo-3D) di un gomito a 90°.
 * Disegna un solido a L con i due bracci che si incontrano all'angolo.
 * Usa wireframe con facce semitrasparenti per massima chiarezza.
 */

interface Isometric3DElbowProps {
    innerWidth: number;
    innerHeight: number;
    armA: number;
    armB: number;
    thickness: number;
}

function iso(x: number, y: number, z: number): [number, number] {
    const cos30 = 0.866;
    const sin30 = 0.5;
    return [(x - y) * cos30, (x + y) * sin30 - z];
}

function pt(x: number, y: number, z: number): string {
    const [px, py] = iso(x, y, z);
    return `${px.toFixed(1)},${py.toFixed(1)}`;
}

function face(points: [number, number, number][], fill: string, stroke: string, sw = 1, dash?: string): string {
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${pt(p[0], p[1], p[2])}`).join(" ") + " Z";
    return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ""} />`;
}

export function Isometric3DElbow({
    innerWidth,
    innerHeight,
    armA,
    armB,
    thickness,
}: Isometric3DElbowProps) {
    if (!innerWidth || !innerHeight || !armA || !armB || !thickness) return null;

    const W = innerWidth + 2 * thickness;
    const H = innerHeight + 2 * thickness;

    // Scala per adattarsi
    const maxDim = Math.max(W + armB, armA + W, H);
    const s = maxDim > 0 ? 90 / maxDim : 1;

    const w = W * s;
    const h = H * s;
    const a = armA * s;
    const b = armB * s;
    const t = thickness * s;

    // L'L-shape visto dall'alto:
    // Braccio A va in direzione Y (profondità): da y=0 a y=a
    // Zona angolo: da y=a a y=a+w (quadrato w×w)
    // Braccio B va in direzione X (destra): da x=w a x=w+b

    // Bounding box
    const allPts: [number, number][] = [
        iso(0, 0, 0), iso(w, 0, 0), iso(0, a + w, 0), iso(w + b, a, 0),
        iso(w + b, a + w, 0), iso(0, 0, h), iso(w, 0, h), iso(0, a + w, h),
        iso(w + b, a, h), iso(w + b, a + w, h),
    ];
    const minPx = Math.min(...allPts.map(p => p[0]));
    const maxPx = Math.max(...allPts.map(p => p[0]));
    const minPy = Math.min(...allPts.map(p => p[1]));
    const maxPy = Math.max(...allPts.map(p => p[1]));

    const pad = 20;
    const vw = maxPx - minPx + pad * 2;
    const vh = maxPy - minPy + pad * 2;
    const ox = -minPx + pad;
    const oy = -minPy + pad;

    const blue = "#3b82f6";
    const green = "#22c55e";
    const amber = "#f59e0b";

    // Genero le facce dell'L-shape come un unico solido
    const faces: string[] = [];

    // === FACCE POSTERIORI (disegnate prima) ===

    // Lato sinistro di arm A + angolo (x=0, da y=0 a y=a+w)
    faces.push(face(
        [[0, 0, 0], [0, 0, h], [0, a + w, h], [0, a + w, 0]],
        blue + "18", blue, 1
    ));

    // Lato fondo (y=a+w, da x=0 a x=w+b) — parete esterna braccio B
    faces.push(face(
        [[0, a + w, 0], [0, a + w, h], [w + b, a + w, h], [w + b, a + w, 0]],
        green + "18", green, 1
    ));

    // === FACCE LATERALI ===

    // Faccia frontale arm A (y=0, da x=0 a x=w) — apertura arm A
    faces.push(face(
        [[0, 0, 0], [w, 0, 0], [w, 0, h], [0, 0, h]],
        blue + "30", blue, 1.2
    ));

    // Faccia destra arm B (x=w+b, da y=a a y=a+w) — apertura arm B
    faces.push(face(
        [[w + b, a, 0], [w + b, a + w, 0], [w + b, a + w, h], [w + b, a, h]],
        green + "30", green, 1.2
    ));

    // Faccia "interna" arm A destra (x=w, da y=0 a y=a) — parete interna dello spigolo
    faces.push(face(
        [[w, 0, 0], [w, a, 0], [w, a, h], [w, 0, h]],
        "hsl(var(--foreground) / 0.05)", "hsl(var(--foreground) / 0.2)", 0.8, "4,3"
    ));

    // Faccia "interna" arm B top (y=a, da x=w a x=w+b)
    faces.push(face(
        [[w, a, 0], [w + b, a, 0], [w + b, a, h], [w, a, h]],
        "hsl(var(--foreground) / 0.05)", "hsl(var(--foreground) / 0.2)", 0.8, "4,3"
    ));

    // === FACCE SUPERIORI (disegnate per ultime) ===

    // Coperchio arm A (z=h, da y=0 a y=a, x=0 a x=w)
    faces.push(face(
        [[0, 0, h], [w, 0, h], [w, a, h], [0, a, h]],
        blue + "40", blue, 1.3
    ));

    // Coperchio zona angolo (z=h)
    faces.push(face(
        [[0, a, h], [w, a, h], [w, a + w, h], [0, a + w, h]],
        amber + "40", amber, 1.5, "5,3"
    ));

    // Coperchio arm B (z=h, da x=w a x=w+b, y=a a y=a+w)
    faces.push(face(
        [[w, a, h], [w + b, a, h], [w + b, a + w, h], [w, a + w, h]],
        green + "40", green, 1.3
    ));

    // Label 45° sulla zona angolo
    const [cx, cy] = iso(w / 2, a + w / 2, h + 6);

    // Labels bracci
    const [ax, ay] = iso(w / 2, a / 2, h + 10);
    const [bx, by] = iso(w + b / 2, a + w / 2, h + 10);

    return (
        <svg
            viewBox={`0 0 ${vw.toFixed(0)} ${vh.toFixed(0)}`}
            className="w-full max-w-[320px] mx-auto"
            style={{ height: Math.min(vh, 220) }}
        >
            <g
                transform={`translate(${ox.toFixed(1)}, ${oy.toFixed(1)})`}
                dangerouslySetInnerHTML={{ __html: faces.join("\n") }}
            />
            <g transform={`translate(${ox.toFixed(1)}, ${oy.toFixed(1)})`}>
                <text x={cx} y={cy} textAnchor="middle"
                    className="fill-amber-400 text-[8px] font-bold">90°</text>
                <text x={ax} y={ay} textAnchor="middle"
                    className="fill-blue-400 text-[9px] font-mono font-bold">A</text>
                <text x={bx} y={by} textAnchor="middle"
                    className="fill-green-400 text-[9px] font-mono font-bold">B</text>
            </g>
        </svg>
    );
}
