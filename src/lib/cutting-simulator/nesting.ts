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

// ==================== COMPOUND L-PAIR ====================

interface CompoundLInfo {
    piece1: CutPiece;
    piece2: CutPiece;
    solidW: number;   // larghezza braccio solido (pieceW - notchW)
    solidH: number;   // altezza braccio solido (pieceH - notchH)
    holeW: number;    // larghezza buco interno (= notchW)
    holeH: number;    // altezza buco interno (può essere 0)
}

/**
 * Rileva coppie di pezzi L identici e li combina in un pezzo composto
 * "incastrato" che occupa meno spazio sulla lastra.
 *
 * Esempio: 2 pezzi a L 800×800 con incavo 500×500 →
 * Un unico rettangolo 1100×800 con buco interno 500×200.
 * Risparmio: ~31% di occupazione lastra!
 */
function createLPairs(
    pieces: CutPiece[],
    sheetW: number,
    sheetH: number,
    compounds: Map<string, CompoundLInfo>
): CutPiece[] {
    const result: CutPiece[] = [];
    const used = new Set<number>();

    for (let i = 0; i < pieces.length; i++) {
        if (used.has(i)) continue;
        const p = pieces[i];

        if (!p.lNotch) {
            result.push(p);
            continue;
        }

        // Cerca un partner L con stesse dimensioni
        let partner = -1;
        for (let j = i + 1; j < pieces.length; j++) {
            if (used.has(j)) continue;
            const q = pieces[j];
            if (q.lNotch &&
                q.width === p.width && q.height === p.height &&
                q.lNotch.w === p.lNotch.w && q.lNotch.h === p.lNotch.h) {
                partner = j;
                break;
            }
        }

        if (partner < 0) {
            result.push(p);
            continue;
        }

        used.add(i);
        used.add(partner);

        const notch = p.lNotch;
        const solidW = p.width - notch.w;
        const solidH = p.height - notch.h;
        const compoundW = solidW + p.width;
        const compoundH = p.height;
        const holeH = Math.max(0, 2 * notch.h - p.height);

        // Verifica che il composto entri nella lastra
        const fits = (compoundW <= sheetW && compoundH <= sheetH) ||
            (compoundH <= sheetW && compoundW <= sheetH);

        if (!fits) {
            result.push(p);
            result.push(pieces[partner]);
            continue;
        }

        const saving = p.width * 2 - compoundW;
        const compId = `compound-${p.id}+${pieces[partner].id}`;
        compounds.set(compId, {
            piece1: p,
            piece2: pieces[partner],
            solidW,
            solidH,
            holeW: notch.w,
            holeH,
        });

        result.push({
            id: compId,
            label: `Incastro: ${p.label}`,
            width: compoundW,
            height: compoundH,
            quantity: 1,
            color: p.color,
            formula: `Incastro L: ${compoundW}×${compoundH} (−${saving} mm)`,
        });
    }

    return result;
}

/**
 * Esegue il nesting dei pezzi sulla configurazione della lastra data.
 * Algoritmo: Guillotine Best-Fit con:
 * - Auto-split pezzi troppo lunghi
 * - Incastro automatico coppie L (compound L-pair)
 * - Multi-sheet backtracking
 * - Notch priority per riempire nicchie L
 * - Rotazione intelligente con lookahead per L singole
 */
