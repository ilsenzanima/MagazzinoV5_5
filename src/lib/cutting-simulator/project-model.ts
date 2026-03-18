/**
 * Modello dati per la Modalità Progetto Completo.
 * Un progetto rappresenta un'intera canalizzazione composta da segmenti.
 */

export interface DuctSides {
    top: boolean;
    bottom: boolean;
    left: boolean;
    right: boolean;
}

export type CapType = 'none' | 'inner' | 'outer';

export interface SectionProfile {
    innerWidth: number;
    innerHeight: number;
    thickness: number;
    sides: DuctSides;
    extraMargin: number;
    cap: CapType;
}

export type SegmentDirection = 'left' | 'right' | 'up' | 'down';

export type SegmentType = 'straight' | 'elbow90' | 'trackSeparator' | 'obstacle' | 'pendino';
export type ObstacleType = 'wall' | 'floor' | 'column';

export interface BaseSegment {
    id: string;
    type: SegmentType;
    label?: string; // Etichetta personalizzata
}

export interface ContextualElementSegment extends BaseSegment {
    type: 'obstacle';
    obstacleType: ObstacleType;
    thickness: number;   // Lunghezza spesa lungo la canala (es. 300mm)
    width: number;       // Trasversale (se muro, molto largo)
    height: number;      // Verticale
    showQuotas: boolean;
    quotaLeft?: number;
    quotaRight?: number;
    quotaTop?: number;
    quotaBottom?: number;
    /** Distanza dalla partenza del tratto dritto corrente (overlay mode) */
    distanceFromStart?: number;
}

/** Orientamento della staffa pendino: indica da quale faccia della canala parte il fissaggio */
export type PendinoOrientation = 'top' | 'bottom' | 'left' | 'right';

export interface PendinoItem {
    id: string;
    distance: number;
    fromEnd: boolean;
    /** Da quale faccia parte la staffa (default: 'top' = soffitto) */
    orientation?: PendinoOrientation;
}

export interface StraightSegment extends BaseSegment {
    type: 'straight';
    length: number;
    obstacles?: ContextualElementSegment[];
    pendini?: PendinoItem[];
}

export interface Elbow90Segment extends BaseSegment {
    type: 'elbow90';
    direction: SegmentDirection;
    armA: number; // Lunghezza braccio di ingresso
    armB: number; // Lunghezza braccio di uscita
    baseMode: 'split' | 'single';
    /** Lunghezza attesa del sotto-tratto che inizia DOPO questa curva (mm) */
    expectedLengthAfter?: number;
}

export interface TrackSeparatorSegment extends BaseSegment {
    type: 'trackSeparator';
    expectedLength: number;
    name: string;
    /** Spessore lastra override per questa isola (mm). Se non definito, si usa quello globale. */
    thicknessOverride?: number;
    /** Coordinate 3D assolute di partenza per slegare il tratto (Fase C: Drag&Drop) */
    startX?: number;
    startY?: number;
    startZ?: number;
}

export interface RenderPendinoSegment extends BaseSegment {
    type: 'pendino';
}

export type Segment = StraightSegment | Elbow90Segment | TrackSeparatorSegment | ContextualElementSegment | RenderPendinoSegment;

// ==================== ANNOTAZIONI & CONTESTO ====================

export interface Annotation {
    id: string;
    /** Posizione nel canvas world-space (mm) */
    x: number;
    y: number;
    /** Posizione finale per le quote (mm) */
    x2?: number;
    y2?: number;
    text: string;
    type: 'note' | 'dimension';
    /** Vista a cui appartiene l'annotazione (es. 'top', 'front'). Se vuoto, visibile ovunque. */
    viewId?: string;
}

export type ContextElementType = 'wall' | 'floor' | 'opening';

export interface ContextElement {
    id: string;
    type: ContextElementType;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    label?: string;
}

// ==================== OVERLAY: Tagli ====================

/** Punto di taglio posizionato su un tratto dritto (non distruttivo) */
export interface CutMark {
    id: string;
    /** ID del segmento dritto a cui si riferisce */
    runId: string;
    /** Distanza dall'inizio del tratto (mm) */
    distanceFromStart: number;
}

// ==================== OVERLAY: Pendini globali ====================

