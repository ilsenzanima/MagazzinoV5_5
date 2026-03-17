/**
 * Motore di layout per l'Editor 2D Multi-Vista.
 * Converte una sequenza di segmenti (DuctProject) in posizioni 3D,
 * poi proietta su viste ortogonali (Alto, Fronte, Lato).
 */

import type { DuctProject, Segment, StraightSegment, RenderPendinoSegment, ContextualElementSegment, PendinoOverlay } from './project-model';

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
    /** (Solo per obstacle) Offset dal centro per rispettare le quote */
    obstacleOffset?: Vec3;
    /** (Solo per obstacle) Dimensioni del canale interno al muro */
    ductW?: number;
    ductH?: number;
    /** (Nuovo) ID del TrackSeparator di appartenenza per Drag&Drop */
    trackId?: string;
    /** (Solo per pendino) Orientamento della staffa */
    pendinoOrientation?: 'top' | 'bottom' | 'left' | 'right';
}

/** Rettangolo base per SVG */
export interface Rect2D {
    x: number;
    y: number;
    width: number;
    height: number;
    rx?: number;
    color?: string;
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
    pendino: '#94a3b8',    // slate-400 (acciaio)
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
        // Orizzontali (piano XY) - Sistema Coordinate Destrorso
        '+x_right': '-y',
        '+x_left': '+y',
        '-x_right': '+y',
        '-x_left': '-y',
        '+y_right': '+x',
        '+y_left': '-x',
        '-y_right': '-x',
        '-y_left': '+x',
        // Verticali (su/giù)
        '+x_up': '+z',
        '+x_down': '-z',
        '-x_up': '+z',
        '-x_down': '-z',
        '+y_up': '+z',
        '+y_down': '-z',
        '-y_up': '+z',
        '-y_down': '-z',
        '+z_right': '+x', // Da rivedere se la logica Z richiede Y o X
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
    let currentRunStartPos: Vec3 = { ...pos };

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

