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
    /** Direzione del segmento nel mondo */
    direction: Direction3D;
    /** Dimensioni esterne del canale in quel punto */
    outerW: number;
    outerH: number;
}

/** Nodo 2D proiettato per il rendering nel canvas */
export interface SegmentNode2D {
    segment: Segment;
    index: number;
    /** Rettangolo in coordinate canvas (mm) */
    x: number;
    y: number;
    width: number;
    height: number;
    /** Label da mostrare */
    label: string;
    /** Colore */
    color: string;
}

// ==================== COLORI SEGMENTI ====================

const SEGMENT_COLORS = {
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
            // L'angolo occupa uno spazio cubico outerW × outerW
            // (armA nella direzione corrente, armB nella nuova direzione)
            const v = dirVec(dir);
            const armLen = seg.armA + outerW; // lunghezza totale del braccio A
            const end: Vec3 = {
                x: pos.x + v.x * armLen,
                y: pos.y + v.y * armLen,
                z: pos.z + v.z * armLen,
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

            // Aggiorna posizione e direzione dopo la curva
            pos = end;
            dir = turnDirection(dir, seg.direction);
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
        let x1: number, y1: number, x2: number, y2: number;
        let crossW: number; // larghezza perpendicolare al segmento

        switch (view) {
            case 'top': // Piano XY — vista dall'alto
                x1 = node.start.x; y1 = node.start.y;
                x2 = node.end.x; y2 = node.end.y;
                crossW = node.outerW;
                break;
            case 'front': // Piano XZ — vista frontale
                x1 = node.start.x; y1 = -node.start.z;
                x2 = node.end.x; y2 = -node.end.z;
                crossW = node.outerH;
                break;
            case 'right': // Piano YZ — vista laterale
                x1 = node.start.y; y1 = -node.start.z;
                x2 = node.end.y; y2 = -node.end.z;
                crossW = node.outerW;
                break;
        }

        // Calcola il rettangolo orientato
        const dx = x2 - x1;
        const dy = y2 - y1;
        const segLen = Math.sqrt(dx * dx + dy * dy);

        // Per segmenti con lunghezza 0 (degeneri), usa un quadrato minimo
        const rectW = Math.max(segLen, crossW);
        const rectH = crossW;

        // Posizione: top-left del bounding box centrato sulla linea
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);

        // Offset perpendicolare per centrare la larghezza
        const isHorizontal = Math.abs(dx) >= Math.abs(dy);
        const rx = isHorizontal ? minX : minX - crossW / 2;
        const ry = isHorizontal ? minY - crossW / 2 : minY;
        const rw = isHorizontal ? rectW : crossW;
        const rh = isHorizontal ? rectH : rectW > crossW ? rectW : crossW;

        const seg = node.segment;
        const label = seg.label || (seg.type === 'straight'
            ? `${seg.length} mm`
            : `↱ ${seg.direction}`);

        return {
            segment: node.segment,
            index: node.index,
            x: rx,
            y: ry,
            width: rw,
            height: rh,
            label,
            color: SEGMENT_COLORS[seg.type],
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
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x + n.width > maxX) maxX = n.x + n.width;
        if (n.y + n.height > maxY) maxY = n.y + n.height;
    }
    return { minX, minY, maxX, maxY };
}
