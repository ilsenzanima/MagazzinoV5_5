/**
 * Motore di calcolo per il Simulatore di Taglio.
 * Calcola i pezzi necessari dato un canale rettangolare e lo spessore del materiale.
 *
 * LOGICA PER CASSONETTI / CANALIZZAZIONI:
 * I pannelli orizzontali (base + coperchio) "avvolgono" quelli verticali (fianchi).
 * Questo significa che lo spessore del materiale è già il sormonto strutturale.
 *
 * Esempio con sezione interna 200×200 mm e spessore 50 mm:
 *   - Base/Coperchio: 200 + 2×50 = 300 mm (coprono i fianchi)
 *   - Fianchi: 200 mm (si inseriscono tra base e coperchio)
 *   - Dimensioni esterne risultanti: 300×300 mm ✓
 */

export interface DuctInput {
    /** Larghezza interna del canale in mm */
    innerWidth: number;
    /** Altezza interna del canale in mm */
    innerHeight: number;
    /** Lunghezza del tratto in mm */
    length: number;
    /** Spessore del materiale in mm */
    thickness: number;
    /**
     * Margine extra in mm da aggiungere ad ogni pezzo.
     * Per cassonetti standard = 0 (il sormonto è già lo spessore).
     * Utile solo se servono lembi aggiuntivi per sigillature o fissaggi speciali.
     */
    extraMargin: number;
}

export interface CutPiece {
    /** Identificativo univoco del pezzo */
    id: string;
    /** Etichetta leggibile */
    label: string;
    /** Larghezza del pezzo in mm */
    width: number;
    /** Altezza del pezzo in mm */
    height: number;
    /** Quantità necessaria */
    quantity: number;
    /** Colore per la visualizzazione */
    color: string;
    /** Descrizione del calcolo per trasparenza */
    formula: string;
}

export interface CalculationResult {
    pieces: CutPiece[];
    /** Superficie totale dei pezzi in mm² */
    totalArea: number;
    /** Riepilogo testuale */
    summary: string;
    /** Dimensioni esterne del cassonetto */
    outerWidth: number;
    outerHeight: number;
}

const PIECE_COLORS = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#22c55e', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
];

/**
 * Calcola i pezzi necessari per un canale rettangolare dritto (cassonetto).
 *
 * Schema della sezione (vista frontale):
 *
 *   ┌─────────────────────────┐  ← Base (larg. interna + 2×spessore)
 *   │  ┌───────────────────┐  │
 *   │  │                   │  │  ← Fianco (solo altezza interna)
 *   │  │    CAVITÀ          │  │
 *   │  │   (aria/fumi)     │  │
 *   │  │                   │  │
 *   │  └───────────────────┘  │
 *   └─────────────────────────┘  ← Coperchio (larg. interna + 2×spessore)
 *
 * I pannelli orizzontali (base/coperchio) coprono lo spessore dei fianchi.
 * I pannelli verticali (fianchi) sono alti esattamente quanto la misura interna.
 */