        if (i > 0) {
            const prev = segments[i - 1];
            if (prev.type !== 'straight' && prev.type !== 'obstacle') {
                currentRunStartPos = { ...pos };
            }
        }

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
                trackId: currentTrackId,
            });

            // Layout inline obstacles nested nello straight
            if (seg.obstacles && seg.obstacles.length > 0) {
                // Per ogni ostacolo all'interno, pushamo un nodo per la sua visualizzazione (overlay)
                for (let oIdx = 0; oIdx < seg.obstacles.length; oIdx++) {
                    const obs = seg.obstacles[oIdx];
                    const dist = obs.distanceFromStart ?? 0;

                    const obsStart: Vec3 = {
                        x: pos.x + v.x * dist,
                        y: pos.y + v.y * dist,
                        z: pos.z + v.z * dist,
                    };
                    const obsEnd: Vec3 = {
                        x: obsStart.x + v.x * obs.thickness,
                        y: obsStart.y + v.y * obs.thickness,
                        z: obsStart.z + v.z * obs.thickness,
                    };

                    let dx = 0, dy = 0, dz = 0;
                    if (obs.quotaTop !== undefined) {
                        dz = (outerH / 2) + obs.quotaTop - (obs.height / 2);
                    } else if (obs.quotaBottom !== undefined) {
                        dz = -((outerH / 2) + obs.quotaBottom - (obs.height / 2));
                    }

                    // Se solaio è posizionato top/bottom se la canala corre lungo x o y
                    if (dir === '+x' || dir === '-x' || dir === '+y' || dir === '-y') {
                        if (obs.obstacleType === 'floor' && obs.quotaTop === undefined && obs.quotaBottom === undefined) {
                            dz = (outerH / 2) + (obs.height / 2); // default incastro a filo superiore
                        }
                    }

                    let leftDir: Vec3;
                    if (dir === '+x') leftDir = { x: 0, y: -1, z: 0 };
                    else if (dir === '-x') leftDir = { x: 0, y: 1, z: 0 };
                    else if (dir === '+y') leftDir = { x: 1, y: 0, z: 0 };
                    else if (dir === '-y') leftDir = { x: -1, y: 0, z: 0 };
                    else leftDir = { x: 1, y: 0, z: 0 };

                    if (obs.quotaLeft !== undefined) {
                        const d_lat = (outerW / 2) + obs.quotaLeft - (obs.width / 2);
                        dx += leftDir.x * d_lat;
                        dy += leftDir.y * d_lat;
                    } else if (obs.quotaRight !== undefined) {
                        const d_lat = (outerW / 2) + obs.quotaRight - (obs.width / 2);
                        dx -= leftDir.x * d_lat;
                        dy -= leftDir.y * d_lat;
                    }

                    nodes.push({
                        segment: obs,
                        index: i + (oIdx + 1) * 0.01, // Pseudo-index per non collidere
                        start: obsStart,
                        end: obsEnd,
                        direction: dir,
                        outerW: obs.width,
                        outerH: obs.height,
                        ductW: outerW,
                        ductH: outerH,
                        obstacleOffset: { x: dx, y: dy, z: dz },
                        trackId: currentTrackId,
                    });
                }
            }

            // (pendini sono iniettati nel post-processing a livello di corsa intera)

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

    // ==================== POST-PROCESSING: Pendini sulle corse dritto ====================
    // I pendini devono essere posizionati a livello di "corsa" (run di segmenti dritti
    // consecutivi tra due curve o separatori), non per singolo spezzone.
    // Vengono escluse le zone coperte da muri (obstacleType === 'wall').
    const pendiniNodesToAdd: SegmentNode3D[] = [];
    let pendinoCounter = 0;

    // Raggruppa i nodi straight per corsa (ogni corsa termina con un elbow90 o separatore)
    // Usiamo i nodi già calcolati che hanno le start/end assolute
    let runStraights: SegmentNode3D[] = [];

    const flushRun = () => {
        if (runStraights.length === 0) return;

        // Raccoglie i pendini globali che appartengono a questo run
        const globalPendini = project.pendini || [];
        const runPendini: Array<{ absPos: Vec3; id: string; dir: Direction3D; trackId: string | undefined; orientation?: 'top' | 'bottom' | 'left' | 'right' }> = [];

        for (const sn of runStraights) {
            const seg = sn.segment as StraightSegment;
            const v = dirVec(sn.direction as Direction3D);

            // Pendini globali (nuovo sistema overlay)
            const segPendini = globalPendini.filter(p => p.runId === seg.id);
            for (const pend of segPendini) {
                const safeDist = Math.max(0, Math.min(pend.distanceFromStart, seg.length));
                const absPos: Vec3 = {
                    x: sn.start.x + v.x * safeDist,
                    y: sn.start.y + v.y * safeDist,
                    z: sn.start.z + v.z * safeDist,
                };
                runPendini.push({ absPos, id: pend.id, dir: sn.direction as Direction3D, trackId: sn.trackId, orientation: pend.orientation });
            }

            // Fallback: pendini inline legacy (retrocompatibilità)
            if (seg.pendini && seg.pendini.length > 0) {
                for (const pend of seg.pendini) {
                    const localDist = pend.fromEnd ? (seg.length - pend.distance) : pend.distance;
                    const safeDist = Math.max(0, Math.min(localDist, seg.length));
                    const absPos: Vec3 = {
                        x: sn.start.x + v.x * safeDist,
                        y: sn.start.y + v.y * safeDist,
                        z: sn.start.z + v.z * safeDist,
                    };
                    runPendini.push({ absPos, id: pend.id, dir: sn.direction as Direction3D, trackId: sn.trackId, orientation: pend.orientation });
                }
            }
        }

        // Costruisci lista di zone "muro" da evitare
        const wallZones: Array<{ start: Vec3; end: Vec3 }> = [];
        for (const sn of runStraights) {
            const seg = sn.segment as StraightSegment;
            if (!seg.obstacles) continue;
            for (const obs of seg.obstacles) {
                if (obs.obstacleType !== 'wall') continue;
                const v = dirVec(sn.direction as Direction3D);
                const dist = obs.distanceFromStart ?? 0;
                const wallStart: Vec3 = {
                    x: sn.start.x + v.x * dist,
                    y: sn.start.y + v.y * dist,
                    z: sn.start.z + v.z * dist,
                };
                const wallEnd: Vec3 = {
                    x: wallStart.x + v.x * obs.thickness,
                    y: wallStart.y + v.y * obs.thickness,
                    z: wallStart.z + v.z * obs.thickness,
                };
                wallZones.push({ start: wallStart, end: wallEnd });
            }
        }

        // Filtra i pendini che cadono dentro zone muro
        for (const rp of runPendini) {
            const { absPos, id, dir, trackId, orientation } = rp;

            let blocked = false;
            for (const wz of wallZones) {
                const wx0 = Math.min(wz.start.x, wz.end.x) - outerW;
                const wx1 = Math.max(wz.start.x, wz.end.x) + outerW;
                const wy0 = Math.min(wz.start.y, wz.end.y) - outerW;
                const wy1 = Math.max(wz.start.y, wz.end.y) + outerW;
                if (absPos.x >= wx0 && absPos.x <= wx1 && absPos.y >= wy0 && absPos.y <= wy1) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) continue;

            pendiniNodesToAdd.push({
                segment: { type: 'pendino', id, label: 'Pendino' } as RenderPendinoSegment,
                index: 1000 + pendinoCounter * 0.001,
                start: absPos,
                end: absPos,
                direction: dir,
                outerW,
                outerH,
                trackId,
                pendinoOrientation: orientation || 'top',
            });
            pendinoCounter++;
        }

        runStraights = [];
    };

    // Scansione dei nodi per estrarre le corse straight
    for (const node of nodes) {
        const type = node.segment.type;
        if (type === 'straight') {
            runStraights.push(node);
        } else if (type === 'elbow90' || type === 'trackSeparator') {
            flushRun();
        }
        // obstacle e pendino già filtrati / ignorati
    }
    flushRun(); // ultima corsa

    return [...nodes, ...pendiniNodesToAdd];
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
            else if (seg.type === 'pendino') labelText = `📌 Pendino`;
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

            const generateBoxPolygons = (p1: Vec3, p2: Vec3, w: number, h: number, customColor = baseColor): (Polygon2D & { depth: number })[] => {
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
                    { indices: [0, 1, 2, 3], fill: `${customColor}10` },
                    { indices: [4, 5, 6, 7], fill: `${customColor}40` },
                    { indices: [0, 1, 5, 4], fill: `${customColor}30` },
                    { indices: [3, 2, 6, 7], fill: `${customColor}05` },
                    { indices: [0, 3, 7, 4], fill: `${customColor}20` },
                    { indices: [1, 2, 6, 5], fill: `${customColor}05` },
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
                        stroke: customColor,
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
            } else if (seg.type === 'obstacle') {
                const off = node.obstacleOffset || { x: 0, y: 0, z: 0 };
                const p1Obs = { x: node.start.x + off.x, y: node.start.y + off.y, z: node.start.z + off.z };
                const p2Obs = { x: node.end.x + off.x, y: node.end.y + off.y, z: node.end.z + off.z };
                const obsPolys = generateBoxPolygons(p1Obs, p2Obs, node.outerW, node.outerH, baseColor);

                // Canna passante
                const ductW = node.ductW || node.outerW;
                const ductH = node.ductH || node.outerH;
                const ductColor = SEGMENT_COLORS['straight'] || '#3b82f6';
                const ductPolys = generateBoxPolygons(node.start, node.end, ductW, ductH, ductColor);

                polygons = [...ductPolys, ...obsPolys];
                polygons.sort((a: any, b: any) => a.depth - b.depth);
                labelPos = iso({
                    x: (node.start.x + node.end.x) / 2 + off.x,
                    y: (node.start.y + node.end.y) / 2 + off.y,
                    z: (node.start.z + node.end.z) / 2 + off.z
                });
            } else if (seg.type === 'pendino') {
                // Pendino: due barre filettate scendono sotto la canala, collegate da una sbarra
                const markerSize = node.outerW / 2 + 10;
                const dropDown = node.outerH / 2 + 30; // 30mm sotto la canala
                const topUp = node.outerH / 2 + 200; // 200mm sopra
                const p = node.start;
                const d = node.direction;

                let left: Vec3, right: Vec3;
                if (d === '+x' || d === '-x') {
                    left = { x: p.x, y: p.y - markerSize, z: p.z };
                    right = { x: p.x, y: p.y + markerSize, z: p.z };
                } else {
                    left = { x: p.x - markerSize, y: p.y, z: p.z };
                    right = { x: p.x + markerSize, y: p.y, z: p.z };
                }

                const leftBottom = { x: left.x, y: left.y, z: left.z - dropDown };
                const rightBottom = { x: right.x, y: right.y, z: right.z - dropDown };

                const leftTop = { x: left.x, y: left.y, z: left.z + topUp };
                const rightTop = { x: right.x, y: right.y, z: right.z + topUp };

                const pendColor = SEGMENT_COLORS['pendino'];

                // Barra orizzontale sotto
                polygons.push({
                    points: [iso(leftBottom), iso(rightBottom)],
                    fill: 'none', stroke: pendColor, strokeWidth: 4, depth: 9999
                } as any);
                // Asta verticale sinistra
                polygons.push({
                    points: [iso(leftBottom), iso(leftTop)],
                    fill: 'none', stroke: pendColor, strokeWidth: 2, depth: 9999
                } as any);
                // Asta verticale destra
                polygons.push({
                    points: [iso(rightBottom), iso(rightTop)],
                    fill: 'none', stroke: pendColor, strokeWidth: 2, depth: 9999
                } as any);

                labelPos = iso({ ...p, z: p.z + topUp });
            } else {
                polygons = generateBoxPolygons(node.start, node.end, node.outerW, node.outerH, baseColor);
                polygons.sort((a: any, b: any) => a.depth - b.depth);

                // Disegna freccia su tratti dritti per indicare direzione
                if (seg.type === 'straight') {
                    const midX = (node.start.x + node.end.x) / 2;
                    const midY = (node.start.y + node.end.y) / 2;
                    const midZ = (node.start.z + node.end.z) / 2;

                    const arrowLen = Math.min(node.outerW / 2, 100);
                    const topZ = midZ + node.outerH / 2 + 2;

                    const arrowCenter = { x: midX, y: midY, z: topZ };
                    const d = node.direction;
                    const w = arrowLen / 1.5;

                    let p1: Vec3 | null = null, p2: Vec3 | null = null, p3: Vec3 | null = null;
                    if (d === '+x') {
                        p1 = { x: arrowCenter.x + arrowLen, y: arrowCenter.y, z: topZ };
                        p2 = { x: arrowCenter.x - arrowLen, y: arrowCenter.y - w, z: topZ };
                        p3 = { x: arrowCenter.x - arrowLen, y: arrowCenter.y + w, z: topZ };
                    } else if (d === '-x') {
                        p1 = { x: arrowCenter.x - arrowLen, y: arrowCenter.y, z: topZ };
                        p2 = { x: arrowCenter.x + arrowLen, y: arrowCenter.y - w, z: topZ };
                        p3 = { x: arrowCenter.x + arrowLen, y: arrowCenter.y + w, z: topZ };
                    } else if (d === '+y') {
                        p1 = { x: arrowCenter.x, y: arrowCenter.y + arrowLen, z: topZ };
                        p2 = { x: arrowCenter.x - w, y: arrowCenter.y - arrowLen, z: topZ };
                        p3 = { x: arrowCenter.x + w, y: arrowCenter.y - arrowLen, z: topZ };
                    } else if (d === '-y') {
                        p1 = { x: arrowCenter.x, y: arrowCenter.y - arrowLen, z: topZ };
                        p2 = { x: arrowCenter.x - w, y: arrowCenter.y + arrowLen, z: topZ };
                        p3 = { x: arrowCenter.x + w, y: arrowCenter.y + arrowLen, z: topZ };
                    }

                    if (p1 && p2 && p3) {
                        polygons.push({
                            points: [iso(p1), iso(p2), iso(p3)],
                            fill: 'rgba(255,255,255,0.8)',
                            stroke: 'rgba(0,0,0,0.5)',
                            strokeWidth: 1,
                            depth: 9999
                        } as any);
                    }
                }

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
        let pW = node.outerW;
        let pH = node.outerH;
        let offU = 0, offV = 0;
        const off = node.obstacleOffset || { x: 0, y: 0, z: 0 };

        switch (view) {
            case 'top':
                u1 = node.start.x; v1 = node.start.y;
                u2 = node.end.x; v2 = node.end.y;
                if (node.corner) { cu = node.corner.x; cv = node.corner.y; }
                crossW = node.outerW;
                pW = node.outerW; // Top view uses Width
                pH = node.outerW;
                offU = off.x; offV = off.y;
                break;
            case 'front': // Fronte = y up (+x, -z)
                u1 = node.start.x; v1 = -node.start.z;
                u2 = node.end.x; v2 = -node.end.z;
                if (node.corner) { cu = node.corner.x; cv = -node.corner.z; }
                crossW = node.outerH;
                pW = node.outerW;
                pH = node.outerH;
                offU = off.x; offV = -off.z;
                break;
            case 'right': // Destra = x up (+y, -z)
                u1 = node.start.y; v1 = -node.start.z;
                u2 = node.end.y; v2 = -node.end.z;
                if (node.corner) { cu = node.corner.y; cv = -node.corner.z; }
                crossW = node.outerW;
                pW = node.outerW;
                pH = node.outerH;
                offU = off.y; offV = -off.z;
                break;
            case 'back': // Retro = vista +y (-x, -z)
                u1 = -node.start.x; v1 = -node.start.z;
                u2 = -node.end.x; v2 = -node.end.z;
                if (node.corner) { cu = -node.corner.x; cv = -node.corner.z; }
                crossW = node.outerH;
                pW = node.outerW;
                pH = node.outerH;
                offU = -off.x; offV = -off.z;
                break;
            case 'left': // Sinistra = vista +x (-y, -z)
                u1 = -node.start.y; v1 = -node.start.z;
                u2 = -node.end.y; v2 = -node.end.z;
                if (node.corner) { cu = -node.corner.y; cv = -node.corner.z; }
                crossW = node.outerW;
                pW = node.outerW;
                pH = node.outerH;
                offU = -off.y; offV = -off.z;
                break;
        }

        const createRect = (startU: number, startV: number, endU: number, endV: number, isDuct = false): Rect2D => {
            const du = endU - startU;
            const dv = endV - startV;
            const len = Math.sqrt(du * du + dv * dv);

            // Determiniamo la larghezza "cross" da usare in questa specifica direzione e vista
            let effectiveCrossW = crossW;
            if (node.segment.type === 'obstacle' && !isDuct) {
                // Per gli ostacoli, la larghezza proiettata dipende se il tratto si sta espandendo su U o V.
                // Se è orizzontale (du != 0 => si sposta lungo U), la grandezza ortogonale su V è dettata dalla vista
                // (es. Top -> larghezza W, Front -> altezza H). Usiamo pW o pH in base al piano.
                const isHorizontalMov = Math.abs(du) >= Math.abs(dv);
                if (view === 'top') {
                    effectiveCrossW = pW;
                } else if (view === 'front' || view === 'back') {
                    effectiveCrossW = isHorizontalMov ? pH : pW;
                } else if (view === 'left' || view === 'right') {
                    effectiveCrossW = isHorizontalMov ? pH : pW;
                }
            }

            if (len < 0.1) {
                return {
                    x: startU - effectiveCrossW / 2,
                    y: startV - effectiveCrossW / 2,
                    width: effectiveCrossW,
                    height: effectiveCrossW,
                    rx: node.segment.type === 'elbow90' ? 8 : 2
                };
            }

            const isHorizontal = Math.abs(du) >= Math.abs(dv);
            const minU = Math.min(startU, endU);
            const minV = Math.min(startV, endV);

            return {
                x: isHorizontal ? minU : minU - effectiveCrossW / 2,
                y: isHorizontal ? minV - effectiveCrossW / 2 : minV,
                width: isHorizontal ? len : effectiveCrossW,
                height: isHorizontal ? effectiveCrossW : len,
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
                x: cu - crossW / 2, // L'angolo usa standard crossW
                y: cv - crossW / 2,
                width: crossW,
                height: crossW,
                rx: 0
            };

            rects.push(r1, centerSq, r2);
            labelX = cu;
            labelY = cv;
        } else if (node.segment.type === 'obstacle') {
            const rObs = createRect(u1 + offU, v1 + offV, u2 + offU, v2 + offV);
            rects.push(rObs);

            // Canna passante
            const rDuct = createRect(u1, v1, u2, v2, true);
            rDuct.color = SEGMENT_COLORS['straight'] || '#3b82f6';
            rects.push(rDuct);

            labelX = ((u1 + u2) / 2) + offU;
            labelY = ((v1 + v2) / 2) + offV;
        } else if (node.segment.type === 'pendino') {
            // Pendino: piccolo cerchio/marker
            const mSize = crossW * 0.35;
            rects.push({
                x: u1 - mSize,
                y: v1 - mSize,
                width: mSize * 2,
                height: mSize * 2,
                rx: mSize, // cerchio
                color: SEGMENT_COLORS['pendino'],
            });
            labelX = u1;
            labelY = v1 - mSize * 2;
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
