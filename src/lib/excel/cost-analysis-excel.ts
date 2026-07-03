import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { CostAnalysisPdfInput } from '@/lib/pdf/cost-analysis-pdf';
import { effectiveUnitPrice } from '@/lib/services/cost-analysis';

const EUR_FMT = '"€ "#,##0.00';
const NUM_FMT = '#,##0.00';

// Larghezze colonne (in "wch", circa caratteri visibili) usate per stimare l'a capo automatico
const COL_WCH = [38, 18, 16, 16, 16];
const MERGED_B_E_WCH = COL_WCH.slice(1).reduce((s, w) => s + w, 0);
const MERGED_A_C_WCH = COL_WCH.slice(0, 3).reduce((s, w) => s + w, 0);
const LINE_PT = 13;
const BASE_ROW_PT = 16;

const estimateLines = (text: string, wch: number) => Math.max(1, Math.ceil(text.length / wch));
const rowHeightForLines = (lines: number) => Math.max(BASE_ROW_PT, lines * LINE_PT + 5);

type XlsxStyle = Record<string, unknown>;
type Cell = { v: string | number; t: 's' | 'n'; s: XlsxStyle };

const cell = (v: string | number, s: XlsxStyle = {}): Cell => ({ v, t: typeof v === 'number' ? 'n' : 's', s });

