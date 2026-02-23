/**
 * Motore di calcolo per il Simulatore di Taglio.
 * Calcola i pezzi necessari dato un canale rettangolare e lo spessore del materiale.
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
    /** Sormonto / sovrapposizione in mm (margine aggiuntivo per giunzioni) */
    overlap: number;
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
}

export interface CalculationResult {
    pieces: CutPiece[];
    /** Superficie totale dei pezzi in mm² */
    totalArea: number;
    /** Riepilogo testuale */
    summary: string;
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
 * Calcola i pezzi necessari per un canale rettangolare dritto.
 *
 * Per un canale con sezione interna W x H e spessore T:
 * - 2 pannelli "Lato Orizzontale" (base/coperchio):
 *     larghezza = W + 2*T (coprono anche lo spessore laterale)
 *     altezza   = lunghezza del tratto
 *
 * - 2 pannelli "Lato Verticale" (fianchi):
 *     larghezza = H (solo la misura interna, i pannelli orizzontali li avvolgono)
 *     altezza   = lunghezza del tratto
 *
 * Il sormonto viene aggiunto alla larghezza di ogni pezzo.
 */
export function calculateRectangularDuct(input: DuctInput): CalculationResult {
    const { innerWidth, innerHeight, length, thickness, overlap } = input;

    // Pannelli orizzontali (base e coperchio): coprono larghezza interna + 2 spessori + sormonto
    const horizontalWidth = innerWidth + 2 * thickness + overlap;
    const horizontalHeight = length;

    // Pannelli verticali (fianchi): solo altezza interna + sormonto
    const verticalWidth = innerHeight + overlap;
    const verticalHeight = length;

    const pieces: CutPiece[] = [
        {
            id: 'horiz',
            label: `Base / Coperchio (${horizontalWidth.toFixed(0)}×${horizontalHeight.toFixed(0)} mm)`,
            width: horizontalWidth,
            height: horizontalHeight,
            quantity: 2,
            color: PIECE_COLORS[0],
        },
        {
            id: 'vert',
            label: `Fianco (${verticalWidth.toFixed(0)}×${verticalHeight.toFixed(0)} mm)`,
            width: verticalWidth,
            height: verticalHeight,
            quantity: 2,
            color: PIECE_COLORS[1],
        },
    ];

    const totalArea =
        horizontalWidth * horizontalHeight * 2 +
        verticalWidth * verticalHeight * 2;

    const summary = [
        `Canale rettangolare ${innerWidth}×${innerHeight} mm, lungo ${length} mm`,
        `Spessore materiale: ${thickness} mm | Sormonto: ${overlap} mm`,
        `Pezzi totali: 4 (2 orizzontali + 2 verticali)`,
        `Superficie totale: ${(totalArea / 1_000_000).toFixed(3)} m²`,
    ].join('\n');

    return { pieces, totalArea, summary };
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
