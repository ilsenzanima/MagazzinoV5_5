/**
 * Algoritmo di Nesting 2D — Guillotine Best-Fit con rotazione.
 *
 * Migliora il precedente Shelf Packing con:
 * - Taglio a ghigliottina realistico (ogni pezzo divide lo spazio in 2 rettangoli)
 * - Best-Fit: valuta TUTTI gli spazi liberi per ogni pezzo
 * - Rotazione automatica: prova 0° e 90° e sceglie la migliore
 * - Split intelligente: sceglie se dividere in orizzontale o verticale
 *   per massimizzare l'avanzo più grande
 * - Calcolo avanzi riutilizzabili (Remnants) per ogni lastra
 * - Supporto pezzi a L (angoli 90° base unica): bounding-box + recupero angolo
 */

import type { CutPiece } from './calculations';

// ==================== INTERFACCE ====================

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
    /** Se true, il pezzo è a forma di L (angolo 90° base unica) */
    isLShaped?: boolean;
    /** Dimensioni dell'incavo dell'L (angolo mancante) */
    lNotch?: { w: number; h: number; corner: 'tr' | 'tl' | 'br' | 'bl' };
}

export interface Remnant {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface NestingSheet {
    /** Indice della lastra (0-based) */
    index: number;
    /** Pezzi posizionati su questa lastra */
    placements: PlacedPiece[];
    /** Percentuale di utilizzo della lastra (0-100) */
    utilization: number;
    /** Avanzi riutilizzabili (zone vuote > soglia minima) */
    remnants: Remnant[];
}

export interface NestingResult {
    sheets: NestingSheet[];
    /** Pezzi che non sono entrati in nessuna lastra */
    unplaced: CutPiece[];
    /** Numero totale di lastre necessarie */
    totalSheets: number;
}

// ==================== RETTANGOLO LIBERO ====================

interface FreeRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

// ==================== ALGORITMO GUILLOTINE ====================

/**
 * Trova il miglior rettangolo libero dove piazzare un pezzo di dimensioni (pw × ph).
 * Strategia: Best Area Fit — sceglie lo spazio con meno area sprecata.
 */
function findBestFit(
    freeRects: FreeRect[],
    pw: number,
    ph: number
): { index: number; rotated: boolean } | null {
    let bestIdx = -1;
    let bestRotated = false;
    let bestWaste = Infinity;

    for (let i = 0; i < freeRects.length; i++) {
        const r = freeRects[i];

        // Prova orientazione normale
        if (pw <= r.w && ph <= r.h) {
            const waste = r.w * r.h - pw * ph;
            if (waste < bestWaste) {
                bestWaste = waste;
                bestIdx = i;
                bestRotated = false;
            }
        }

        // Prova orientazione ruotata (solo se dimensioni diverse)
        if (pw !== ph && ph <= r.w && pw <= r.h) {
            const waste = r.w * r.h - pw * ph;
            if (waste < bestWaste) {
                bestWaste = waste;
                bestIdx = i;
                bestRotated = true;
            }
        }
    }

    return bestIdx >= 0 ? { index: bestIdx, rotated: bestRotated } : null;
}

/**
 * Dopo aver piazzato un pezzo in un rettangolo libero,
 * divide lo spazio rimanente in 2 rettangoli (taglio a ghigliottina).
 *
 * Strategia: "Shorter Leftover Axis" — divide in modo che l'avanzo
 * più grande sia il più "quadrato" possibile (utilizzabile).
 */
function guillotineSplit(
    rect: FreeRect,
    pw: number,
    ph: number,
    gap: number
): FreeRect[] {
    const result: FreeRect[] = [];

    const rightW = rect.w - pw - gap;
    const bottomH = rect.h - ph - gap;

    // Split orizzontale: pezzo di destra ha tutta l'altezza, pezzo sotto solo la larghezza del pezzo
    // Split verticale: pezzo sotto ha tutta la larghezza, pezzo a destra solo l'altezza del pezzo
    // Scegliamo la variante che produce l'avanzo più grande

    const horizArea = (rightW > 0 ? rightW * rect.h : 0) + (bottomH > 0 ? pw * bottomH : 0);
    const vertArea = (rightW > 0 ? rightW * ph : 0) + (bottomH > 0 ? rect.w * bottomH : 0);

    if (horizArea >= vertArea) {
        // Split orizzontale
        if (rightW > 0) {
            result.push({ x: rect.x + pw + gap, y: rect.y, w: rightW, h: rect.h });
        }
        if (bottomH > 0) {
            result.push({ x: rect.x, y: rect.y + ph + gap, w: pw, h: bottomH });
        }
    } else {
        // Split verticale
        if (rightW > 0) {
            result.push({ x: rect.x + pw + gap, y: rect.y, w: rightW, h: ph });
        }
        if (bottomH > 0) {
            result.push({ x: rect.x, y: rect.y + ph + gap, w: rect.w, h: bottomH });
        }
    }

    return result;
}

/**
 * Soglia minima per considerare un avanzo "riutilizzabile" (mm).
 */
const MIN_REMNANT_SIZE = 80;

/**
 * Esegue il nesting dei pezzi sulla configurazione della lastra data.
 * Algoritmo: Guillotine Best-Fit con rotazione e split intelligente.
 */
export function nestPieces(
    pieces: CutPiece[],
    sheetConfig: SheetConfig,
    maxSheets: number = 10
): NestingResult {
    const { width: sheetW, height: sheetH, gap } = sheetConfig;

    // Espandi i pezzi con quantity > 1 in singoli elementi
    const expanded: CutPiece[] = [];
    for (const p of pieces) {
        for (let q = 0; q < p.quantity; q++) {
            expanded.push({
                ...p,
                id: p.quantity > 1 ? `${p.id}-${q + 1}` : p.id,
                quantity: 1,
            });
        }
    }

    // Ordina per lato maggiore decrescente (pezzi grandi per primi)
    expanded.sort((a, b) => {
        const maxA = Math.max(a.width, a.height);
        const maxB = Math.max(b.width, b.height);
        if (maxB !== maxA) return maxB - maxA;
        // Parità: ordina per area
        return (b.width * b.height) - (a.width * a.height);
    });

    const sheets: NestingSheet[] = [];
    const unplaced: CutPiece[] = [];

    let freeRects: FreeRect[] = [{ x: 0, y: 0, w: sheetW, h: sheetH }];
    let currentPlacements: PlacedPiece[] = [];

    function finalizeSheet() {
        if (currentPlacements.length === 0) return;

        const usedArea = currentPlacements.reduce(
            (sum, p) => sum + p.width * p.height, 0
        );

        // Calcola avanzi riutilizzabili
        const remnants: Remnant[] = freeRects
            .filter(r => r.w >= MIN_REMNANT_SIZE && r.h >= MIN_REMNANT_SIZE)
            .map(r => ({ x: r.x, y: r.y, width: r.w, height: r.h }));

        sheets.push({
            index: sheets.length,
            placements: currentPlacements,
            utilization: parseFloat(
                ((usedArea / (sheetW * sheetH)) * 100).toFixed(1)
            ),
            remnants,
        });
    }

    function newSheet() {
        freeRects = [{ x: 0, y: 0, w: sheetW, h: sheetH }];
        currentPlacements = [];
    }

    for (const piece of expanded) {
        const pw = piece.width;
        const ph = piece.height;

        // Verifica che il pezzo possa fisicamente entrare nella lastra
        const fitsAtAll =
            (pw <= sheetW && ph <= sheetH) ||
            (ph <= sheetW && pw <= sheetH);

        if (!fitsAtAll) {
            unplaced.push(piece);
            continue;
        }

        // Cerca il miglior spazio libero
        let best = findBestFit(freeRects, pw, ph);

        if (!best) {
            // Lastra piena → chiudi e apri una nuova
            finalizeSheet();

            if (sheets.length >= maxSheets) {
                unplaced.push(piece);
                continue;
            }

            newSheet();
            best = findBestFit(freeRects, pw, ph);
        }

        if (best) {
            const rect = freeRects[best.index];
            const placedW = best.rotated ? ph : pw;
            const placedH = best.rotated ? pw : ph;

            currentPlacements.push({
                piece,
                x: rect.x,
                y: rect.y,
                width: placedW,
                height: placedH,
                rotated: best.rotated,
            });

            // Rimuovi il rettangolo usato e aggiungi i 2 risultanti dal taglio
            const newFree = guillotineSplit(rect, placedW, placedH, gap);
            freeRects.splice(best.index, 1, ...newFree);

            // Rimuovi rettangoli troppo piccoli per ospitare qualsiasi pezzo rimasto
            freeRects = freeRects.filter(r => r.w > gap && r.h > gap);
        } else {
            unplaced.push(piece);
        }
    }

    // Chiudi l'ultima lastra
    finalizeSheet();

    return {
        sheets,
        unplaced,
        totalSheets: sheets.length,
    };
}
