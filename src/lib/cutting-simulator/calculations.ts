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
    /** Larghezza del pezzo in mm (bounding box) */
    width: number;
    /** Altezza del pezzo in mm (bounding box) */
    height: number;
    /** Quantità necessaria */
    quantity: number;
    /** Colore per la visualizzazione */
    color: string;
    /** Descrizione del calcolo per trasparenza */
    formula: string;
    /** Se presente, il pezzo è a forma di L con un angolo vuoto */
    lNotch?: {
        /** Larghezza dell'incavo (angolo tagliato) */
        w: number;
        /** Altezza dell'incavo */
        h: number;
        /** Posizione dell'incavo: top-right, top-left, bottom-right, bottom-left */
        corner: 'tr' | 'tl' | 'br' | 'bl';
    };
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
    /** Modalità base: 'split' = 2 pezzi separati, 'single' = 1 pezzo a L */
    baseMode: 'split' | 'single';
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
    const { innerWidth, innerHeight, thickness, armA, armB, extraMargin, baseMode } = input;

    const outerWidth = innerWidth + 2 * thickness;
    const outerHeight = innerHeight + 2 * thickness;

    // Fianchi esterni: 2 pezzi separati (uno per braccio).
    const extSideAWidth = innerHeight + extraMargin;
    const extSideAHeight = armA + outerWidth - thickness; // faccia esterna A meno sormonto di B

    const extSideBWidth = innerHeight + extraMargin;
    const extSideBHeight = armB + outerWidth;

    // Fianchi interni: 2 pezzi separati, si fermano allo spigolo
    const intSideAWidth = innerHeight + extraMargin;
    const intSideAHeight = armA;

    const intSideBWidth = innerHeight + extraMargin;
    const intSideBHeight = armB + thickness; // sormonto allo spigolo interno

    const pieces: CutPiece[] = [];

    if (baseMode === 'single') {
        // BASE UNICA: un pezzo a L sagomato per base e uno per coperchio.
        // Dal rettangolo di taglio (bounding box) si ricava la sagoma a L,
        // scartando l'angolo vuoto (armA × armB).
        // Bounding box: (outerWidth + armB) × (armA + outerWidth)
        // Sagoma a L effettiva = bounding box - angolo vuoto
        const baseLWidth = outerWidth + armB + extraMargin;
        const baseLHeight = armA + outerWidth;
        const wasteCorner = armA * armB; // angolo da scartare
        const actualArea = baseLWidth * baseLHeight - wasteCorner;
        pieces.push({
            id: 'base-l',
            label: 'Base/Coperchio a L (sagomata)',
            width: baseLWidth,
            height: baseLHeight,
            quantity: 2,
            color: PIECE_COLORS[0],
            formula: `Sagoma a L: rettangolo ${baseLWidth}×${baseLHeight} − angolo ${armA}×${armB} = ${(actualArea / 1_000_000).toFixed(3)} m² cad.`,
            lNotch: {
                w: armB,
                h: armA,
                corner: 'tr',
            },
        });
    } else {
        // BASE SEPARATA: 2 pezzi per braccio
        const baseAWidth = outerWidth + extraMargin;
        const baseAHeight = armA + outerWidth;
        const baseBWidth = outerWidth + extraMargin;
        const baseBHeight = armB;
        pieces.push(
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
        );
    }

    // Fianchi (sempre gli stessi indipendentemente dalla modalità base)
    pieces.push(
        {
            id: 'fianco-ext-a',
            label: 'Fianco Esterno - Braccio A',
            width: extSideAWidth,
            height: extSideAHeight,
            quantity: 1,
            color: PIECE_COLORS[1],
            formula: `${innerHeight}${extraMargin ? ` + ${extraMargin}` : ''} × (${armA} + ${outerWidth} − ${thickness}) = ${extSideAWidth} × ${extSideAHeight}`,
        },
        {
            id: 'fianco-ext-b',
            label: 'Fianco Esterno - Braccio B',
            width: extSideBWidth,
            height: extSideBHeight,
            quantity: 1,
            color: PIECE_COLORS[5],
            formula: `${innerHeight}${extraMargin ? ` + ${extraMargin}` : ''} × (${armB} + ${outerWidth}) = ${extSideBWidth} × ${extSideBHeight}`,
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
            formula: `${innerHeight}${extraMargin ? ` + ${extraMargin}` : ''} × (${armB} + ${thickness}) = ${intSideBWidth} × ${intSideBHeight}`,
        },
    );

    const modeLabel = baseMode === 'single' ? 'Base unica a L' : 'Base separata';

    const totalArea = pieces.reduce(
        (sum, p) => sum + p.width * p.height * p.quantity, 0
    );

    const summaryLines = [
        `Angolo 90° (${modeLabel}): sezione interna ${innerWidth}×${innerHeight} mm`,
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




/**
 * Filtra i pezzi in base a quali lati sono attivi.
 * Logica: base/coperchio corrispondono a top/bottom, fianchi a left/right.
 */
function filterBySides(pieces: CutPiece[], sides: DuctSides): CutPiece[] {
    return pieces.filter(p => {
        const id = p.id.toLowerCase();
        // Base/coperchio
        if (id.includes('base') || id.includes('coperchio')) {
            // Base = bottom, Coperchio = top. Nei pezzi qty=2 → base E coperchio.
            // Se qty=2 e un lato è disattivato, dimezziamo.
            if (!sides.top && !sides.bottom) return false;
            if (!sides.top || !sides.bottom) {
                return { ...p, quantity: 1 }; // ridotto dopo
            }
            return true;
        }
        if (id.includes('fianco') || id.includes('side')) {
            if (id.includes('int')) {
                // Fianchi interni → corrispondono ai lati left/right
                if (id.includes('-a') && !sides.left) return false;
                if (id.includes('-b') && !sides.right) return false;
                return true;
            }
            if (id.includes('ext')) {
                if (id.includes('-a') && !sides.left) return false;
                if (id.includes('-b') && !sides.right) return false;
                return true;
            }
            // Pezzo dritto generico (fianco standard dx/sx)
            if (!sides.left && !sides.right) return false;
            return true;
        }
        return true;
    }).map(p => {
        const id = p.id.toLowerCase();
        if ((id.includes('base') || id.includes('coperchio')) && p.quantity === 2) {
            if (!sides.top || !sides.bottom) {
                return { ...p, quantity: 1 };
            }
        }
        if ((id.includes('fianco') || id.includes('side')) && !id.includes('int') && !id.includes('ext') && p.quantity === 2) {
            if (!sides.left || !sides.right) {
                return { ...p, quantity: 1 };
            }
        }
        return p;
    });
}

/**
 * Calcola tutti i pezzi per un intero progetto di canalizzazione.
 * Itera sui segmenti, calcola i pezzi di ognuno, filtra per lati attivi
 * e rinomina con prefisso progressivo per evitare conflitti.
 */
export function calculateProject(project: DuctProject): CalculationResult {
    const { section, segments, globalMeasurements } = project;
    const allPieces: CutPiece[] = [];

    // ====== STEP 1: raggruppa per isola (trackSeparator) ======
    type IslandGroup = { separator: TrackSeparatorSegment | null; items: { seg: Segment; idx: number }[] };
    const islands: IslandGroup[] = [];
    let curIsland: IslandGroup | null = null;
    segments.forEach((seg, idx) => {
        if (seg.type === 'trackSeparator') {
            if (curIsland) islands.push(curIsland);
            curIsland = { separator: seg as TrackSeparatorSegment, items: [] };
        } else {
            if (!curIsland) curIsland = { separator: null, items: [] };
            curIsland.items.push({ seg, idx });
        }
    });
    if (curIsland) islands.push(curIsland);

    // ====== STEP 2: per ogni isola, dividi per sotto-tratti (le curve separano) ======
    for (const island of islands) {
        const effectiveThickness = island.separator?.thicknessOverride ?? section.thickness;

        // Divide gli items in sotto-tratti: ogni elbow90 separa
        type SubTrackItem = { seg: Segment; idx: number };
        type SubTrack = { straights: SubTrackItem[]; totalLength: number };
        const subTracks: SubTrack[] = [];
        const elbows: SubTrackItem[] = [];
        let curST: SubTrackItem[] = [];

        for (const item of island.items) {
            if (item.seg.type === 'elbow90') {
                // Chiudi sotto-tratto corrente
                const totalLen = curST.reduce((sum, it) => {
                    if (it.seg.type === 'straight') return sum + (it.seg as StraightSegment).length;
                    if (it.seg.type === 'obstacle') return sum + (it.seg as ContextualElementSegment).thickness;
                    return sum;
                }, 0);
                subTracks.push({ straights: curST, totalLength: totalLen });
                elbows.push(item);
                curST = [];
            } else if (item.seg.type === 'straight' || item.seg.type === 'obstacle') {
                curST.push(item);
            }
            // pendino: skip silenzioso
        }
        // Chiudi ultimo sotto-tratto
        if (curST.length > 0) {
            const totalLen = curST.reduce((sum, it) => {
                if (it.seg.type === 'straight') return sum + (it.seg as StraightSegment).length;
                if (it.seg.type === 'obstacle') return sum + (it.seg as ContextualElementSegment).thickness;
                return sum;
            }, 0);
            subTracks.push({ straights: curST, totalLength: totalLen });
        }

        // ====== STEP 3: genera pezzi per ogni sotto-tratto (un unico rettilineo) ======
        subTracks.forEach((st, stIdx) => {
            if (st.totalLength <= 0 || st.straights.length === 0) return;

            let actualLength = st.totalLength;
            let deductionText = '';

            // Deduzione ingombri curve adiacenti
            if (globalMeasurements) {
                const outerWidth = section.innerWidth + 2 * effectiveThickness;
                let deduction = 0;

                // Curva PRIMA di questo sotto-tratto = elbows[stIdx - 1]
                if (stIdx > 0 && elbows[stIdx - 1]) {
                    const prevElbow = elbows[stIdx - 1].seg as Elbow90Segment;
                    deduction += prevElbow.armB + outerWidth;
                }
                // Curva DOPO questo sotto-tratto = elbows[stIdx]
                if (stIdx < elbows.length && elbows[stIdx]) {
                    const nextElbow = elbows[stIdx].seg as Elbow90Segment;
                    deduction += nextElbow.armA + outerWidth;
                }

                if (deduction > 0) {
                    actualLength = Math.max(0, st.totalLength - deduction);
                    deductionText = ` (Tot: ${st.totalLength} − Ingombro: ${deduction} = ${actualLength})`;
                }
            }

            // Genera i pezzi per un unico tratto dritto unificato
            const result = calculateRectangularDuct({
                innerWidth: section.innerWidth,
                innerHeight: section.innerHeight,
                length: actualLength,
                thickness: effectiveThickness,
                extraMargin: section.extraMargin,
            });

            // Build label descrittiva
            const segLabels = st.straights.map(it => {
                if (it.seg.type === 'obstacle') {
                    const obs = it.seg as ContextualElementSegment;
                    const tl = obs.obstacleType === 'wall' ? 'Muro' : obs.obstacleType === 'floor' ? 'Solaio' : 'Ost.';
                    return `${tl} ${obs.thickness}`;
                }
                return `${(it.seg as StraightSegment).length}`;
            }).join('+');

            const prefix = st.straights.length === 1
                ? `S${st.straights[0].idx + 1}`
                : `T${stIdx + 1}`;

            const filtered = filterBySides(result.pieces, section.sides);
            filtered.forEach(p => {
                allPieces.push({
                    ...p,
                    id: `${prefix}-${p.id}`,
                    label: `[${prefix}] ${p.label} (${segLabels}=${st.totalLength}mm)${deductionText}`,
                });
            });
        });

        // ====== STEP 4: genera pezzi per le curve ======
        elbows.forEach((elItem) => {
            const elbowSeg = elItem.seg as Elbow90Segment;
            const result = calculateElbow90({
                innerWidth: section.innerWidth,
                innerHeight: section.innerHeight,
                thickness: effectiveThickness,
                armA: elbowSeg.armA,
                armB: elbowSeg.armB,
                extraMargin: section.extraMargin,
                baseMode: elbowSeg.baseMode,
            });

            const prefix = `S${elItem.idx + 1}`;
            const filtered = filterBySides(result.pieces, section.sides);
            filtered.forEach(p => {
                allPieces.push({
                    ...p,
                    id: `${prefix}-${p.id}`,
                    label: `[${prefix}] ${p.label}`,
                });
            });
        });
    }

    // Fasce Giunti: 4 fasce per ogni giunto tra due segmenti non-separator consecutivi
    if (project.jointBands) {
        const bandW = project.jointBandWidth || 100; // larghezza fascia in mm
        const outerW = section.innerWidth + 2 * section.thickness;
        const outerH = section.innerHeight + 2 * section.thickness;
        // Fasce corte = dimensione esterne, fasce lunghe = esterne + 2×spessore per chiudere l'angolo
        const shortSideW = outerW;   // es. 300mm
        const shortSideH = outerH;   // es. 300mm
        const longSideW = outerW + 2 * section.thickness;  // es. 400mm
        const longSideH = outerH + 2 * section.thickness;  // es. 400mm

        let jointCount = 0;
        const nonSepSegs = segments.filter(s => s.type !== 'trackSeparator');
        for (let i = 0; i < nonSepSegs.length - 1; i++) {
            const curr = nonSepSegs[i];
            const next = nonSepSegs[i + 1];
            // Un giunto tra due tratti dritti (o dritto↔curva, o dritto↔ostacolo)
            if (curr.type === 'straight' || curr.type === 'obstacle') {
                if (next.type === 'straight' || next.type === 'obstacle' || next.type === 'elbow90') {
                    jointCount++;
                }
            }
        }

        if (jointCount > 0) {
            // 2 fasce orizzontali (base/coperchio) = larghezza esterna × bandW
            allPieces.push({
                id: `fascia-oriz`,
                label: `[F] Fascia Giunto Orizz. (${shortSideW}×${bandW})`,
                width: shortSideW,
                height: bandW,
                quantity: jointCount * 2,
                color: '#14b8a6', // teal
                formula: `${shortSideW} × ${bandW} — ${jointCount} giunti × 2`,
            });
            // 2 fasce verticali (fianchi) = (altezza esterna + 2×spessore) × bandW
            allPieces.push({
                id: `fascia-vert`,
                label: `[F] Fascia Giunto Vert. (${longSideH}×${bandW})`,
                width: longSideH,
                height: bandW,
                quantity: jointCount * 2,
                color: '#0d9488', // darker teal
                formula: `${longSideH} × ${bandW} — ${jointCount} giunti × 2`,
            });
        }
    }

    // Aggiunta tappo frontale se previsto
    if (section.cap === 'inner') {
        allPieces.unshift({
            id: 'tappo-interno',
            label: '[+] Tappo (Interno)',
            width: section.innerWidth,
            height: section.innerHeight,
            quantity: 1,
            color: '#94a3b8',
            formula: `${section.innerWidth} × ${section.innerHeight}`,
        });
    } else if (section.cap === 'outer') {
        const outW = section.innerWidth + 2 * section.thickness;
        const outH = section.innerHeight + 2 * section.thickness;
        allPieces.unshift({
            id: 'tappo-esterno',
            label: '[+] Tappo (Esterno)',
            width: outW,
            height: outH,
            quantity: 1,
            color: '#475569',
            formula: `${outW} × ${outH}`,
        });
    }

    // Riepilogo generale del progetto
    const totalArea = allPieces.reduce(
        (sum, p) => sum + p.width * p.height * p.quantity, 0
    );

    const outerWidth = section.innerWidth + 2 * section.thickness;
    const outerHeight = section.innerHeight + 2 * section.thickness;

    const pendiniCount = segments.filter(s => s.type === 'pendino').length;

    const summaryLines = [
        `Progetto: ${project.name}`,
        `Sezione: ${section.innerWidth}×${section.innerHeight} mm (esterna ${outerWidth}×${outerHeight})`,
        `Segmenti: ${segments.length} — Pezzi totali: ${allPieces.reduce((s, p) => s + p.quantity, 0)}`,
        `Superficie totale: ${(totalArea / 1_000_000).toFixed(3)} m²`,
        ...(pendiniCount > 0 ? [`Pendini: ${pendiniCount}`] : []),
    ];

    return {
        pieces: allPieces,
        totalArea,
        summary: summaryLines.join('\n'),
        outerWidth,
        outerHeight,
    };
}
