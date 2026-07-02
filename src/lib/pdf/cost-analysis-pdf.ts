import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { CostAnalysisRow, CostAnalysisParams } from '@/lib/services/cost-analysis';
import type { Client } from '@/lib/types';

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface CostAnalysisPdfInput {
    client: Client | null;
    proposalTitle: string;
    versionName: string;
    createdAt: string;
    inventoryRows: CostAnalysisRow[];
    genericRows: CostAnalysisRow[];
    params: CostAnalysisParams;
}

/**
 * Generates a PDF for a cost analysis (Analisi Costi) of a client proposal
 */
async function buildCostAnalysisPdfDoc(input: CostAnalysisPdfInput): Promise<{ doc: any; filename: string }> {
    // Dynamic import of jsPDF to reduce initial bundle size
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width; // 210
    const pageHeight = doc.internal.pageSize.height; // 297
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    // --- Colors (same palette used for delivery notes) ---
    const grayBg = [245, 245, 245] as [number, number, number];
    const borderColor = [180, 180, 180] as [number, number, number];

    const drawBox = (x: number, y: number, w: number, h: number, fill: boolean = false) => {
        if (fill) doc.setFillColor(...grayBg);
        doc.setDrawColor(...borderColor);
        doc.roundedRect(x, y, w, h, 1, 1, fill ? 'FD' : 'S');
    };

    const drawHeaderBox = (x: number, y: number, w: number, h: number, title: string, fontSize = 8, bold = true) => {
        drawBox(x, y, w, h, true);
        doc.setTextColor(50);
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.text(title, x + 2, y + h - 2);
    };

    // --- 1. Logo & Company Info (same as DDT) ---
    try {
        const logoUrl = '/logo_header.png';
        const logoData = await fetch(logoUrl).then(res => res.blob()).then(blob => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        }));
        doc.addImage(logoData as string, 'PNG', 60, 5, 90, 25);
    } catch (e) {
        console.error("Could not load logo", e);
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("OPI Firesafe", pageWidth / 2, 20, { align: "center" });
    }

    doc.setFontSize(7);
    doc.setTextColor(80);
    doc.setFont("helvetica", "normal");
    const headerTextY = 35;
    doc.text("Via G. Galilei, 8 Fraz. Feletto Umberto 33010 TAVAGNACCO (UD)", pageWidth - margin, headerTextY, { align: "right" });
    doc.text("Tel. 0432-1901608 - email: amministrazione@opifiresafe.com", pageWidth - margin, headerTextY + 3, { align: "right" });
    doc.text("Cod. Fisc: 02357730304 - P.IVA e RI UD 02357730304 - Capitale Sociale € 250.000,00 i.v.", pageWidth - margin, headerTextY + 6, { align: "right" });

    let currentY = 45;

    // --- 2. Title ---
    doc.setFontSize(14);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text("ANALISI COSTI", margin, currentY);
    currentY += 6;

    // --- 3. Committente + Dati offerta box ---
    const col1W = contentWidth / 2;
    const col2W = contentWidth - col1W;
    const boxH = 28;

    drawHeaderBox(margin, currentY, col1W, 6, "COMMITTENTE", 7, true);
    drawHeaderBox(margin + col1W, currentY, col2W, 6, "OFFERTA / ANALISI COSTI", 7, true);
    currentY += 6;

    drawBox(margin, currentY, col1W, boxH);
    drawBox(margin + col1W, currentY, col2W, boxH);

    // Col 1: Client data
    const c = input.client;
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(c?.name || "—", margin + 2, currentY + 5, { maxWidth: col1W - 4 });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let cy = currentY + 10;
    const addressLine = c ? [c.street, c.streetNumber].filter(Boolean).join(' ') : '';
    const cityLine = c ? [c.postalCode, c.city, c.province].filter(Boolean).join(' ') : '';
    if (addressLine) { doc.text(addressLine, margin + 2, cy); cy += 4; }
    if (cityLine) { doc.text(cityLine, margin + 2, cy); cy += 4; }
    if (c?.vatNumber) { doc.text(`P.IVA: ${c.vatNumber}`, margin + 2, cy); cy += 4; }
    if (c?.email) { doc.text(c.email, margin + 2, cy); cy += 4; }
    if (c?.phone) { doc.text(c.phone, margin + 2, cy); }

    // Col 2: Proposal / cost analysis data
    let ry = currentY + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Offerta:", margin + col1W + 2, ry);
    doc.setFont("helvetica", "normal");
    doc.text(input.proposalTitle || "—", margin + col1W + 20, ry, { maxWidth: col2W - 22 });
    ry += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Analisi costi:", margin + col1W + 2, ry);
    doc.setFont("helvetica", "normal");
    doc.text(input.versionName || "—", margin + col1W + 26, ry, { maxWidth: col2W - 28 });
    ry += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Data creazione:", margin + col1W + 2, ry);
    doc.setFont("helvetica", "normal");
    doc.text(input.createdAt ? format(new Date(input.createdAt), 'dd/MM/yyyy', { locale: it }) : "—", margin + col1W + 30, ry);
    ry += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Data stampa:", margin + col1W + 2, ry);
    doc.setFont("helvetica", "normal");
    doc.text(format(new Date(), 'dd/MM/yyyy', { locale: it }), margin + col1W + 27, ry);

    currentY += boxH + 6;

    // --- 4. Materiali da Magazzino ---
    const fmtCell = (n: number | null) => n !== null ? `€ ${fmt(n)}` : '—';
    const totMateriali = input.inventoryRows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0);

    if (input.inventoryRows.length > 0) {
        doc.setFontSize(10);
        doc.setTextColor(30);
        doc.setFont("helvetica", "bold");
        doc.text("Materiali da Magazzino", margin, currentY + 4);
        currentY += 7;

        autoTable(doc, {
            startY: currentY,
            head: [['Articolo', 'Prezzo max acq.', 'Prezzo unit.', 'Qtà presunta', 'Tot. presunto']],
            body: input.inventoryRows.map(r => [
                r.itemModel ? `${r.itemName} (${r.itemModel})` : r.itemName,
                r.maxPurchasePrice !== null ? `€ ${fmt(r.maxPurchasePrice)}` : 'N/D',
                fmtCell(r.unitPrice),
                fmt(r.qtyEstimated),
                r.unitPrice !== null ? `€ ${fmt(r.unitPrice * r.qtyEstimated)}` : '—',
            ]),
            foot: [['Totale materiali', '', '', '', `€ ${fmt(totMateriali)}`]],
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 2.5, textColor: 50, lineColor: [230, 230, 230], lineWidth: 0.1 },
            headStyles: { fillColor: grayBg, textColor: 0, fontStyle: 'bold', lineColor: borderColor, lineWidth: 0.1 },
            footStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', lineWidth: 0 },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 30, halign: 'right' },
                2: { cellWidth: 28, halign: 'right' },
                3: { cellWidth: 25, halign: 'right' },
                4: { cellWidth: 28, halign: 'right' },
            },
            margin: { left: margin, right: margin },
        });
        currentY = (doc as any).lastAutoTable.finalY + 6;
    }

    // --- 5. Voci Generiche ---
    const totGeneriche = input.genericRows.reduce((s, r) => s + (r.unitPrice ?? 0) * r.qtyEstimated, 0);

    if (input.genericRows.length > 0) {
        if (currentY > pageHeight - 40) { doc.addPage(); currentY = margin; }
        doc.setFontSize(10);
        doc.setTextColor(30);
        doc.setFont("helvetica", "bold");
        doc.text("Voci Generiche", margin, currentY + 4);
        currentY += 7;

        autoTable(doc, {
            startY: currentY,
            head: [['Voce', 'Prezzo unit.', 'Qtà presunta', 'Tot. presunto']],
            body: input.genericRows.map(r => [
                r.itemName,
                fmtCell(r.unitPrice),
                fmt(r.qtyEstimated),
                r.unitPrice !== null ? `€ ${fmt(r.unitPrice * r.qtyEstimated)}` : '—',
            ]),
            foot: [['Totale voci generiche', '', '', `€ ${fmt(totGeneriche)}`]],
            theme: 'plain',
            styles: { fontSize: 8, cellPadding: 2.5, textColor: 50, lineColor: [230, 230, 230], lineWidth: 0.1 },
            headStyles: { fillColor: grayBg, textColor: 0, fontStyle: 'bold', lineColor: borderColor, lineWidth: 0.1 },
            footStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', lineWidth: 0 },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 28, halign: 'right' },
                2: { cellWidth: 25, halign: 'right' },
                3: { cellWidth: 28, halign: 'right' },
            },
            margin: { left: margin, right: margin },
        });
        currentY = (doc as any).lastAutoTable.finalY + 6;
    }

    // --- 6. Riepilogo Prezzi ---
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

    if (currentY > pageHeight - 60) { doc.addPage(); currentY = margin; }
    doc.setFontSize(10);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text("Riepilogo Prezzi", margin, currentY + 4);
    currentY += 7;

    autoTable(doc, {
        startY: currentY,
        head: [['Voce', 'Incremento', 'Valore']],
        body: [
            ['Tot. materiali + voci', '', `€ ${fmt(totBase)}`],
            [`+ Sfrido (${params.sfrido}%)`, `+€ ${fmt(sfrido_delta)}`, `€ ${fmt(totListino)}`],
            [`- Sconto (${params.sconto}%)`, `-€ ${fmt(sconto_delta)}`, `€ ${fmt(totSconto)}`],
            [`+ Trasporto (A)`, `+€ ${fmt(params.trasporto)}`, `€ ${fmt(costoFranco)}`],
            [`+ Posa (B)`, `+€ ${fmt(params.posa)}`, `€ ${fmt(costoTot)}`],
            [`+ Ricarico (${params.ricarico}%)`, `+€ ${fmt(ric_delta)}`, `€ ${fmt(conRicarico)}`],
            [`+ Margine trattativa (${params.margineTrattativa}%)`, `+€ ${fmt(marg_delta)}`, `€ ${fmt(totaleFinale)}`],
        ],
        foot: [['TOTALE FINALE', '', `€ ${fmt(totaleFinale)}`]],
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2.5, textColor: 50, lineColor: [230, 230, 230], lineWidth: 0.1 },
        headStyles: { fillColor: grayBg, textColor: 0, fontStyle: 'bold', lineColor: borderColor, lineWidth: 0.1 },
        footStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold', lineWidth: 0 },
        columnStyles: {
            0: { cellWidth: 'auto' },
            1: { cellWidth: 35, halign: 'right' },
            2: { cellWidth: 35, halign: 'right' },
        },
        margin: { left: margin, right: margin },
    });

    // --- 7. Page numbering ---
    const pageCount = (doc.internal as any).getNumberOfPages();
    doc.setFontSize(8);
    doc.setTextColor(100);
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Pagina ${i} di ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: "right" });
    }

    // --- Filename ---
    const today = format(new Date(), 'yyyyMMdd');
    const slug = (s: string) => (s || '').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 30);
    const filename = `${slug(input.proposalTitle) || 'Offerta'}_${slug(input.versionName) || 'AnalisiCosti'}_${today}.pdf`;

    return { doc, filename };
}

/**
 * Generates a PDF for a cost analysis and triggers a download
 */
export async function generateCostAnalysisPDF(input: CostAnalysisPdfInput): Promise<void> {
    const { doc, filename } = await buildCostAnalysisPdfDoc(input);
    doc.save(filename);
}