/** Pendino come overlay globale (non più dentro il segmento) */
export interface PendinoOverlay {
    id: string;
    /** ID del segmento dritto a cui si riferisce */
    runId: string;
    /** Distanza dall'inizio del tratto (mm) */
    distanceFromStart: number;
    /** Da quale faccia parte la staffa */
    orientation: PendinoOrientation;
}

// ==================== OVERLAY: Elementi Cantiere ====================

export type SiteElementType =
    // Reference (solo visualizzazione 3D, non calcolo materiale)
    | 'muratura' | 'colonna_cemento' | 'trave_hea'
    // Operativi (calcolo materiale)
    | 'parete_cartongesso' | 'controparete_cartongesso'
    | 'controsoffitto_cartongesso'
    | 'soffitto_membrana' | 'setto';

export interface SiteElement {
    id: string;
    type: SiteElementType;
    /** ID del segmento a cui è associato (opzionale) */
    runId?: string;
    /** Posizione 3D assoluta */
    position: { x: number; y: number; z: number };
    /** Dimensioni (mm) */
    dimensions: { width: number; height: number; depth: number };
    label: string;
    color?: string;
    notes?: string;
}

// ==================== REGOLE GLOBALI PEZZI ====================

export interface GlobalPieceRules {
    /** Abilita fascia giunto tra i pezzi tagliati */
    fasciaEnabled: boolean;
    /** Larghezza fascia (mm) */
    fasciaWidth: number;
    /** Tipo di cappuccio inizio */
    capStart: CapType;
    /** Tipo di cappuccio fine */
    capEnd: CapType;
}

export function defaultPieceRules(): GlobalPieceRules {
    return {
        fasciaEnabled: false,
        fasciaWidth: 100,
        capStart: 'none',
        capEnd: 'none',
    };
}

// ==================== PEZZO DERIVATO (output di explodeCuts) ====================

/** Pezzo derivato dal taglio: porzione di un tratto dritto tra due cutMarks */
export interface DerivedPiece {
    id: string;
    /** ID del segmento dritto originale */
    runId: string;
    /** Inizio pezzo rispetto al run (mm) */
    startOffset: number;
    /** Fine pezzo rispetto al run (mm) */
    endOffset: number;
    /** Lunghezza derivata (mm) */
    length: number;
    /** Indice nel run (0 = primo pezzo) */
    pieceIndex: number;
    /** Label descrittiva */
    label: string;
}

// ==================== PROGETTO ====================

// ==================== BLUEPRINT (PIANTINA) ====================

export interface BlueprintConfig {
    url: string;
    opacity: number;
    scale: number;        // mm per pixel (rapporto di scala)
    rotation: number;     // gradi (0-360)
    offset: { x: number; y: number }; // spostamento nel piano (mm)
    visible: boolean;
}

export interface DuctProject {
    id: string;
    name: string;
    section: SectionProfile;
    /** Tracciato fisico (Livello 1 — immutabile dopo il rilievo) */
    segments: Segment[];
    /** Se true, le lunghezze dei tratti dritti sono considerate "fuori tutto" (ingombri) e vengono accorciate dalle curve adiacenti */
    globalMeasurements: boolean;
    /** Direzione 3D di partenza per il primo segmento (es: +x dest, -y fronte) */
    initialDirection?: '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
    /** Annotazioni testuali sul disegno (fase B) */
    annotations?: Annotation[];
    /** Elementi contestuali: pareti, solai, varchi (fase D) */
    contextElements?: ContextElement[];
    /** Stato delle card del rilievo per persistere la memoria nel form */
    rilievoCards?: RilievoCard[];

    // ==================== OVERLAY (Livello 2) ====================
    /** Punti di taglio sui tratti dritti */
    cutMarks?: CutMark[];
    /** Pendini posizionati sui tratti */
    pendini?: PendinoOverlay[];
    /** Elementi cantiere (pareti, soffitti, note) */
    siteElements?: SiteElement[];
    /** Regole globali per fasce e cap */
    pieceRules?: GlobalPieceRules;
    /** Ordine personalizzato dei pezzi per il nesting (array di DerivedPiece.id) */
    pieceOrder?: string[];
    /** @deprecated Usa cutMarks + pendini overlay. Mantenuto per retrocompatibilità */
    jointBands?: boolean;
    /** @deprecated */
    jointBandWidth?: number;
    /** Configurazione della piantina di sfondo (Fase C) */
    blueprint?: BlueprintConfig;
}