export function nestPieces(
    pieces: CutPiece[],
    sheetConfig: SheetConfig,
    maxSheets: number = 20
): NestingResult {
    const { width: sheetW, height: sheetH, gap } = sheetConfig;

    // 1. Espandi quantity > 1
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

    // 2. Auto-split pezzi troppo lunghi
    const fittable = splitOversizedPieces(expanded, sheetW, sheetH);

    // 3. Compound L-pairs (incastro automatico)
    const compounds = new Map<string, CompoundLInfo>();
    const withCompounds = createLPairs(fittable, sheetW, sheetH, compounds);

    // 4. Ordina per lato maggiore decrescente
    withCompounds.sort((a, b) => {
        const maxA = Math.max(a.width, a.height);
        const maxB = Math.max(b.width, b.height);
        if (maxB !== maxA) return maxB - maxA;
        return (b.width * b.height) - (a.width * a.height);
    });

    // Stato di tutte le lastre aperte
    interface OpenSheet {
        placements: PlacedPiece[];
        freeRects: FreeRect[];
    }

    const openSheets: OpenSheet[] = [];
    const unplaced: CutPiece[] = [];

    for (let pi = 0; pi < withCompounds.length; pi++) {
        const piece = withCompounds[pi];
        const pw = piece.width;
        const ph = piece.height;
        const isCompound = compounds.has(piece.id);
        const hasNotch = !!piece.lNotch && !isCompound;

        // Verifica che il pezzo entri fisicamente
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

        if (hasNotch && piece.lNotch) {
            // PEZZO L SINGOLO: prova tutte le 4 orientazioni dell'incavo
            const origNotch = piece.lNotch;
            const corners: ('tr' | 'tl' | 'br' | 'bl')[] = ['tr', 'tl', 'br', 'bl'];

            for (let s = 0; s < openSheets.length; s++) {
                const sheet = openSheets[s];
                for (const corner of corners) {
                    const orientations = [{ ow: pw, oh: ph, rot: false }];
                    if (pw !== ph) orientations.push({ ow: ph, oh: pw, rot: true });

                    for (const o of orientations) {
                        for (let ri = 0; ri < sheet.freeRects.length; ri++) {
                            const r = sheet.freeRects[ri];
                            if (o.ow <= r.w && o.oh <= r.h) {
                                const waste = r.w * r.h - o.ow * o.oh;
                                const rIsNotch = !!r.isNotch;
                                const curIsNotch = bestFit ? !!(openSheets[bestSheetIdx]?.freeRects[bestFit.index]?.isNotch) : false;

                                let better = false;
                                if (rIsNotch && !curIsNotch) better = true;
                                else if (rIsNotch === curIsNotch && waste < bestWaste) better = true;

                                if (better || !bestFit) {
                                    bestWaste = waste;
                                    bestSheetIdx = s;
                                    bestFit = { index: ri, rotated: o.rot };
                                    bestLCorner = corner;
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // PEZZO RETTANGOLARE o COMPOUND
            for (let s = 0; s < openSheets.length; s++) {
                const sheet = openSheets[s];
                const fit = findBestFit(sheet.freeRects, pw, ph);
                if (fit) {
                    const rect = sheet.freeRects[fit.index];
                    const waste = rect.w * rect.h - pw * ph;
                    const rIsNotch = !!rect.isNotch;
                    const curIsNotch = bestFit ? !!(openSheets[bestSheetIdx]?.freeRects[bestFit.index]?.isNotch) : false;

                    let better = false;
                    if (rIsNotch && !curIsNotch) better = true;
                    else if (rIsNotch === curIsNotch && waste < bestWaste) better = true;

                    if (better) {
                        bestWaste = waste;
                        bestSheetIdx = s;
                        bestFit = fit;
                    }
                }
            }
        }

        // Nessuna lastra ha spazio → apri una nuova
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
            bestFit = findBestFit(newSheet.freeRects, pw, ph);

            // Per L singole su nuova lastra, scegli corner con lookahead
            if (hasNotch && piece.lNotch) {
                const remaining = withCompounds.slice(pi + 1);
                let bestScore = -1;
                for (const c of ['tr', 'tl', 'br', 'bl'] as const) {
                    let score = 0;
                    const nw = piece.lNotch.w, nh = piece.lNotch.h;
                    for (const rp of remaining) {
                        if ((rp.width <= nw && rp.height <= nh) ||
                            (rp.height <= nw && rp.width <= nh)) {
                            score += rp.width * rp.height;
                        }
                    }
                    if (remaining.find(rp => !!rp.lNotch) && c === 'tr') score += 100000;
                    if (score > bestScore) { bestScore = score; bestLCorner = c; }
                }
            }
        }

        if (!bestFit || bestSheetIdx < 0) {
            unplaced.push(piece);
            continue;
        }

        const sheet = openSheets[bestSheetIdx];
        const rect = sheet.freeRects[bestFit.index];
        const placedW = bestFit.rotated ? ph : pw;
        const placedH = bestFit.rotated ? pw : ph;

        // Guillotine split del bounding box
        const newFree = guillotineSplit(rect, placedW, placedH, gap);
        sheet.freeRects.splice(bestFit.index, 1, ...newFree);

        if (isCompound) {
            // === COMPOUND L-PAIR: espandi in 2 piazzamenti L incastrati ===
            const info = compounds.get(piece.id)!;

            if (!bestFit.rotated) {
                // L₁ con incavo TR (materiale: braccio sinistro + base in basso)
                sheet.placements.push({
                    piece: info.piece1,
                    x: rect.x, y: rect.y,
                    width: info.piece1.width, height: info.piece1.height,
                    rotated: false, isLShaped: true,
                    lNotch: { w: info.piece1.lNotch!.w, h: info.piece1.lNotch!.h, corner: 'tr' },
                });
                // L₂ con incavo BL (materiale: braccio destro + top)
                sheet.placements.push({
                    piece: info.piece2,
                    x: rect.x + info.solidW, y: rect.y,
                    width: info.piece2.width, height: info.piece2.height,
                    rotated: false, isLShaped: true,
                    lNotch: { w: info.piece2.lNotch!.w, h: info.piece2.lNotch!.h, corner: 'bl' },
                });
            } else {
                // Rotated compound: swap axes
                sheet.placements.push({
                    piece: info.piece1,
                    x: rect.x, y: rect.y,
                    width: info.piece1.height, height: info.piece1.width,
                    rotated: true, isLShaped: true,
                    lNotch: { w: info.piece1.lNotch!.h, h: info.piece1.lNotch!.w, corner: 'br' },
                });
                sheet.placements.push({
                    piece: info.piece2,
                    x: rect.x, y: rect.y + info.solidW,
                    width: info.piece2.height, height: info.piece2.width,
                    rotated: true, isLShaped: true,
                    lNotch: { w: info.piece2.lNotch!.h, h: info.piece2.lNotch!.w, corner: 'tl' },
                });
            }

            // Aggiungi il buco interno come spazio libero
            if (info.holeH > 0) {
                if (!bestFit.rotated) {
                    sheet.freeRects.push({
                        x: rect.x + info.solidW,
                        y: rect.y + info.solidH,
                        w: info.holeW,
                        h: info.holeH,
                        isNotch: true,
                    });
                } else {
                    sheet.freeRects.push({
                        x: rect.x + info.solidH,
                        y: rect.y + info.solidW,
                        w: info.holeH,
                        h: info.holeW,
                        isNotch: true,
                    });
                }
            }
        } else if (hasNotch && piece.lNotch) {
            // === L SINGOLA ===
            let notchInfo = { ...piece.lNotch };
            if (bestLCorner) {
                notchInfo = bestFit.rotated
                    ? { w: notchInfo.h, h: notchInfo.w, corner: bestLCorner }
                    : { ...notchInfo, corner: bestLCorner };
            } else if (bestFit.rotated) {
                const cm: Record<string, 'tr' | 'tl' | 'br' | 'bl'> = {
                    'tr': 'br', 'br': 'bl', 'bl': 'tl', 'tl': 'tr',
                };
                notchInfo = { w: notchInfo.h, h: notchInfo.w, corner: cm[notchInfo.corner] };
            }

            sheet.placements.push({
                piece, x: rect.x, y: rect.y,
                width: placedW, height: placedH,
                rotated: bestFit.rotated, isLShaped: true, lNotch: notchInfo,
            });

            // Notch come FreeRect
            let nx = rect.x, ny = rect.y;
            if (notchInfo.corner === 'tr') nx = rect.x + placedW - notchInfo.w;
            else if (notchInfo.corner === 'br') { nx = rect.x + placedW - notchInfo.w; ny = rect.y + placedH - notchInfo.h; }
            else if (notchInfo.corner === 'bl') ny = rect.y + placedH - notchInfo.h;

            if (notchInfo.w > gap && notchInfo.h > gap) {
                sheet.freeRects.push({ x: nx, y: ny, w: notchInfo.w, h: notchInfo.h, isNotch: true });
            }
        } else {
            // === PEZZO RETTANGOLARE NORMALE ===
            sheet.placements.push({
                piece, x: rect.x, y: rect.y,
                width: placedW, height: placedH,
                rotated: bestFit.rotated,
            });
        }

        sheet.freeRects = sheet.freeRects.filter(r => r.w > gap && r.h > gap);
    }

    // Costruisci risultato finale
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

    return { sheets, unplaced, totalSheets: sheets.length };
}
