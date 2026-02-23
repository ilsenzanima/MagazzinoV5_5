/**
 * Algoritmo di Nesting 2D (Bin Packing) semplificato.
 * Posiziona rettangoli su una lastra cercando di minimizzare lo spreco.
 *
 * Usa un approccio "Shelf" (a scaffale), buon compromesso tra semplicità e qualità:
 * - I pezzi sono ordinati per altezza decrescente.
 * - Si creano "ripiani" orizzontali sulla lastra.
 * - Se un pezzo non entra nel ripiano corrente, se ne apre uno nuovo.
 * - Se non c'è più spazio sulla lastra corrente, si apre una nuova lastra.
 */

import type { CutPiece } from './calculations';

export interface SheetConfig {
    /** Larghezza della lastra in mm */
    width: number;
    /** Altezza della lastra in mm */
    height: number;
    /** Spazio tra tagli (kerf / gap) in mm */
    gap: number;
}

export interface PlacedPiece {
    piece: CutPiece;
    x: number;
    y: number;
    width: number;
    height: number;
    rotated: boolean;
}

export interface NestingSheet {
    /** Indice della lastra (0-based) */
    index: number;
    /** Pezzi posizionati su questa lastra */
    placements: PlacedPiece[];
    /** Percentuale di utilizzo della lastra (0-100) */
    utilization: number;
}

export interface NestingResult {
    sheets: NestingSheet[];
    /** Pezzi che non sono entrati in nessuna lastra */
    unplaced: CutPiece[];
    /** Numero totale di lastre necessarie */
    totalSheets: number;
}

/**
 * Esegue il nesting dei pezzi sulla configurazione della lastra data.
 *
 * Supporta la rotazione dei pezzi di 90° se questo li fa entrare meglio.
 */
export function nestPieces(
    pieces: CutPiece[],
    sheetConfig: SheetConfig,
    maxSheets: number = 10
): NestingResult {
    const { width: sheetW, height: sheetH, gap } = sheetConfig;

    // Ordina per area decrescente (i pezzi grandi vanno prima)
    const sorted = [...pieces].sort((a, b) => {
        const areaA = a.width * a.height;
        const areaB = b.width * b.height;
        return areaB - areaA;
    });

    const sheets: NestingSheet[] = [];
    const unplaced: CutPiece[] = [];

    // State per ogni lastra: lista di "scaffali" (shelf)
    interface Shelf {
        y: number;
        height: number;
        xCursor: number; // prossima posizione x libera
    }

    function tryPlace(piece: CutPiece, shelves: Shelf[]): PlacedPiece | null {
        // Prova entrambe le orientazioni
        const orientations: { w: number; h: number; rotated: boolean }[] = [
            { w: piece.width, h: piece.height, rotated: false },
        ];
        // Aggiungi orientazione ruotata se le dimensioni sono diverse
        if (piece.width !== piece.height) {
            orientations.push({ w: piece.height, h: piece.width, rotated: true });
        }

        for (const orient of orientations) {
            // Prova ogni scaffale esistente
            for (const shelf of shelves) {
                if (orient.h <= shelf.height && shelf.xCursor + orient.w <= sheetW) {
                    const placement: PlacedPiece = {
                        piece,
                        x: shelf.xCursor,
                        y: shelf.y,
                        width: orient.w,
                        height: orient.h,
                        rotated: orient.rotated,
                    };
                    shelf.xCursor += orient.w + gap;
                    return placement;
                }
            }
        }

        // Nessuno scaffale va bene → crea nuovo scaffale
        const lastShelf = shelves[shelves.length - 1];
        const newY = lastShelf ? lastShelf.y + lastShelf.height + gap : 0;

        for (const orient of orientations) {
            if (newY + orient.h <= sheetH && orient.w <= sheetW) {
                const newShelf: Shelf = {
                    y: newY,
                    height: orient.h,
                    xCursor: orient.w + gap,
                };
                shelves.push(newShelf);
                return {
                    piece,
                    x: 0,
                    y: newY,
                    width: orient.w,
                    height: orient.h,
                    rotated: orient.rotated,
                };
            }
        }

        return null;
    }

    let currentShelves: Shelf[] = [];
    let currentPlacements: PlacedPiece[] = [];

    for (const piece of sorted) {
        // Verifica prima se il pezzo entra fisicamente nella lastra
        const fitsAtAll =
            (piece.width <= sheetW && piece.height <= sheetH) ||
            (piece.height <= sheetW && piece.width <= sheetH);

        if (!fitsAtAll) {
            unplaced.push(piece);
            continue;
        }

        let placed = tryPlace(piece, currentShelves);

        if (!placed) {
            // Chiudi la lastra corrente e aprine una nuova
            if (currentPlacements.length > 0) {
                const usedArea = currentPlacements.reduce(
                    (sum, p) => sum + p.width * p.height,
                    0
                );
                sheets.push({
                    index: sheets.length,
                    placements: currentPlacements,
                    utilization: parseFloat(
                        ((usedArea / (sheetW * sheetH)) * 100).toFixed(1)
                    ),
                });
            }

            if (sheets.length >= maxSheets) {
                unplaced.push(piece);
                continue;
            }

            currentShelves = [];
            currentPlacements = [];
            placed = tryPlace(piece, currentShelves);
        }

        if (placed) {
            currentPlacements.push(placed);
        } else {
            unplaced.push(piece);
        }
    }

    // Chiudi l'ultima lastra
    if (currentPlacements.length > 0) {
        const usedArea = currentPlacements.reduce(
            (sum, p) => sum + p.width * p.height,
            0
        );
        sheets.push({
            index: sheets.length,
            placements: currentPlacements,
            utilization: parseFloat(
                ((usedArea / (sheetW * sheetH)) * 100).toFixed(1)
            ),
        });
    }

    return {
        sheets,
        unplaced,
        totalSheets: sheets.length,
    };
}