const bannerCell = (v: string) => cell(v, {
    fill: { patternType: 'solid', fgColor: { rgb: 'FF1E3A5F' } },
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
});
const addressCell = (v: string) => cell(v, {
    font: { sz: 8, color: { rgb: 'FF666666' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
});
const titleCell = (v: string) => cell(v, {
    font: { bold: true, sz: 13, color: { rgb: 'FF1E1E1E' } },
    alignment: { vertical: 'center' },
});
const sectionHdrCell = (v: string) => cell(v, {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFF5F5F5' } },
    font: { bold: true, sz: 9, color: { rgb: 'FF333333' } },
    alignment: { vertical: 'center' },
});
const labelCell = (v: string) => cell(v, { font: { sz: 9, color: { rgb: 'FF444444' } }, alignment: { vertical: 'center' } });
const wrapValueCell = (v: string) => cell(v, { font: { sz: 9 }, alignment: { vertical: 'center', wrapText: true } });
const tableHdrCell = (v: string) => cell(v, {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFF5F5F5' } },
    font: { bold: true, sz: 9, color: { rgb: 'FF000000' } },
    alignment: { vertical: 'center', wrapText: true },
});
const dataCell = (v: string, alignRight = false) => cell(v, { font: { sz: 9 }, alignment: { horizontal: alignRight ? 'right' : undefined, vertical: 'center', wrapText: true } });
const numDataCell = (v: number, currency = true) => cell(v, { font: { sz: 9 }, numFmt: currency ? EUR_FMT : NUM_FMT, alignment: { horizontal: 'right', vertical: 'center' } });
const totalCell = (v: string | number, currency = false) => cell(v, {
    fill: { patternType: 'solid', fgColor: { rgb: 'FF1E3A5F' } },
    font: { bold: true, color: { rgb: 'FFFFFFFF' } },
    numFmt: currency ? EUR_FMT : undefined,
    alignment: { horizontal: currency ? 'right' : undefined, vertical: 'center' },
});
const grandTotalCell = (v: string | number, currency = false) => cell(v, {
    fill: { patternType: 'solid', fgColor: { rgb: 'FF1D4ED8' } },
    font: { bold: true, color: { rgb: 'FFFFFFFF' } },
    numFmt: currency ? EUR_FMT : undefined,
    alignment: { horizontal: currency ? 'right' : undefined, vertical: 'center' },
});
const blank = () => cell('');

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Genera un Excel per l'analisi costi di un'offerta, con lo stesso layout
 * (intestazione azienda, dati committente/offerta, tabelle) del PDF equivalente.
 */
export async function generateCostAnalysisExcel(input: CostAnalysisPdfInput): Promise<void> {
    const xlsxModule = await import('xlsx-js-style');
    // xlsx-js-style is CJS-only: some ESM interop paths land the exports under `.default`.
    const XLSX = 'utils' in xlsxModule ? xlsxModule : (xlsxModule as unknown as { default: typeof xlsxModule }).default;

    const COLS = 5;
    const pad = (row: Cell[]) => { while (row.length < COLS) row.push(blank()); return row; };
    const aoa: Cell[][] = [];
    const rowHeights: number[] = [];
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];

    const pushRow = (row: Cell[], lines = 1) => {
        aoa.push(pad(row));
        rowHeights.push(rowHeightForLines(lines));
        return aoa.length - 1;
    };
    const mergeRange = (r: number, c1: number, c2: number) => merges.push({ s: { r, c: c1 }, e: { r, c: c2 } });
    const mergeFullRow = (r: number) => mergeRange(r, 0, COLS - 1);

    // --- 1. Intestazione azienda (banner al posto del logo) ---
    mergeFullRow(pushRow([bannerCell('OPI FIRESAFE')], 1));
    const addressText = 'Via G. Galilei, 8 Fraz. Feletto Umberto 33010 TAVAGNACCO (UD)  ·  Tel. 0432-1901608  ·  amministrazione@opifiresafe.com  ·  P.IVA 02357730304';
    mergeFullRow(pushRow([addressCell(addressText)], estimateLines(addressText, COL_WCH.reduce((s, w) => s + w, 0))));
    pushRow([]);

    // --- 2. Titolo ---
    pushRow([titleCell('ANALISI COSTI')]);
    pushRow([]);

    // --- 3. Committente ---
    mergeFullRow(pushRow([sectionHdrCell('COMMITTENTE')]));
    const c = input.client;
    const addressLine = c ? [c.street, c.streetNumber].filter(Boolean).join(' ') : '';
    const cityLine = c ? [c.postalCode, c.city, c.province].filter(Boolean).join(' ') : '';
    const committenteLines: [string, string][] = [
        ['Nome', c?.name || '—'],
        ...(addressLine ? [['Indirizzo', addressLine] as [string, string]] : []),
        ...(cityLine ? [['Città', cityLine] as [string, string]] : []),
        ...(c?.vatNumber ? [['P.IVA', c.vatNumber] as [string, string]] : []),
        ...(c?.email ? [['Email', c.email] as [string, string]] : []),
        ...(c?.phone ? [['Telefono', c.phone] as [string, string]] : []),
    ];
    for (const [label, value] of committenteLines) {
        mergeRange(pushRow([labelCell(label), wrapValueCell(value)], estimateLines(value, MERGED_B_E_WCH)), 1, COLS - 1);
    }
    pushRow([]);

    // --- 4. Offerta / Analisi costi ---
    mergeFullRow(pushRow([sectionHdrCell('OFFERTA / ANALISI COSTI')]));
    const offertaLines: [string, string][] = [
        ['Offerta', input.proposalTitle || '—'],
        ['Analisi costi', input.versionName || '—'],
        ['Data creazione', input.createdAt ? format(new Date(input.createdAt), 'dd/MM/yyyy', { locale: it }) : '—'],
        ['Data stampa', format(new Date(), 'dd/MM/yyyy', { locale: it })],
    ];
    for (const [label, value] of offertaLines) {
        mergeRange(pushRow([labelCell(label), wrapValueCell(value)], estimateLines(value, MERGED_B_E_WCH)), 1, COLS - 1);
    }
    pushRow([]);

    // --- 5. Materiali da Magazzino ---
    // Colonne: Articolo | Prezzo max acq. | Prezzo unit. | Qtà presunta | Tot. presunto
    const totMateriali = input.inventoryRows.reduce((s, r) => s + (effectiveUnitPrice(r) ?? 0) * r.qtyEstimated, 0);
    if (input.inventoryRows.length > 0) {
        pushRow([titleCell('Materiali da Magazzino')]);
        pushRow(['Articolo', 'Prezzo max acq.', 'Prezzo unit.', 'Qtà presunta', 'Tot. presunto'].map(tableHdrCell));
        for (const r of input.inventoryRows) {
            const label = r.itemModel ? `${r.itemName} (${r.itemModel})` : r.itemName;
            const price = effectiveUnitPrice(r);
            const totEst = (price ?? 0) * r.qtyEstimated;
            pushRow([
                dataCell(label),
                r.maxPurchasePrice !== null ? numDataCell(r.maxPurchasePrice) : dataCell('N/D', true),
                r.unitPrice !== null ? numDataCell(r.unitPrice) : dataCell('—', true),
                numDataCell(r.qtyEstimated, false),
                price !== null ? numDataCell(totEst) : dataCell('—', true),
            ], estimateLines(label, COL_WCH[0]));
        }
        pushRow([totalCell('Totale materiali'), totalCell(''), totalCell(''), totalCell(''), totalCell(totMateriali, true)]);
        pushRow([]);
    }

    // --- 6. Voci Generiche ---
    // Stesse colonne di "Materiali" (con "Prezzo max acq." vuota) cosi' "Tot. presunto" resta allineato in colonna E
    const totGeneriche = input.genericRows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0);
    if (input.genericRows.length > 0) {
        pushRow([titleCell('Voci Generiche')]);
        pushRow(['Voce', '', 'Prezzo unit.', 'Qtà presunta', 'Tot. presunto'].map(tableHdrCell));
        for (const r of input.genericRows) {
            const totEst = (r.unitPrice ?? 0) * r.qtyEstimated;
            pushRow([
                dataCell(r.itemName),
                blank(),
                r.unitPrice !== null ? numDataCell(r.unitPrice) : dataCell('—', true),
                numDataCell(r.qtyEstimated, false),
                r.unitPrice !== null ? numDataCell(totEst) : dataCell('—', true),
            ], estimateLines(r.itemName, COL_WCH[0]));
        }
        pushRow([totalCell('Totale voci generiche'), totalCell(''), totalCell(''), totalCell(''), totalCell(totGeneriche, true)]);
        pushRow([]);
    }

    // --- 7. Riepilogo Prezzi ---
    // "Valore" (equivalente del "Tot. presunto" delle tabelle sopra) resta allineato in colonna E
    const { params } = input;
    const totBase = totMateriali + totGeneriche;
    const sfrido_delta = totBase * params.sfrido / 100;
    const totListino = totBase + sfrido_delta;
    const sconto_delta = totListino * params.sconto / 100;
    const totSconto = totListino - sconto_delta;
    const costoFranco = totSconto + params.trasporto;
    const costoTot = costoFranco + params.posa;
    const ric_delta = costoTot * params.ricarico / 100;
    const conRicarico = costoTot + ric_delta;
    const marg_delta = conRicarico * params.margineTrattativa / 100;
    const totaleFinale = conRicarico + marg_delta;

    pushRow([titleCell('Riepilogo Prezzi')]);
    mergeRange(pushRow([tableHdrCell('Voce'), tableHdrCell(''), tableHdrCell(''), tableHdrCell('Incremento'), tableHdrCell('Valore')]), 0, 2);
    const summaryRows: [string, string, number][] = [
        ['Tot. materiali + voci', '', totBase],
        [`+ Sfrido (${params.sfrido}%)`, `+€ ${fmt(sfrido_delta)}`, totListino],
        [`- Sconto (${params.sconto}%)`, `-€ ${fmt(sconto_delta)}`, totSconto],
        ['+ Trasporto (A)', `+€ ${fmt(params.trasporto)}`, costoFranco],
        ['+ Posa (B)', `+€ ${fmt(params.posa)}`, costoTot],
        [`+ Ricarico (${params.ricarico}%)`, `+€ ${fmt(ric_delta)}`, conRicarico],
        [`+ Margine trattativa (${params.margineTrattativa}%)`, `+€ ${fmt(marg_delta)}`, totaleFinale],
    ];
    for (const [label, incremento, valore] of summaryRows) {
        mergeRange(pushRow([dataCell(label), blank(), blank(), dataCell(incremento, true), numDataCell(valore)], estimateLines(label, MERGED_A_C_WCH)), 0, 2);
    }
    pushRow([grandTotalCell('TOTALE FINALE'), grandTotalCell(''), grandTotalCell(''), grandTotalCell(''), grandTotalCell(totaleFinale, true)]);

    // --- Sheet setup ---
    const ws: Record<string, unknown> = {
        '!ref': '',
        '!merges': merges,
        '!cols': COL_WCH.map(wch => ({ wch })),
        '!rows': rowHeights.map(hpt => ({ hpt })),
    };
    for (let r = 0; r < aoa.length; r++) {
        for (let c2 = 0; c2 < aoa[r].length; c2++) {
            const addr = XLSX.utils.encode_cell({ r, c: c2 });
            ws[addr] = aoa[r][c2];
        }
    }
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: COLS - 1 } });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Analisi Costi');

    const today = format(new Date(), 'yyyyMMdd');
    const slug = (s: string) => (s || '').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 30);
    const filename = `${slug(input.proposalTitle) || 'Offerta'}_${slug(input.versionName) || 'AnalisiCosti'}_${today}.xlsx`;

    XLSX.writeFile(wb, filename);
}
