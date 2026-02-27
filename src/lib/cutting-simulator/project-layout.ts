/**
 * Motore di layout per l'Editor 2D Multi-Vista.
 * Converte una sequenza di segmenti (DuctProject) in posizioni 3D,
 * poi proietta su viste ortogonali (Alto, Fronte, Lato).
 */

import type { DuctProject, Segment } from './project-model';

// ==================== TIPI ====================

export type ViewType = 'top' | 'front' | 'right' | 'back' | 'left' | 'iso';

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

/** Direzione corrente del percorso canalizzazione */
export type Direction3D = '+x' | '-x' | '+y' | '-y' | '+z' | '-z';

/** Nodo 3D di un segmento posizionato nel mondo */
export interface SegmentNode3D {
    segment: Segment;
    index: number;
    /** Posizione iniziale del segmento (mm, world-space) */
    start: Vec3;
    /** Posizione finale del segmento */
    end: Vec3;
    /** Direzione del segmento nel mondo (in entrata) */
    direction: Direction3D;
    /** Dimensioni esterne del canale in quel punto */
    outerW: number;
    outerH: number;
    /** (Solo per elbow90) Punto d'angolo */
    corner?: Vec3;
    /** Direzione in uscita */
    dirOut?: Direction3D;
    /** (Nuovo) ID del TrackSeparator di appartenenza per Drag&Drop */
    trackId?: string;
}

/** Rettangolo base per SVG */
export interface Rect2D {
    x: number;
    y: number;
    width: number;
    height: number;
    rx?: number;
}

/** Poligono per SVG (vista ISO) */
export interface Polygon2D {
    points: { x: number; y: number }[];
    fill: string;
    stroke: string;
    strokeWidth: number;
    strokeDasharray?: string;
}

/** Nodo 2D proiettato per il rendering nel canvas */
export interface SegmentNode2D {
    segment: Segment;
    index: number;
    /** Sotto-rettangoli per disegnare questo pezzo (1 dritto, 3 angolo) */
    rects: Rect2D[];
    polygons?: Polygon2D[];
    labelX: number;
    labelY: number;
    /** Label da mostrare */
    label: string;
    /** Colore */
    color: string;
    /** (Nuovo) ID del TrackSeparator di appartenenza per Drag&Drop */
    trackId?: string;
}

// ==================== COLORI SEGMENTI ====================

const SEGMENT_COLORS: Record<string, string> = {
    straight: '#3b82f6',   // blue
    elbow90: '#f59e0b',    // amber
    obstacle: '#a855f7',   // purple
};

// ==================== LAYOUT ENGINE ====================

/** Vettore unitario per ogni direzione */
function dirVec(dir: Direction3D): Vec3 {
    switch (dir) {
        case '+x': return { x: 1, y: 0, z: 0 };
        case '-x': return { x: -1, y: 0, z: 0 };
        case '+y': return { x: 0, y: 1, z: 0 };
        case '-y': return { x: 0, y: -1, z: 0 };
        case '+z': return { x: 0, y: 0, z: 1 };
        case '-z': return { x: 0, y: 0, z: -1 };
    }
}

/** Ruota la direzione dopo un angolo a 90° */
function turnDirection(current: Direction3D, turn: 'left' | 'right' | 'up' | 'down'): Direction3D {
    // Mappa di rotazione basata sulla vista dall'alto (piano XY)
    const turnMap: Record<string, Direction3D> = {
        // Orizzontali (piano XY)
        '+x_right': '+y',
        '+x_left': '-y',
        '-x_right': '-y',
        '-x_left': '+y',
        '+y_right': '-x',
        '+y_left': '+x',
        '-y_right': '+x',
        '-y_left': '-x',
        // Verticali (su/giù)
        '+x_up': '+z',
        '+x_down': '-z',
        '-x_up': '+z',
        '-x_down': '-z',
        '+y_up': '+z',
        '+y_down': '-z',
        '-y_up': '+z',
        '-y_down': '-z',
        '+z_right': '+x',
        '+z_left': '-x',
        '-z_right': '+x',
        '-z_left': '-x',
    };

    return turnMap[`${current}_${turn}`] || current;
}

/**
 * Calcola il layout 3D di tutti i segmenti del progetto.
 * Parte dall'origine (0,0,0) e procede nella direzione specificata.
 */
