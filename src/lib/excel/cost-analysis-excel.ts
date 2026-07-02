import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { CostAnalysisPdfInput } from '@/lib/pdf/cost-analysis-pdf';

const EUR_FMT = '"€ "#,##0.00';
const NUM_FMT = '#,##0.00';

type XlsxStyle = Record<string, unknown>;
type Cell = { v: string | number; t: 's' | 'n'; s: XlsxStyle };

const cell = (v: string | number, s: XlsxStyle = {}): Cell => ({ v, t: typeof v === 'number' ? 'n' : 's', s });

const bannerCell = (v: string) => cell(v, {
    fill: { patternType: 'solid', fgColor: { rgb: 'FF1E3A5F' } },
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'center' },
});
const addressCell = (v: string) => cell(v, {
    font: { sz: 8, color: { rgb: 'FF666666' } },
    alignment: { horizontal: 'center' },
});
const titleCell = (v: string) => cell(v, {
    font: { bold: true, sz: 13, color: { rgb: 'FF1E1E1E' } },
});
const sectionHdrCell = (v: string) => cell(v, {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFF5F5F5' } },
    font: { bold: true, sz: 9, color: { rgb: 'FF333333' } },
});
const labelCell = (v: string) => cell(v, { font: { sz: 9, color: { rgb: 'FF444444' } } });
const tableHdrCell = (v: string) => cell(v, {
    fill: { patternType: 'solid', fgColor: { rgb: 'FFF5F5F5' } },
    font: { bold: true, sz: 9, color: { rgb: 'FF000000' } },
});
const dataCell = (v: string, alignRight = false) => cell(v, { font: { sz: 9 }, alignment: alignRight ? { horizontal: 'right' } : undefined });
const numDataCell = (v: number, currency = true) => cell(v, { font: { sz: 9 }, numFmt: currency ? EUR_FMT : NUM_FMT, alignment: { horizontal: 'right' } });
const totalCell = (v: string | number, currency = false) => cell(v, {
    fill: { patternType: 'solid', fgColor: { rgb: 'FF1E3A5F' } },
    font: { bold: true, color: { rgb: 'FFFFFFFF' } },
    numFmt: currency ? EUR_FMT : undefined,
    alignment: currency ? { horizontal: 'right' } : undefined,
});
const grandTotalCell = (v: string | number, currency = false) => cell(v, {
    fill: { patternType: 'solid', fgColor: { rgb: 'FF1D4ED8' } },
    font: { bold: true, color: { rgb: 'FFFFFFFF' } },
    numFmt: currency ? EUR_FMT : undefined,
    alignment: currency ? { horizontal: 'right' } : undefined,
});

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
    const pad = (row: Cell[]) => { while (row.length < COLS) row.push(cell('')); return row; };
    const aoa: Cell[][] = [];
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = [];
    const mergeRow = (r: number) => merges.push({ s: { r, c: 0 }, e: { r, c: COLS - 1 } });

    // --- 1. Intestazione azienda (banner al posto del logo) ---
    aoa.push(pad([bannerCell('OPI FIRESAFE')]));
    mergeRow(0);
    aoa.push(pad([addressCell('Via G. Galilei, 8 Fraz. Feletto Umberto 33010 TAVAGNACCO (UD)  ·  Tel. 0432-1901608  ·  amministrazione@opifiresafe.com  ·  P.IVA 02357730304')]));
    mergeRow(1);
    aoa.push(pad([]));

    // --- 2. Titolo ---
    aoa.push(pad([titleCell('ANALISI COSTI')]));
    aoa.push(pad([]));

    // --- 3. Committente ---
    aoa.push(pad([sectionHdrCell('COMMITTENTE')]));
    mergeRow(aoa.length - 1);
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
    for (const [label, value] of committenteLines) aoa.push(pad([labelCell(label), dataCell(value)]));
    aoa.push(pad([]));

    // --- 4. Offerta / Analisi costi ---
    aoa.push(pad([sectionHdrCell('OFFERTA / ANALISI COSTI')]));
    mergeRow(aoa.length - 1);
    const offertaLines: [string, string][] = [
        ['Offerta', input.proposalTitle || '—'],
        ['Analisi costi', input.versionName || '—'],
        ['Data creazione', input.createdAt ? format(new Date(input.createdAt), 'dd/MM/yyyy', { locale: it }) : '—'],
        ['Data stampa', format(new Date(), 'dd/MM/yyyy', { locale: it })],
    ];
    for (const [label, value] of offertaLines) aoa.push(pad([labelCell(label), dataCell(value)]));
    aoa.push(pad([]));

    // --- 5. Materiali da Magazzino ---
    const totMateriali = input.inventoryRows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0);
    if (input.inventoryRows.length > 0) {
        aoa.push(pad([titleCell('Materiali da Magazzino')]));
        aoa.push(pad(['Articolo', 'Prezzo max acq.', 'Prezzo unit.', 'Qtà presunta', 'Tot. presunto'].map(tableHdrCell)));
        for (const r of input.inventoryRows) {
            const label = r.itemModel ? `${r.itemName} (${r.itemModel})` : r.itemName;
            const totEst = (r.unitPrice ?? 0) * r.qtyEstimated;
            aoa.push(pad([
                dataCell(label),
                r.maxPurchasePrice !== null ? numDataCell(r.maxPurchasePrice) : dataCell('N/D', true),
                r.unitPrice !== null ? numDataCell(r.unitPrice) : dataCell('—', true),
                numDataCell(r.qtyEstimated, false),
                r.unitPrice !== null ? numDataCell(totEst) : dataCell('—', true),
            ]));
        }
        aoa.push(pad([totalCell('Totale materiali'), totalCell(''), totalCell(''), totalCell(''), totalCell(totMateriali, true)]));
        aoa.push(pad([]));
    }

    // --- 6. Voci Generiche ---
    const totGeneriche = input.genericRows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0);
    if (input.genericRows.length > 0) {
        aoa.push(pad([titleCell('Voci Generiche')]));
        aoa.push(pad(['Voce', 'Prezzo unit.', 'Qtà presunta', 'Tot. presunto'].map(tableHdrCell)));
        for (const r of input.genericRows) {
            const totEst = (r.unitPrice ?? 0) * r.qtyEstimated;
            aoa.push(pad([
                dataCell(r.itemName),
                r.unitPrice !== null ? numDataCell(r.unitPrice) : dataCell('—', true),
                numDataCell(r.qtyEstimated, false),
                r.unitPrice !== null ? numDataCell(totEst) : dataCell('—', true),
            ]));
        }
        aoa.push(pad([totalCell('Totale voci generiche'), totalCell(''), totalCell(''), totalCell(totGeneriche, true)]));
        aoa.push(pad([]));
    }

    // --- 7. Riepilogo Prezzi ---
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

    aoa.push(pad([titleCell('Riepilogo Prezzi')]));
    aoa.push(pad(['Voce', 'Incremento', 'Valore'].map(tableHdrCell)));
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
        aoa.push(pad([dataCell(label), dataCell(incremento, true), numDataCell(valore)]));
    }
    aoa.push(pad([grandTotalCell('TOTALE FINALE'), grandTotalCell(''), grandTotalCell(totaleFinale, true)]));

    // --- Sheet setup ---
    const ws: Record<string, unknown> = { '!ref': '', '!merges': merges, '!cols': [{ wch: 38 }, { wch: 18 }, { wch: 16 }, { wch: 16 }, { wch: 16 }] };
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