/** Contatore per ID univoci */
let _segCounter = 0;

export function createStraightSegment(length = 1000): StraightSegment {
    return {
        type: 'straight',
        id: `seg-${++_segCounter}-${Date.now()}`,
        length,
    };
}

export function createElbow90Segment(direction: SegmentDirection = 'right'): Elbow90Segment {
    return {
        type: 'elbow90',
        id: `seg-${++_segCounter}-${Date.now()}`,
        direction,
        armA: 300,
        armB: 300,
        baseMode: 'split',
    };
}

export function createTrackSeparator(expectedLength: number, name: string = 'Tratto'): TrackSeparatorSegment {
    return {
        id: `track-${++_segCounter}-${Date.now()}`,
        type: 'trackSeparator',
        expectedLength,
        name
    };
}

export function createObstacleSegment(obstacleType: ObstacleType = 'wall', innerWidth: number = 200, innerHeight: number = 200, distanceFromStart: number = 0): ContextualElementSegment {
    return {
        id: `obs-${++_segCounter}-${Date.now()}`,
        type: 'obstacle',
        obstacleType,
        thickness: 300,
        width: innerWidth + 500, // Margine default
        height: innerHeight + 500,
        showQuotas: false,
        distanceFromStart
    };
}
export function defaultSection(): SectionProfile {
    return {
        innerWidth: 200,
        innerHeight: 200,
        thickness: 50,
        sides: { top: true, bottom: true, left: true, right: true },
        extraMargin: 0,
        cap: 'none',
    };
}

export function defaultProject(): DuctProject {
    return {
        id: `proj-${Date.now()}`,
        name: 'Nuovo Progetto',
        section: defaultSection(),
        segments: [],
        globalMeasurements: true,
        cutMarks: [],
        pendini: [],
        siteElements: [],
        pieceRules: defaultPieceRules(),
        pieceOrder: [],
        blueprint: {
            url: '',
            opacity: 0.5,
            scale: 1,
            rotation: 0,
            offset: { x: 0, y: 0 },
            visible: false
        }
    };
}

// ==================== MIGRAZIONE & TAGLIO ====================

/**
 * Migra un progetto vecchio (con pendini inline e segmenti splittati)
 * al nuovo formato con overlay.
 * - Unisce i segmenti dritti consecutivi in un unico PhysicalRun
 * - Converte seg.pendini[] → project.pendini[]
 * - Genera cutMarks dai punti di separazione
 */
export function migrateProject(project: DuctProject): DuctProject {
    // Se ha già cutMarks, è già migrato
    if (project.cutMarks && project.cutMarks.length > 0) return project;
    if (project.pendini && project.pendini.length > 0) return project;

    const newSegments: Segment[] = [];
    const newCutMarks: CutMark[] = [];
    const newPendini: PendinoOverlay[] = [];

    let i = 0;
    while (i < project.segments.length) {
        const seg = project.segments[i];

        if (seg.type === 'straight') {
            // Raccogli tutti i dritti consecutivi (erano uno split)
            const run: StraightSegment[] = [];
            while (i < project.segments.length && project.segments[i].type === 'straight') {
                run.push(project.segments[i] as StraightSegment);
                i++;
            }

            if (run.length === 1) {
                // Pezzo singolo: migra solo i pendini inline
                const s = run[0];
                if (s.pendini) {
                    for (const p of s.pendini) {
                        newPendini.push({
                            id: p.id,
                            runId: s.id,
                            distanceFromStart: p.fromEnd ? (s.length - p.distance) : p.distance,
                            orientation: p.orientation || 'top',
                        });
                    }
                }
                // Rimuovi pendini inline
                const clean = { ...s };
                delete clean.pendini;
                newSegments.push(clean);
            } else {
                // Più dritti consecutivi: unifica in un unico run
                let totalLen = 0;
                const allObstacles: ContextualElementSegment[] = [];

                for (const s of run) {
                    // Migra ostacoli con offset corretto
                    if (s.obstacles) {
                        for (const o of s.obstacles) {
                            allObstacles.push({
                                ...o,
                                distanceFromStart: (o.distanceFromStart || 0) + totalLen,
                            });
                        }
                    }
                    // Migra pendini inline
                    if (s.pendini) {
                        for (const p of s.pendini) {
                            const absD = (p.fromEnd ? (s.length - p.distance) : p.distance) + totalLen;
                            newPendini.push({
                                id: p.id,
                                runId: run[0].id, // Tutti puntano al run unificato
                                distanceFromStart: absD,
                                orientation: p.orientation || 'top',
                            });
                        }
                    }
                    totalLen += s.length;
                }

                // Crea il segmento unificato usando il primo ID
                const unified = createStraightSegment(totalLen);
                unified.id = run[0].id; // Mantieni l'ID originale
                unified.label = run[0].label;
                if (allObstacles.length > 0) unified.obstacles = allObstacles;

                // Genera cutMarks dai punti di giunzione
                let offset = 0;
                for (let j = 0; j < run.length - 1; j++) {
                    offset += run[j].length;
                    newCutMarks.push({
                        id: `cut-migr-${Date.now()}-${j}`,
                        runId: unified.id,
                        distanceFromStart: offset,
                    });
                }

                newSegments.push(unified);
            }
        } else {
            newSegments.push(seg);
            i++;
        }
    }

    return {
        ...project,
        segments: newSegments,
        cutMarks: newCutMarks,
        pendini: newPendini,
        siteElements: project.siteElements || [],
        pieceRules: project.pieceRules || defaultPieceRules(),
        pieceOrder: project.pieceOrder || [],
        blueprint: project.blueprint || {
            url: '',
            opacity: 0.5,
            scale: 1,
            rotation: 0,
            offset: { x: 0, y: 0 },
            visible: false
        }
    };
}