export function computeLayout(project: DuctProject): SegmentNode3D[] {
    const { section, segments, initialDirection } = project;
    const outerW = section.innerWidth + 2 * section.thickness;
    const outerH = section.innerHeight + 2 * section.thickness;

    const nodes: SegmentNode3D[] = [];
    let pos: Vec3 = { x: 0, y: 0, z: 0 };
    let dir: Direction3D = initialDirection || '+x';
    let trackIndex = 0;
    let currentTrackId: string | undefined = undefined;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

        if (seg.type === 'trackSeparator') {
            trackIndex++;
            currentTrackId = seg.id;
            if (seg.startX !== undefined && seg.startY !== undefined) {
                pos = { x: seg.startX, y: seg.startY, z: seg.startZ || 0 };
                dir = initialDirection || '+x';
            } else if (trackIndex > 1) {
                // Modello di default per i nuovi tratti non ancora posizionati: li mette sotto di 2000mm
                pos = { x: 0, y: pos.y + 2000, z: 0 };
                dir = initialDirection || '+x';
            }
            continue;
        }

        if (seg.type === 'straight' || seg.type === 'obstacle') {
            const v = dirVec(dir);
            const isObs = seg.type === 'obstacle';
            const len = isObs ? seg.thickness : seg.length;
            const end: Vec3 = {
                x: pos.x + v.x * len,
                y: pos.y + v.y * len,
                z: pos.z + v.z * len,
            };
            nodes.push({
                segment: seg,
                index: i,
                start: { ...pos },
                end,
                direction: dir,
                outerW: isObs ? seg.width : outerW,
                outerH: isObs ? seg.height : outerH,
                trackId: currentTrackId,
            });
            pos = end;
        } else if (seg.type === 'elbow90') {
            const vIn = dirVec(dir);
            const dirOut = turnDirection(dir, seg.direction);
            const vOut = dirVec(dirOut);

            // Consideriamo lo spazio dell'angolo come al centro dell'asse,
            // armA arriva fino al vertice "spigolo", armB riparte
            // Per il modello visivo, corner è il punto di rotazione al centro
            const corner: Vec3 = {
                x: pos.x + vIn.x * (seg.armA),
                y: pos.y + vIn.y * (seg.armA),
                z: pos.z + vIn.z * (seg.armA),
            };
            const end: Vec3 = {
                x: corner.x + vOut.x * (seg.armB),
                y: corner.y + vOut.y * (seg.armB),
                z: corner.z + vOut.z * (seg.armB),
            };

            nodes.push({
                segment: seg,
                index: i,
                start: { ...pos },
                end,
                corner,
                direction: dir,
                dirOut,
                outerW,
                outerH,
                trackId: currentTrackId,
            });

            // Aggiorna posizione e direzione dopo la curva
            pos = end;
            dir = dirOut;
        }
    }

    return nodes;
}

// ==================== PROIEZIONE 2D ====================

/**
 * Proietta i nodi 3D su un piano 2D per il rendering.
 */
