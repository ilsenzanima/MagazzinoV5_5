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

export interface StraightSegment extends BaseSegment {
    type: 'straight';
    length: number;
    obstacles?: ContextualElementSegment[];
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

export interface PendinoSegment extends BaseSegment {
    type: 'pendino';
    /** Posizione lungo il tratto (mm dalla partenza del segmento precedente) */
    position?: number;
    /** Nota testuale opzionale */
    note?: string;
}

export type Segment = StraightSegment | Elbow90Segment | TrackSeparatorSegment | ContextualElementSegment | PendinoSegment;

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

// ==================== PROGETTO ====================

export interface DuctProject {
    id: string;
    name: string;
    section: SectionProfile;
    segments: Segment[];
    /** Se true, le lunghezze dei tratti dritti sono considerate "fuori tutto" (ingombri) e vengono accorciate dalle curve adiacenti */
    globalMeasurements: boolean;
    /** Direzione 3D di partenza per il primo segmento (es: +x dest, -y fronte) */
    initialDirection?: '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
    /** Annotazioni testuali sul disegno (fase B) */
    annotations?: Annotation[];
    /** Elementi contestuali: pareti, solai, varchi (fase D) */
    contextElements?: ContextElement[];
    /** Abilita il calcolo delle fasce giunti tra i tratti */
    jointBands?: boolean;
    /** Larghezza della fascia giunto in mm (default 100-150) */
    jointBandWidth?: number;
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

export function createPendinoSegment(): PendinoSegment {
    return {
        id: `pen-${++_segCounter}-${Date.now()}`,
        type: 'pendino',
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
    };
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

export interface RilievoOstacolo {
    id: string;
    type: 'wall' | 'floor';
    thickness: number; // Ingombro lungo la canala (mm)
    distanceFromStart: number; // Misura parziale dove inserire visivamente l'ostacolo 
}

export interface RilievoSottomisura {
    id: string;
    length: number; // Pezzo dritto aggiunto al totale
    description?: string;
}

export interface CardDritto {
    id: string;
    type: 'dritto';
    /** 
     * Il valore "manuale" principale inserito nell'input.
     * La somma totale dell'asse dritto sarà questo valore + la somma di subMisure e ostacoli.
     */
    baseLength: number;
    subMisure: RilievoSottomisura[];
    ostacoli: RilievoOstacolo[];
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
        baseLength: 1000,
        subMisure: [],
        ostacoli: []
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
            // Calcola la somma
            let totalLen = card.baseLength;
            card.subMisure.forEach(sm => totalLen += sm.length);

            // Crea un segmento Dritto (base 3d)
            const straight = createStraightSegment(totalLen);
            straight.label = `Tratto ${index + 1}`;

            // Crea gli ostacoli collegandoli al segmento
            if (card.ostacoli.length > 0) {
                straight.obstacles = card.ostacoli.map(o => {
                    const obs = createObstacleSegment(o.type, 200, 200, o.distanceFromStart);
                    obs.thickness = o.thickness;
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