export function calculateRectangularDuct(input: DuctInput): CalculationResult {
    const { innerWidth, innerHeight, length, thickness, extraMargin } = input;

    // Pannelli orizzontali (base e coperchio):
    // larghezza = cavità interna + 2 × spessore materiale (avvolgono i fianchi)
    const horizontalWidth = innerWidth + 2 * thickness + extraMargin;
    const horizontalHeight = length;

    // Pannelli verticali (fianchi):
    // larghezza = solo altezza interna (si inseriscono tra base e coperchio)
    const verticalWidth = innerHeight + extraMargin;
    const verticalHeight = length;

    // Dimensioni esterne del cassonetto finito
    const outerWidth = innerWidth + 2 * thickness;
    const outerHeight = innerHeight + 2 * thickness;

    const horizFormula = extraMargin > 0
        ? `${innerWidth} + 2×${thickness} + ${extraMargin} = ${horizontalWidth}`
        : `${innerWidth} + 2×${thickness} = ${horizontalWidth}`;

    const vertFormula = extraMargin > 0
        ? `${innerHeight} + ${extraMargin} = ${verticalWidth}`
        : `${innerHeight}`;

    const pieces: CutPiece[] = [
        {
            id: 'base',
            label: 'Base / Coperchio',
            width: horizontalWidth,
            height: horizontalHeight,
            quantity: 2,
            color: PIECE_COLORS[0],
            formula: horizFormula,
        },
        {
            id: 'fianco',
            label: 'Fianco',
            width: verticalWidth,
            height: verticalHeight,
            quantity: 2,
            color: PIECE_COLORS[1],
            formula: vertFormula,
        },
    ];

    const totalArea =
        horizontalWidth * horizontalHeight * 2 +
        verticalWidth * verticalHeight * 2;

    const summaryLines = [
        `Canale rettangolare: sezione interna ${innerWidth}×${innerHeight} mm`,
        `Dimensione esterna: ${outerWidth}×${outerHeight} mm`,
        `Lunghezza tratto: ${length} mm — Spessore: ${thickness} mm`,
    ];
    if (extraMargin > 0) {
        summaryLines.push(`Margine extra: ${extraMargin} mm`);
    }
    summaryLines.push(
        `Pezzi totali: 4 (2 base/coperchio + 2 fianchi)`,
        `Superficie totale: ${(totalArea / 1_000_000).toFixed(3)} m²`
    );

    return {
        pieces,
        totalArea,
        summary: summaryLines.join('\n'),
        outerWidth,
        outerHeight,
    };
}

/**
 * "Esplode" i pezzi raggruppati in pezzi singoli per il nesting.
 * Es: un pezzo con quantity=2 diventa 2 pezzi separati.
 */
export function explodePieces(pieces: CutPiece[]): CutPiece[] {
    const result: CutPiece[] = [];
    let colorIdx = 0;
    for (const piece of pieces) {
        for (let i = 0; i < piece.quantity; i++) {
            result.push({
                ...piece,
                id: `${piece.id}-${i + 1}`,
                label: `${piece.label} #${i + 1}`,
                quantity: 1,
                color: PIECE_COLORS[colorIdx % PIECE_COLORS.length],
            });
            colorIdx++;
        }
    }
    return result;
}

// ============================================================
// ANGOLO A 90° (GOMITO)
// ============================================================

export interface ElbowInput {
    /** Larghezza interna del canale in mm */
    innerWidth: number;
    /** Altezza interna del canale in mm */
    innerHeight: number;
    /** Spessore del materiale in mm */
    thickness: number;
    /** Lunghezza del braccio A (ingresso) in mm */
    armA: number;
    /** Lunghezza del braccio B (uscita) in mm */
    armB: number;
    /** Margine extra in mm */
    extraMargin: number;
}

/**
 * Calcola i pezzi per un angolo a 90° (gomito) di un cassonetto rettangolare.
 *
 * Schema visto dall'alto:
 *
 *   Braccio A (ingresso, verticale)
 *       │         │
 *       │  cavità │
 *       │         │╲  taglio a 45°
 *       │         │  ╲
 *       │         │    ╲
 *       │                ╲──────── Braccio B (uscita, orizzontale)
 *       │                         │
 *       └─────────────────────────┘
 *
 * Pezzi generati:
 * 1. Base/Coperchio braccio A: copertura sopra+sotto del tratto verticale
 * 2. Base/Coperchio braccio B: copertura sopra+sotto del tratto orizzontale
 * 3. Fianco esterno: pezzo continuo che segue l'angolo esterno
 * 4. Fianco interno A: fino allo spigolo interno
 * 5. Fianco interno B: fino allo spigolo interno
 */