/**
 * Genera i pezzi derivati dai tagli.
 * Prende tutti i segmenti dritti e li "esplode" secondo i cutMarks.
 * Se un tratto non ha tagli, il pezzo coincide con il tratto intero.
 */
export function explodeCuts(project: DuctProject): DerivedPiece[] {
    const cuts = project.cutMarks || [];
    const pieces: DerivedPiece[] = [];
    let globalPieceIdx = 0;

    for (const seg of project.segments) {
        if (seg.type !== 'straight') continue;
        const s = seg as StraightSegment;

        // Trova i tagli per questo tratto, ordinati per distanza
        const segCuts = cuts
            .filter(c => c.runId === s.id)
            .map(c => c.distanceFromStart)
            .sort((a, b) => a - b);

        // Aggiungi i bordi (0 e lunghezza totale)
        const boundaries = [0, ...segCuts, s.length];

        for (let i = 0; i < boundaries.length - 1; i++) {
            const start = boundaries[i];
            const end = boundaries[i + 1];
            const len = end - start;
            if (len <= 0) continue;

            pieces.push({
                id: `piece-${s.id}-${i}`,
                runId: s.id,
                startOffset: start,
                endOffset: end,
                length: len,
                pieceIndex: i,
                label: segCuts.length > 0
                    ? `${s.label || 'Tratto'} [${i + 1}/${boundaries.length - 1}]`
                    : s.label || `Tratto ${globalPieceIdx + 1}`,
            });
            globalPieceIdx++;
        }
    }

    // Riordina secondo pieceOrder se presente
    if (project.pieceOrder && project.pieceOrder.length > 0) {
        const order = project.pieceOrder;
        pieces.sort((a, b) => {
            const ia = order.indexOf(a.id);
            const ib = order.indexOf(b.id);
            if (ia === -1 && ib === -1) return 0;
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
        });
    }

    return pieces;
}

/** Numero di lati attivi */
export function activeSidesCount(sides: DuctSides): number {
    return [sides.top, sides.bottom, sides.left, sides.right].filter(Boolean).length;
}

/** Label leggibile per i lati */
export function sidesLabel(sides: DuctSides): string {
    const n = activeSidesCount(sides);
    if (n === 4) return '4 lati';
    const names: string[] = [];
    if (sides.bottom) names.push('Base');
    if (sides.top) names.push('Coperchio');
    if (sides.left) names.push('Sx');
    if (sides.right) names.push('Dx');
    return `${n} lati (${names.join(', ')})`;
}

// ==================== NUOVA GESTIONE A CARD (RILIEVO - WIZARD) ====================
// Questa sezione definisce lo stato per l'inserimento dei dati del Rilievo in cantiere (Opzione B)

export type RilievoCardType = 'dritto' | 'curva';

