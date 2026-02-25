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
export type SegmentOrientation = 'horizontal' | 'vertical';

export type SegmentType = 'straight' | 'elbow90' | 'trackSeparator';

export interface BaseSegment {
    id: string;
    type: SegmentType;
    label?: string; // Etichetta personalizzata
}

export interface StraightSegment extends BaseSegment {
    type: 'straight';
    length: number;
    orientation: SegmentOrientation;
}

export interface Elbow90Segment extends BaseSegment {
    type: 'elbow90';
    direction: SegmentDirection;
    armA: number; // Lunghezza braccio di ingresso
    armB: number; // Lunghezza braccio di uscita
    baseMode: 'split' | 'single';
}

export interface TrackSeparatorSegment extends BaseSegment {
    type: 'trackSeparator';
    expectedLength: number;
    name: string;
}

export type Segment = StraightSegment | Elbow90Segment | TrackSeparatorSegment;

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
    /** Annotazioni testuali sul disegno (fase B) */
    annotations?: Annotation[];
    /** Elementi contestuali: pareti, solai, varchi (fase D) */
    contextElements?: ContextElement[];
}

/** Contatore per ID univoci */
let _segCounter = 0;

export function createStraightSegment(length = 1000): StraightSegment {
    return {
        type: 'straight',
        id: `seg-${++_segCounter}-${Date.now()}`,
        length,
        orientation: 'horizontal',
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