export function calculateElbow90(input: ElbowInput): CalculationResult {
    const { innerWidth, innerHeight, thickness, armA, armB, extraMargin } = input;

    const outerWidth = innerWidth + 2 * thickness;
    const outerHeight = innerHeight + 2 * thickness;

    // Base/Coperchio braccio A: include la zona di raccordo
    const baseAWidth = outerWidth + extraMargin;
    const baseAHeight = armA + outerWidth;

    // Base/Coperchio braccio B
    const baseBWidth = outerWidth + extraMargin;
    const baseBHeight = armB;

    // Fianchi esterni: 2 pezzi separati (uno per braccio), con sormonto nella zona angolo.
    // Ogni fianco esterno copre il proprio braccio + lo spessore del materiale per il sormonto.
    const extSideAWidth = innerHeight + extraMargin;
    const extSideAHeight = armA + thickness; // sormonto = spessore

    const extSideBWidth = innerHeight + extraMargin;
    const extSideBHeight = armB + outerWidth + thickness; // arriva fin oltre l'angolo + sormonto

    // Fianchi interni: 2 pezzi separati, si fermano allo spigolo
    const intSideAWidth = innerHeight + extraMargin;
    const intSideAHeight = armA;

    const intSideBWidth = innerHeight + extraMargin;
    const intSideBHeight = armB;

    const pieces: CutPiece[] = [
        {
            id: 'base-a',
            label: 'Base/Coperchio - Braccio A',
            width: baseAWidth,
            height: baseAHeight,
            quantity: 2,
            color: PIECE_COLORS[0],
            formula: `${outerWidth}${extraMargin ? ` + ${extraMargin}` : ''} × (${armA} + ${outerWidth})`,
        },
        {
            id: 'base-b',
            label: 'Base/Coperchio - Braccio B',
            width: baseBWidth,
            height: baseBHeight,
            quantity: 2,
            color: PIECE_COLORS[2],
            formula: `${outerWidth}${extraMargin ? ` + ${extraMargin}` : ''} × ${armB}`,
        },
        {
            id: 'fianco-ext-a',
            label: 'Fianco Esterno - Braccio A',
            width: extSideAWidth,
            height: extSideAHeight,
            quantity: 1,
            color: PIECE_COLORS[1],
            formula: `${innerHeight}${extraMargin ? ` + ${extraMargin}` : ''} × (${armA} + ${thickness}) — sormonto ${thickness}mm`,
        },
        {
            id: 'fianco-ext-b',
            label: 'Fianco Esterno - Braccio B',
            width: extSideBWidth,
            height: extSideBHeight,
            quantity: 1,
            color: PIECE_COLORS[5],
            formula: `${innerHeight}${extraMargin ? ` + ${extraMargin}` : ''} × (${armB} + ${outerWidth} + ${thickness}) — sormonto ${thickness}mm`,
        },
        {
            id: 'fianco-int-a',
            label: 'Fianco Interno - Braccio A',
            width: intSideAWidth,
            height: intSideAHeight,
            quantity: 1,
            color: PIECE_COLORS[3],
            formula: `${innerHeight}${extraMargin ? ` + ${extraMargin}` : ''} × ${armA}`,
        },
        {
            id: 'fianco-int-b',
            label: 'Fianco Interno - Braccio B',
            width: intSideBWidth,
            height: intSideBHeight,
            quantity: 1,
            color: PIECE_COLORS[4],
            formula: `${innerHeight}${extraMargin ? ` + ${extraMargin}` : ''} × ${armB}`,
        },
    ];

    const totalArea = pieces.reduce(
        (sum, p) => sum + p.width * p.height * p.quantity, 0
    );

    const summaryLines = [
        `Angolo 90°: sezione interna ${innerWidth}×${innerHeight} mm`,
        `Dimensione esterna: ${outerWidth}×${outerHeight} mm`,
        `Braccio A: ${armA} mm — Braccio B: ${armB} mm`,
        `Spessore: ${thickness} mm`,
    ];
    if (extraMargin > 0) summaryLines.push(`Margine extra: ${extraMargin} mm`);
    summaryLines.push(
        `Pezzi: ${pieces.reduce((s, p) => s + p.quantity, 0)} — Taglio a 45° sulla zona angolo`,
        `Superficie totale: ${(totalArea / 1_000_000).toFixed(3)} m²`
    );

    return {
        pieces,
        totalArea,
        summary: summaryLines.join('\n'),
        outerWidth,
        outerHeight,
    };
}