export function projectTo2D(
    nodes: SegmentNode3D[],
    view: ViewType,
    isoAngle: number = 0
): SegmentNode2D[] {
    return nodes.map((node) => {
        const seg = node.segment;
        const baseColor = SEGMENT_COLORS[seg.type] || '#3b82f6';
        let labelText = seg.label || '';
        if (!labelText) {
            if (seg.type === 'straight') labelText = `${seg.length} mm`;
            else if (seg.type === 'elbow90') labelText = `↱ ${seg.direction}`;
            else if (seg.type === 'obstacle') labelText = `${seg.obstacleType === 'wall' ? 'Muro' : seg.obstacleType === 'floor' ? 'Solaio' : 'Ost.'} ${seg.thickness}mm`;
        }

        const baseResult = {
            segment: seg,
            index: node.index,
            label: labelText,
            color: baseColor,
            trackId: node.trackId,
        };

        if (view === 'iso') {
            const rad = (isoAngle * Math.PI) / 180;
            const cosA = Math.cos(rad);
            const sinA = Math.sin(rad);

            const rotateZ = (p: Vec3): Vec3 => {
                return {
                    x: p.x * cosA - p.y * sinA,
                    y: p.x * sinA + p.y * cosA,
                    z: p.z
                };
            };

            const iso = (p: Vec3) => {
                const rp = rotateZ(p);
                const cos30 = 0.866;
                const sin30 = 0.5;
                return {
                    x: (rp.x - rp.y) * cos30,
                    y: (rp.x + rp.y) * sin30 - rp.z,
                };
            };

            const generateBoxPolygons = (p1: Vec3, p2: Vec3, w: number, h: number): (Polygon2D & { depth: number })[] => {
                const minX = Math.min(p1.x, p2.x) - (p1.x === p2.x ? w / 2 : 0);
                const maxX = Math.max(p1.x, p2.x) + (p1.x === p2.x ? w / 2 : 0);
                const minY = Math.min(p1.y, p2.y) - (p1.y === p2.y ? w / 2 : 0);
                const maxY = Math.max(p1.y, p2.y) + (p1.y === p2.y ? w / 2 : 0);
                const minZ = Math.min(p1.z, p2.z) - (p1.z === p2.z ? h / 2 : 0);
                const maxZ = Math.max(p1.z, p2.z) + (p1.z === p2.z ? h / 2 : 0);

                const pts = [
                    { x: minX, y: minY, z: minZ },
                    { x: maxX, y: minY, z: minZ },
                    { x: maxX, y: maxY, z: minZ },
                    { x: minX, y: maxY, z: minZ },
                    { x: minX, y: minY, z: maxZ },
                    { x: maxX, y: minY, z: maxZ },
                    { x: maxX, y: maxY, z: maxZ },
                    { x: minX, y: maxY, z: maxZ }
                ];

                const ptsIso = pts.map(iso);

                const faces = [
                    { indices: [0, 1, 2, 3], fill: `${baseColor}10` },
                    { indices: [4, 5, 6, 7], fill: `${baseColor}40` },
                    { indices: [0, 1, 5, 4], fill: `${baseColor}30` },
                    { indices: [3, 2, 6, 7], fill: `${baseColor}05` },
                    { indices: [0, 3, 7, 4], fill: `${baseColor}20` },
                    { indices: [1, 2, 6, 5], fill: `${baseColor}05` },
                ];

                return faces.map(f => {
                    let sum = 0;
                    f.indices.forEach(idx => {
                        const rp = rotateZ(pts[idx]);
                        sum += rp.x + rp.y + rp.z;
                    });
                    return {
                        points: f.indices.map(idx => ptsIso[idx]),
                        fill: f.fill,
                        stroke: baseColor,
                        strokeWidth: 1,
                        depth: sum
                    };
                });
            };

            let polygons: Polygon2D[] = [];
            let labelPos = { x: 0, y: 0 };

            if (seg.type === 'elbow90' && node.corner && node.dirOut) {
                const w = node.outerW;
                const h = node.outerH;
                const dirIn = node.direction;
                const dirOut = node.dirOut;

                const sx = node.start.x, sy = node.start.y;
                const cx = node.corner.x, cy = node.corner.y;
                const ex = node.end.x, ey = node.end.y;
                let basePts: { x: number, y: number }[] = [];

                if (dirIn === '+x' && dirOut === '+y') {
                    basePts = [{ x: sx, y: sy - w / 2 }, { x: cx + w / 2, y: cy - w / 2 }, { x: cx + w / 2, y: ey }, { x: cx - w / 2, y: ey }, { x: cx - w / 2, y: cy + w / 2 }, { x: sx, y: sy + w / 2 }];
                } else if (dirIn === '+x' && dirOut === '-y') {
                    basePts = [{ x: sx, y: sy + w / 2 }, { x: cx + w / 2, y: cy + w / 2 }, { x: cx + w / 2, y: ey }, { x: cx - w / 2, y: ey }, { x: cx - w / 2, y: cy - w / 2 }, { x: sx, y: sy - w / 2 }];
                } else if (dirIn === '-x' && dirOut === '+y') {
                    basePts = [{ x: sx, y: sy - w / 2 }, { x: cx - w / 2, y: cy - w / 2 }, { x: cx - w / 2, y: ey }, { x: cx + w / 2, y: ey }, { x: cx + w / 2, y: cy + w / 2 }, { x: sx, y: sy + w / 2 }];
                } else if (dirIn === '-x' && dirOut === '-y') {
                    basePts = [{ x: sx, y: sy + w / 2 }, { x: cx - w / 2, y: cy + w / 2 }, { x: cx - w / 2, y: ey }, { x: cx + w / 2, y: ey }, { x: cx + w / 2, y: cy - w / 2 }, { x: sx, y: sy - w / 2 }];
                } else if (dirIn === '+y' && dirOut === '+x') {
                    basePts = [{ x: sx - w / 2, y: sy }, { x: cx - w / 2, y: cy + w / 2 }, { x: ex, y: cy + w / 2 }, { x: ex, y: cy - w / 2 }, { x: cx + w / 2, y: cy - w / 2 }, { x: sx + w / 2, y: sy }];
                } else if (dirIn === '+y' && dirOut === '-x') {
                    basePts = [{ x: sx + w / 2, y: sy }, { x: cx + w / 2, y: cy + w / 2 }, { x: ex, y: cy + w / 2 }, { x: ex, y: cy - w / 2 }, { x: cx - w / 2, y: cy - w / 2 }, { x: sx - w / 2, y: sy }];
                } else if (dirIn === '-y' && dirOut === '+x') {
                    basePts = [{ x: sx - w / 2, y: sy }, { x: cx - w / 2, y: cy - w / 2 }, { x: ex, y: cy - w / 2 }, { x: ex, y: cy + w / 2 }, { x: cx + w / 2, y: cy + w / 2 }, { x: sx + w / 2, y: sy }];
                } else if (dirIn === '-y' && dirOut === '-x') {
                    basePts = [{ x: sx + w / 2, y: sy }, { x: cx + w / 2, y: cy - w / 2 }, { x: ex, y: cy - w / 2 }, { x: ex, y: cy + w / 2 }, { x: cx - w / 2, y: cy + w / 2 }, { x: sx - w / 2, y: sy }];
                } else {
                    const minX = Math.min(node.start.x, node.end.x, node.corner.x) - w / 2;
                    const maxX = Math.max(node.start.x, node.end.x, node.corner.x) + w / 2;
                    const minY = Math.min(node.start.y, node.end.y, node.corner.y) - w / 2;
                    const maxY = Math.max(node.start.y, node.end.y, node.corner.y) + w / 2;
                    basePts = [
                        { x: minX, y: minY }, { x: maxX, y: minY },
                        { x: maxX, y: maxY }, { x: minX, y: maxY }
                    ];
                }

                const minZ = Math.min(node.start.z, node.end.z, node.corner.z) - h / 2;
                const maxZ = Math.max(node.start.z, node.end.z, node.corner.z) + h / 2;

                const topPts = basePts.map(p => ({ x: p.x, y: p.y, z: maxZ }));
                const botPts = basePts.map(p => ({ x: p.x, y: p.y, z: minZ }));

                const sideFaces: any[] = [];
                for (let i = 0; i < basePts.length; i++) {
                    const next = (i + 1) % basePts.length;
                    sideFaces.push({
                        indices: [i, next, next + basePts.length, i + basePts.length],
                        fill: `${baseColor}20`
                    });
                }

                const ptsList = [...botPts, ...topPts];
                const ptsIso = ptsList.map(iso);

                const faces = [
                    { indices: basePts.map((_, i) => i), fill: `${baseColor}10` },
                    { indices: basePts.map((_, i) => i + basePts.length), fill: `${baseColor}40` },
                    ...sideFaces
                ];

                polygons = faces.map(f => {
                    let sum = 0;
                    f.indices.forEach((idx: number) => {
                        const rp = rotateZ(ptsList[idx]);
                        sum += rp.x + rp.y + rp.z;
                    });
                    return {
                        points: f.indices.map((idx: number) => ptsIso[idx]),
                        fill: f.fill,
                        stroke: baseColor,
                        strokeWidth: 1,
                        depth: sum
                    };
                });
                polygons.sort((a: any, b: any) => a.depth - b.depth);
                labelPos = iso(node.corner);
            } else {
                polygons = generateBoxPolygons(node.start, node.end, node.outerW, node.outerH);
                polygons.sort((a: any, b: any) => a.depth - b.depth);
                labelPos = iso({
                    x: (node.start.x + node.end.x) / 2,
                    y: (node.start.y + node.end.y) / 2,
                    z: (node.start.z + node.end.z) / 2
                });
            }

            return {
                segment: node.segment,
                index: node.index,
                rects: [],
                polygons,
                labelX: labelPos.x,
                labelY: labelPos.y,
                label: labelText,
                color: baseColor,
                trackId: node.trackId,
            };
        }

        let u1 = 0, v1 = 0, u2 = 0, v2 = 0;
        let cu: number | undefined, cv: number | undefined;
        let crossW = node.outerW;

        switch (view) {
            case 'top':
                u1 = node.start.x; v1 = node.start.y;
                u2 = node.end.x; v2 = node.end.y;
                if (node.corner) { cu = node.corner.x; cv = node.corner.y; }
                crossW = node.outerW;
                break;
            case 'front': // Fronte = y up (+x, -z)
                u1 = node.start.x; v1 = -node.start.z;
                u2 = node.end.x; v2 = -node.end.z;
                if (node.corner) { cu = node.corner.x; cv = -node.corner.z; }
                crossW = node.outerH;
                break;
            case 'right': // Destra = x up (+y, -z)
                u1 = node.start.y; v1 = -node.start.z;
                u2 = node.end.y; v2 = -node.end.z;
                if (node.corner) { cu = node.corner.y; cv = -node.corner.z; }
                crossW = node.outerW;
                break;
            case 'back': // Retro = vista +y (-x, -z)
                u1 = -node.start.x; v1 = -node.start.z;
                u2 = -node.end.x; v2 = -node.end.z;
                if (node.corner) { cu = -node.corner.x; cv = -node.corner.z; }
                crossW = node.outerH;
                break;
            case 'left': // Sinistra = vista +x (-y, -z)
                u1 = -node.start.y; v1 = -node.start.z;
                u2 = -node.end.y; v2 = -node.end.z;
                if (node.corner) { cu = -node.corner.y; cv = -node.corner.z; }
                crossW = node.outerW;
                break;
        }

        const createRect = (startU: number, startV: number, endU: number, endV: number): Rect2D => {
            const du = endU - startU;
            const dv = endV - startV;
            const len = Math.sqrt(du * du + dv * dv);

            if (len < 0.1) {
                return {
                    x: startU - crossW / 2,
                    y: startV - crossW / 2,
                    width: crossW,
                    height: crossW,
                    rx: node.segment.type === 'elbow90' ? 8 : 2
                };
            }

            const isHorizontal = Math.abs(du) >= Math.abs(dv);
            const minU = Math.min(startU, endU);
            const minV = Math.min(startV, endV);

            return {
                x: isHorizontal ? minU : minU - crossW / 2,
                y: isHorizontal ? minV - crossW / 2 : minV,
                width: isHorizontal ? len : crossW,
                height: isHorizontal ? crossW : len,
                rx: node.segment.type === 'elbow90' ? 8 : 2
            };
        };

        const rects: Rect2D[] = [];
        let labelX = 0;
        let labelY = 0;

        if (node.segment.type === 'elbow90' && cu !== undefined && cv !== undefined) {
            const r1 = createRect(u1, v1, cu, cv);
            const r2 = createRect(cu, cv, u2, v2);
            const centerSq: Rect2D = {
                x: cu - crossW / 2,
                y: cv - crossW / 2,
                width: crossW,
                height: crossW,
                rx: 0
            };

            rects.push(r1, centerSq, r2);
            labelX = cu;
            labelY = cv;
        } else {
            const r = createRect(u1, v1, u2, v2);
            rects.push(r);
            labelX = (u1 + u2) / 2;
            labelY = (v1 + v2) / 2;
        }

        return {
            segment: node.segment,
            index: node.index,
            rects,
            labelX,
            labelY,
            label: labelText,
            color: baseColor,
            trackId: node.trackId,
        };
    });
}

// ==================== BOUNDING BOX ====================

export interface BBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export function computeBBox(nodes: SegmentNode2D[]): BBox {
    if (nodes.length === 0) {
        return { minX: 0, minY: 0, maxX: 1000, maxY: 500 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
        if (n.polygons && n.polygons.length > 0) {
            for (const poly of n.polygons) {
                for (const pt of poly.points) {
                    if (pt.x < minX) minX = pt.x;
                    if (pt.y < minY) minY = pt.y;
                    if (pt.x > maxX) maxX = pt.x;
                    if (pt.y > maxY) maxY = pt.y;
                }
            }
        } else {
            for (const r of n.rects) {
                if (r.x < minX) minX = r.x;
                if (r.y < minY) minY = r.y;
                if (r.x + r.width > maxX) maxX = r.x + r.width;
                if (r.y + r.height > maxY) maxY = r.y + r.height;
            }
        }
    }
    return { minX, minY, maxX, maxY };
}
