/**
 * Motore di layout per l'Editor 2D Multi-Vista.
 * Converte una sequenza di segmenti (DuctProject) in posizioni 3D,
 * poi proietta su viste ortogonali (Alto, Fronte, Lato).
 */

import type { DuctProject, Segment } from './project-model';

// ==================== TIPI ====================

export type ViewType = 'top' | 'front' | 'right';

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
    /** (Solo per elbow90) Direzione in uscita */
    dirOut?: Direction3D;
}

/** Rettangolo base per SVG */
export interface Rect2D {
    x: number;
    y: number;
    width: number;
    height: number;
    rx?: number;
}

/** Nodo 2D proiettato per il rendering nel canvas */
export interface SegmentNode2D {
    segment: Segment;
    index: number;
    /** Sotto-rettangoli per disegnare questo pezzo (1 dritto, 3 angolo) */
    rects: Rect2D[];
    labelX: number;
    labelY: number;
    /** Label da mostrare */
    label: string;
    /** Colore */
    color: string;
}

// ==================== COLORI SEGMENTI ====================

const SEGMENT_COLORS: Record<string, string> = {
    straight: '#3b82f6',   // blue
    elbow90: '#f59e0b',    // amber
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
 * Parte dall'origine (0,0,0) e procede nella direzione +x.
 */
export function computeLayout(project: DuctProject): SegmentNode3D[] {
    const { section, segments } = project;
    const outerW = section.innerWidth + 2 * section.thickness;
    const outerH = section.innerHeight + 2 * section.thickness;

    const nodes: SegmentNode3D[] = [];
    let pos: Vec3 = { x: 0, y: 0, z: 0 };
    let dir: Direction3D = '+x';

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

        if (seg.type === 'straight') {
            const v = dirVec(dir);
            const len = seg.length;
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
                outerW,
                outerH,
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
    view: ViewType
): SegmentNode2D[] {
    return nodes.map(node => {
        let u1: number, v1: number, u2: number, v2: number;
        let cu: number | undefined, cv: number | undefined;
        let crossW = node.outerW;

        switch (view) {
            case 'top': // Piano XY — vista dall'alto
                u1 = node.start.x; v1 = node.start.y;
                u2 = node.end.x; v2 = node.end.y;
                if (node.corner) { cu = node.corner.x; cv = node.corner.y; }
                crossW = node.outerW;
                break;
            case 'front': // Piano XZ — vista frontale
                u1 = node.start.x; v1 = -node.start.z;
                u2 = node.end.x; v2 = -node.end.z;
                if (node.corner) { cu = node.corner.x; cv = -node.corner.z; }
                crossW = node.outerH;
                break;
            case 'right': // Piano YZ — vista laterale
                u1 = node.start.y; v1 = -node.start.z;
                u2 = node.end.y; v2 = -node.end.z;
                if (node.corner) { cu = node.corner.y; cv = -node.corner.z; }
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
            // Cubetto di giunzione per evitare buchi nella 'L'
            const centerSq: Rect2D = {
                x: cu - crossW / 2,
                y: cv - crossW / 2,
                width: crossW,
                height: crossW,
                rx: 0 // Il centro senza bordi arrotondati aiuta la congiunzione
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

        const seg = node.segment;
        const labelText = seg.label || (seg.type === 'straight'
            ? `${seg.length} mm`
            : `↱ ${seg.direction}`);

        return {
            segment: node.segment,
            index: node.index,
            rects,
            labelX,
            labelY,
            label: labelText,
            color: SEGMENT_COLORS[seg.type] || '#3b82f6',
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
        for (const r of n.rects) {
            if (r.x < minX) minX = r.x;
            if (r.y < minY) minY = r.y;
            if (r.x + r.width > maxX) maxX = r.x + r.width;
            if (r.y + r.height > maxY) maxY = r.y + r.height;
        }
    }
    return { minX, minY, maxX, maxY };
}
