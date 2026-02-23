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

export interface SectionProfile {
    innerWidth: number;
    innerHeight: number;
    thickness: number;
    sides: DuctSides;
    extraMargin: number;
}

export type SegmentDirection = 'left' | 'right' | 'up' | 'down';
export type SegmentOrientation = 'horizontal' | 'vertical';

export interface StraightSegment {
    type: 'straight';
    id: string;
    length: number;
    orientation: SegmentOrientation;
    label?: string;
}

export interface Elbow90Segment {
    type: 'elbow90';
    id: string;
    direction: SegmentDirection;
    armA: number;
    armB: number;
    baseMode: 'split' | 'single';
    label?: string;
}

export type Segment = StraightSegment | Elbow90Segment;

export interface DuctProject {
    id: string;
    name: string;
    section: SectionProfile;
    segments: Segment[];
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

export function defaultSection(): SectionProfile {
    return {
        innerWidth: 200,
        innerHeight: 200,
        thickness: 50,
        sides: { top: true, bottom: true, left: true, right: true },
        extraMargin: 0,
    };
}

export function defaultProject(): DuctProject {
    return {
        id: `proj-${Date.now()}`,
        name: 'Nuovo Progetto',
        section: defaultSection(),
        segments: [createStraightSegment(2000)],
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