export interface RilievoMeasureItem {
    id: string;
    type: 'measure';
    length: number;
}

export interface RilievoOstacoloItem {
    id: string;
    type: 'wall' | 'floor';
    thickness: number; // Ingombro lungo la canala (mm)
    width?: number;    // Larghezza totale
    height?: number;   // Altezza totale
    offsetFromLeft?: number;
    offsetFromRight?: number;
    offsetFromTop?: number;
    offsetFromBottom?: number;
}

export type RilievoElement = RilievoMeasureItem | RilievoOstacoloItem;

export interface CardDritto {
    id: string;
    type: 'dritto';
    elements: RilievoElement[];
}

export interface CardCurva {
    id: string;
    type: 'curva';
    direction: SegmentDirection;
}

export type RilievoCard = CardDritto | CardCurva;

// Helper per istanziare le nuove Card
let _cardCounter = 0;

export function createCardDritto(): CardDritto {
    return {
        id: `card-dritto-${++_cardCounter}-${Date.now()}`,
        type: 'dritto',
        elements: [
            { id: `measure-${Date.now()}`, type: 'measure', length: 1000 }
        ]
    };
}

export function createCardCurva(direction: SegmentDirection = 'right'): CardCurva {
    return {
        id: `card-curva-${++_cardCounter}-${Date.now()}`,
        type: 'curva',
        direction
    };
}

/**
 * Traduce una lista di RilievoCards (compilate col dito/tablet) 
 * in una lista di Segments compatibili col motore 3D e col Nesting.
 */
export function translateRilievoToSegments(cards: RilievoCard[]): Segment[] {
    const segments: Segment[] = [];

    cards.forEach((card, index) => {
        if (card.type === 'dritto') {
            let totalLen = 0;
            let currentDist = 0;
            const ostacoliList: (RilievoOstacoloItem & { distanceFromStart: number })[] = [];

            card.elements.forEach(el => {
                if (el.type === 'measure') {
                    totalLen += el.length;
                    currentDist += el.length;
                } else if (el.type === 'wall' || el.type === 'floor') {
                    // L'ostacolo inizia al currentDist, poi se stesso aggiunge spessore
                    ostacoliList.push({ ...el, distanceFromStart: currentDist });
                    totalLen += el.thickness;
                    currentDist += el.thickness;
                }
            });

            let offsetStartDecrease = 0;

            const prevCard = cards[index - 1];
            if (prevCard && prevCard.type === 'curva') {
                totalLen -= 300; // Valore armB uscita curva precedente
                offsetStartDecrease += 300; // Poiché il pezzo dritto 3D nascerà 300mm dopo, scala anche l'immissione
            }

            const nextCard = cards[index + 1];
            if (nextCard && nextCard.type === 'curva') {
                totalLen -= 300; // Valore di default per armA curva seguente
            }

            // Mai lunghezze negative (minimo tecnico 50mm)
            if (totalLen < 50) totalLen = 50;

            // Crea un segmento Dritto (base 3d)
            const straight = createStraightSegment(totalLen);
            straight.label = `Tratto ${index + 1}`;

            // Memorizziamo il decurtamento inzio nel segmento? 
            // Meglio sistemarlo direttamente traslando la quota utente (distanceFromStart) degli ostacoli:
            if (ostacoliList.length > 0) {
                straight.obstacles = ostacoliList.map(o => {
                    // Sottrae lo spostamento fittizio dell'inizio asse generato dalla curva, in modo che 
                    // i 500mm imputati dall'utente equivalgano ancora a 500 dal muro architettonico.
                    const realDist = Math.max(0, o.distanceFromStart - offsetStartDecrease);

                    const obs = createObstacleSegment(o.type, 200, 200, realDist);
                    obs.thickness = o.thickness;
                    if (o.width !== undefined) obs.width = o.width;
                    if (o.height !== undefined) obs.height = o.height;
                    obs.quotaLeft = o.offsetFromLeft;
                    obs.quotaRight = o.offsetFromRight;
                    obs.quotaTop = o.offsetFromTop;
                    obs.quotaBottom = o.offsetFromBottom;
                    return obs;
                });
            }

            segments.push(straight);
        }
        else if (card.type === 'curva') {
            const elbow = createElbow90Segment(card.direction);
            elbow.label = `Curva ${index + 1}`;
            segments.push(elbow);
        }
    });

    return segments;
}
