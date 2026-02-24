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
    /** Se true, questo spazio è dentro una nicchia L (angolo vuoto) — priorità alta */
    isNotch?: boolean;
}

// ==================== ALGORITMO GUILLOTINE ====================

/**
 * Trova il miglior rettangolo libero dove piazzare un pezzo di dimensioni (pw × ph).
 * Strategia: Notch-Priority + Best Area Fit.
 * I rettangoli "notch" (dentro l'angolo vuoto di una L) hanno PRIORITÀ ASSOLUTA
 * perché usare quello spazio è gratis (altrimenti sarebbe sprecato).
 */
function findBestFit(
    freeRects: FreeRect[],
    pw: number,
    ph: number
): { index: number; rotated: boolean } | null {
    let bestIdx = -1;
    let bestRotated = false;
    let bestWaste = Infinity;
    let bestIsNotch = false;

    for (let i = 0; i < freeRects.length; i++) {
        const r = freeRects[i];
        const rIsNotch = !!r.isNotch;

        // Prova orientazione normale
        if (pw <= r.w && ph <= r.h) {
            const waste = r.w * r.h - pw * ph;
            // Notch ha priorità: se abbiamo un fit notch, non lo sovrascriviamo con un non-notch
            if (rIsNotch && !bestIsNotch) {
                bestWaste = waste;
                bestIdx = i;
                bestRotated = false;
                bestIsNotch = true;
            } else if (rIsNotch === bestIsNotch && waste < bestWaste) {
                bestWaste = waste;
                bestIdx = i;
                bestRotated = false;
                bestIsNotch = rIsNotch;
            }
        }

        // Prova orientazione ruotata
        if (pw !== ph && ph <= r.w && pw <= r.h) {
            const waste = r.w * r.h - pw * ph;
            if (rIsNotch && !bestIsNotch) {
                bestWaste = waste;
                bestIdx = i;
                bestRotated = true;
                bestIsNotch = true;
            } else if (rIsNotch === bestIsNotch && waste < bestWaste) {
                bestWaste = waste;
                bestIdx = i;
                bestRotated = true;
                bestIsNotch = rIsNotch;
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
 * Spezza automaticamente i pezzi che non entrano nella lastra.
 * Un pezzo con dimensioni maggiori della lastra viene diviso in più
 * spezzoni lungo il lato eccedente, con etichetta progressiva.
 *
 * Esempio: Base 300×10000 su lastra 2500×1200 →
 *   Il lato 10000 non entra in nessun modo → suddiviso in strisce da max 2500:
 *   Base pt.1/4 (300×2500), Base pt.2/4 (300×2500), Base pt.3/4 (300×2500), Base pt.4/4 (300×1000)
 */
function splitOversizedPieces(pieces: CutPiece[], sheetW: number, sheetH: number): CutPiece[] {
    const result: CutPiece[] = [];
    const maxDim = Math.max(sheetW, sheetH);
    const minDim = Math.min(sheetW, sheetH);

    for (const piece of pieces) {
        const pw = piece.width;
        const ph = piece.height;

        // Verifica se il pezzo entra nella lastra (anche ruotato)
        const fitsNormal = pw <= sheetW && ph <= sheetH;
        const fitsRotated = ph <= sheetW && pw <= sheetH;

        if (fitsNormal || fitsRotated) {
            result.push(piece);
            continue;
        }

        // Il pezzo non entra → determiniamo quale dimensione eccede
        // Il lato corto del pezzo deve entrare nel lato più piccolo della lastra
        const shortSide = Math.min(pw, ph);
        const longSide = Math.max(pw, ph);
        const isWidthLong = pw >= ph;

        // Il lato corto entra nella lastra?
        if (shortSide > minDim) {
            // Nemmeno il lato corto entra → pezzo impossibile per questa lastra
            result.push(piece); // lascia che il nesting lo segni come unplaced
            continue;
        }

        // Spezziamo il lato lungo in tratti che entrano
        const maxCutLength = maxDim; // max lunghezza di un singolo taglio
        const numParts = Math.ceil(longSide / maxCutLength);
        const remainder = longSide % maxCutLength;

        for (let i = 0; i < numParts; i++) {
            const partLength = (i === numParts - 1 && remainder > 0) ? remainder : maxCutLength;
            result.push({
                ...piece,
                id: `${piece.id}-pt${i + 1}`,
                label: `${piece.label} pt.${i + 1}/${numParts}`,
                width: isWidthLong ? partLength : pw,
                height: isWidthLong ? ph : partLength,
                quantity: 1,
            });
        }
    }

    return result;
}

/**
 * Esegue il nesting dei pezzi sulla configurazione della lastra data.
 * Algoritmo: Guillotine Best-Fit con rotazione, split intelligente,
 * e MULTI-SHEET BACKTRACKING (prova tutte le lastre aperte prima di aprirne una nuova).
 * I pezzi troppo lunghi vengono automaticamente spezzati.
 */
export function nestPieces(
    pieces: CutPiece[],
    sheetConfig: SheetConfig,
    maxSheets: number = 20
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

    // Auto-split dei pezzi troppo lunghi per la lastra
    const fittable = splitOversizedPieces(expanded, sheetW, sheetH);

    // Ordina per lato maggiore decrescente (pezzi grandi per primi)
    fittable.sort((a, b) => {
        const maxA = Math.max(a.width, a.height);
        const maxB = Math.max(b.width, b.height);
        if (maxB !== maxA) return maxB - maxA;
        return (b.width * b.height) - (a.width * a.height);
    });

    // Stato di TUTTE le lastre aperte contemporaneamente
    interface OpenSheet {
        placements: PlacedPiece[];
        freeRects: FreeRect[];
    }

    const openSheets: OpenSheet[] = [];
    const unplaced: CutPiece[] = [];

    for (const piece of fittable) {
        const pw = piece.width;
        const ph = piece.height;

        // Verifica che il pezzo entri fisicamente in una lastra
        const fitsAtAll =
            (pw <= sheetW && ph <= sheetH) ||
            (ph <= sheetW && pw <= sheetH);

        if (!fitsAtAll) {
            unplaced.push(piece);
            continue;
        }

        // Cerca il MIGLIOR posizionamento tra TUTTE le lastre aperte
        let bestSheetIdx = -1;
        let bestFit: { index: number; rotated: boolean } | null = null;
        let bestWaste = Infinity;
        let bestLCorner: 'tr' | 'tl' | 'br' | 'bl' | null = null;

        const hasNotch = !!piece.lNotch;

        if (hasNotch && piece.lNotch) {
            // === PEZZO L-SHAPED: prova TUTTE le 4 orientazioni dell'incavo ===
            const origNotch = piece.lNotch;
            const allCorners: ('tr' | 'tl' | 'br' | 'bl')[] = ['tr', 'tl', 'br', 'bl'];

            // Per ogni lastra aperta
            for (let s = 0; s < openSheets.length; s++) {
                const sheet = openSheets[s];

                // Per ogni corner dell'incavo, prova se il pezzo ci sta
                for (const corner of allCorners) {
                    // Determina se serve rotazione per questo corner
                    // Normal (w×h): tr, tl → notch(w=origNotch.w, h=origNotch.h)
                    // Rotated (h×w): br, bl con swap → notch diverso
                    // In realtà, su un foglio piatto possiamo specchiare liberamente
                    // quindi proviamo w×h e h×w con tutti i corner

                    const orientations: { ow: number; oh: number; rotated: boolean }[] = [
                        { ow: pw, oh: ph, rotated: false },
                    ];
                    if (pw !== ph) {
                        orientations.push({ ow: ph, oh: pw, rotated: true });
                    }

                    for (const orient of orientations) {
                        // Trova il miglior rect in questa lastra per queste dimensioni
                        for (let ri = 0; ri < sheet.freeRects.length; ri++) {
                            const r = sheet.freeRects[ri];
                            if (orient.ow <= r.w && orient.oh <= r.h) {
                                const waste = r.w * r.h - orient.ow * orient.oh;

                                // Calcola il notch che risulterebbe
                                const nw = orient.rotated ? origNotch.h : origNotch.w;
                                const nh = orient.rotated ? origNotch.w : origNotch.h;
                                let notchX = r.x;
                                let notchY = r.y;
                                if (corner === 'tr') { notchX = r.x + orient.ow - nw; }
                                else if (corner === 'br') { notchX = r.x + orient.ow - nw; notchY = r.y + orient.oh - nh; }
                                else if (corner === 'bl') { notchY = r.y + orient.oh - nh; }

                                // LOOKAHEAD: quanti pezzi rimanenti entrerebbero in questo notch?
                                let lookaheadScore = 0;
                                const remainingPieces = fittable.slice(fittable.indexOf(piece) + 1);
                                for (const rp of remainingPieces) {
                                    if ((rp.width <= nw && rp.height <= nh) ||
                                        (rp.height <= nw && rp.width <= nh)) {
                                        lookaheadScore += rp.width * rp.height; // area recuperata
                                    }
                                }

                                // Confronta: priorità notch > lookaheadScore > waste
                                const rIsNotch = !!r.isNotch;
                                const currentIsNotch = bestFit ? !!(openSheets[bestSheetIdx]?.freeRects[bestFit.index]?.isNotch) : false;

                                let isBetter = false;
                                if (rIsNotch && !currentIsNotch) {
                                    isBetter = true;
                                } else if (rIsNotch === currentIsNotch) {
                                    if (lookaheadScore > (bestLCorner ? (bestWaste < 0 ? -bestWaste : 0) : 0)) {
                                        isBetter = true;
                                    } else if (waste < bestWaste) {
                                        isBetter = true;
                                    }
                                }

                                if (isBetter || bestFit === null) {
                                    bestWaste = waste;
                                    bestSheetIdx = s;
                                    bestFit = { index: ri, rotated: orient.rotated };
                                    bestLCorner = corner;
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // === PEZZO RETTANGOLARE NORMALE ===
            for (let s = 0; s < openSheets.length; s++) {
                const sheet = openSheets[s];
                const fit = findBestFit(sheet.freeRects, pw, ph);
                if (fit) {
                    const rect = sheet.freeRects[fit.index];
                    const waste = rect.w * rect.h - pw * ph;
                    const rIsNotch = !!rect.isNotch;
                    const currentIsNotch = bestFit ? !!(openSheets[bestSheetIdx]?.freeRects[bestFit.index]?.isNotch) : false;

                    let isBetter = false;
                    if (rIsNotch && !currentIsNotch) isBetter = true;
                    else if (rIsNotch === currentIsNotch && waste < bestWaste) isBetter = true;

                    if (isBetter) {
                        bestWaste = waste;
                        bestSheetIdx = s;
                        bestFit = fit;
                    }
                }
            }
        }

        // Se nessuna lastra esistente ha spazio, apriamo una nuova
        if (bestSheetIdx < 0) {
            if (openSheets.length >= maxSheets) {
                unplaced.push(piece);
                continue;
            }

            const newSheet: OpenSheet = {
                placements: [],
                freeRects: [{ x: 0, y: 0, w: sheetW, h: sheetH }],
            };
            openSheets.push(newSheet);
            bestSheetIdx = openSheets.length - 1;

            if (hasNotch && piece.lNotch) {
                // Per una nuova lastra, scegli l'orientazione con migliore lookahead
                bestFit = findBestFit(newSheet.freeRects, pw, ph);
                // Lookahead per scegliere il corner migliore
                const origNotch = piece.lNotch;
                const remainingPieces = fittable.slice(fittable.indexOf(piece) + 1);
                let bestScore = -1;
                for (const corner of ['tr', 'tl', 'br', 'bl'] as const) {
                    let score = 0;
                    const nw = origNotch.w;
                    const nh = origNotch.h;
                    for (const rp of remainingPieces) {
                        if ((rp.width <= nw && rp.height <= nh) ||
                            (rp.height <= nw && rp.width <= nh)) {
                            score += rp.width * rp.height;
                        }
                    }
                    // Bonus se il corner facilita specchiamento della prossima L
                    const nextL = remainingPieces.find(rp => !!rp.lNotch);
                    if (nextL) {
                        // Preferisci TR per la prima L (così la seconda va TL → specchio)
                        if (corner === 'tr') score += 100000;
                    }
                    if (score > bestScore) {
                        bestScore = score;
                        bestLCorner = corner;
                    }
                }
            } else {
                bestFit = findBestFit(newSheet.freeRects, pw, ph);
            }
        }

        if (bestFit && bestSheetIdx >= 0) {
            const sheet = openSheets[bestSheetIdx];
            const rect = sheet.freeRects[bestFit.index];
            const placedW = bestFit.rotated ? ph : pw;
            const placedH = bestFit.rotated ? pw : ph;

            // Determina il notch finale
            let notchInfo = piece.lNotch ? { ...piece.lNotch } : undefined;

            if (hasNotch && notchInfo) {
                // Usa il corner scelto dall'ottimizzazione
                if (bestLCorner) {
                    if (bestFit.rotated) {
                        notchInfo = {
                            w: notchInfo.h,
                            h: notchInfo.w,
                            corner: bestLCorner,
                        };
                    } else {
                        notchInfo = { ...notchInfo, corner: bestLCorner };
                    }
                } else if (bestFit.rotated) {
                    const cornerMap: Record<string, 'tr' | 'tl' | 'br' | 'bl'> = {
                        'tr': 'br', 'br': 'bl', 'bl': 'tl', 'tl': 'tr',
                    };
                    notchInfo = {
                        w: notchInfo.h,
                        h: notchInfo.w,
                        corner: cornerMap[notchInfo.corner],
                    };
                }
            }

            sheet.placements.push({
                piece,
                x: rect.x,
                y: rect.y,
                width: placedW,
                height: placedH,
                rotated: bestFit.rotated,
                isLShaped: hasNotch,
                lNotch: notchInfo,
            });

            // Guillotine split del rettangolo occupato
            const newFree = guillotineSplit(rect, placedW, placedH, gap);
            sheet.freeRects.splice(bestFit.index, 1, ...newFree);

            // Se il pezzo è a L, aggiungere l'angolo vuoto come spazio libero
            if (hasNotch && notchInfo) {
                let notchX = rect.x;
                let notchY = rect.y;

                if (notchInfo.corner === 'tr') {
                    notchX = rect.x + placedW - notchInfo.w;
                    notchY = rect.y;
                } else if (notchInfo.corner === 'tl') {
                    notchX = rect.x;
                    notchY = rect.y;
                } else if (notchInfo.corner === 'br') {
                    notchX = rect.x + placedW - notchInfo.w;
                    notchY = rect.y + placedH - notchInfo.h;
                } else if (notchInfo.corner === 'bl') {
                    notchX = rect.x;
                    notchY = rect.y + placedH - notchInfo.h;
                }

                if (notchInfo.w > gap && notchInfo.h > gap) {
                    sheet.freeRects.push({
                        x: notchX,
                        y: notchY,
                        w: notchInfo.w,
                        h: notchInfo.h,
                        isNotch: true,
                    });
                }
            }

            sheet.freeRects = sheet.freeRects.filter(r => r.w > gap && r.h > gap);
        } else {
            unplaced.push(piece);
        }
    }

    // Costruisci il risultato finale da tutte le lastre aperte
    const sheets: NestingSheet[] = openSheets
        .filter(s => s.placements.length > 0)
        .map((s, idx) => {
            const usedArea = s.placements.reduce(
                (sum, p) => sum + p.width * p.height, 0
            );
            const remnants: Remnant[] = s.freeRects
                .filter(r => r.w >= MIN_REMNANT_SIZE && r.h >= MIN_REMNANT_SIZE)
                .map(r => ({ x: r.x, y: r.y, width: r.w, height: r.h }));

            return {
                index: idx,
                placements: s.placements,
                utilization: parseFloat(
                    ((usedArea / (sheetW * sheetH)) * 100).toFixed(1)
                ),
                remnants,
            };
        });

    return {
        sheets,
        unplaced,
        totalSheets: sheets.length,
    };
}

