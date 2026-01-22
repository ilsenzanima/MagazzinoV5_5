import { format, addDays, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import type { LeaveRequest } from '@/lib/services/leave-requests';

/**
 * Generates a PDF for a leave request (Richiesta Ferie/Permessi)
 */
export async function generateLeaveRequestPDF(request: LeaveRequest): Promise<void> {
    const { default: jsPDF } = await import('jspdf');

    // Default A4
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    // --- Colors ---
    const black = 0;
    const borderColor = [0, 0, 0] as [number, number, number];

    // --- 1. Header Box ---
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.4);
    const headerHeight = 35;
    const headerY = margin;
    doc.rect(margin, headerY, contentWidth, headerHeight);

    // --- 2. Logo ---
    let logoY = headerY + 2;
    try {
        const logoUrl = '/logo_header.png';
        const logoData = await fetch(logoUrl).then(res => res.blob()).then(blob => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        }));
        // Align logo to right inside the box
        doc.addImage(logoData as string, 'PNG', pageWidth - margin - 60, logoY, 55, 18);
    } catch (e) {
        console.error("Could not load logo", e);
    }

    // --- 3. Title ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(black);
    const title = "RICHIESTA FERIE/PERMESSI";
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth / 2) - (titleWidth / 2), headerY + headerHeight - 10);

    // --- 4. Worker Name Line ---
    let currentY = headerY + headerHeight + 15;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Il sottoscritto", margin + 5, currentY);

    // Worker name
    const workerName = `${request.worker?.first_name || ''} ${request.worker?.last_name || ''}`.trim();
    doc.setFont("helvetica", "bold");
    // Indent name more to right as per example
    const nameX = margin + 35;
    doc.text(workerName, nameX, currentY);

    // Underline name
    doc.setLineWidth(0.5);
    doc.line(nameX, currentY + 1.5, pageWidth - margin - 5, currentY + 1.5);

    // --- 5. Request Text ---
    currentY += 15;
    doc.setFont("helvetica", "normal");
    doc.text("chiede di poter usufruire di ferie/permessi per i seguenti giorni:", margin + 5, currentY);

    // --- 6. Requested Days List ---
    // In example: "23 Gennaio 2026" is listed below lightly indented
    currentY += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    const startDate = new Date(request.date);
    const endDate = new Date(request.end_date);
    const daysDiff = differenceInDays(endDate, startDate);

    // Generate text like "23 Gennaio 2026" or range
    let daysText = "";
    if (daysDiff === 0) {
        daysText = format(startDate, 'd MMMM yyyy', { locale: it });
        // Capitalize month
        daysText = daysText.replace(/(\s[a-z])/, (match) => match.toUpperCase());
    } else {
        const startStr = format(startDate, 'd MMMM yyyy', { locale: it });
        const endStr = format(endDate, 'd MMMM yyyy', { locale: it });
        daysText = `Dal ${startStr} al ${endStr}`;
    }

    doc.text(daysText, margin + 10, currentY);

    // Underline and separator
    currentY += 5;
    doc.setLineWidth(0.3);
    doc.line(margin + 5, currentY, pageWidth - margin - 5, currentY);

    // --- 7. Signature Table ---
    currentY += 10;

    // Adjust total table width
    const totalTableWidth = pageWidth - (margin * 2) - 10;
    const colW = totalTableWidth / 5;

    const headers = ["Data", "Firma del\nrichiedente", "Firma Responsabile\ndel Servizio", "Firma\nProject Manager", "Autorizzazione\nDirettore Operativo"];

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");

    let colX = margin + 5;
    headers.forEach((header, i) => {
        const lines = header.split('\n');
        lines.forEach((line, lineIdx) => {
            doc.text(line, colX + colW / 2, currentY + (lineIdx * 4), { align: "center" });
        });
        colX += colW;
    });

    // --- 8. Signature Row (Single Row) ---
    // The example shows a SINGLE row for signatures, with the Date being the REQUEST DATE (e.g. today/created_at)
    currentY += 15;

    // Date of Request (created_at)
    const requestDate = new Date(request.created_at);
    const requestDateStr = format(requestDate, 'dd/MM/yyyy');

    colX = margin + 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    // Col 1: Request Date
    doc.text(requestDateStr, colX + colW / 2, currentY, { align: "center" });
    // Underline Date
    doc.line(colX + 2, currentY + 1, colX + colW - 2, currentY + 1);

    // Cols 2-5: Empty Lines for Signatures
    for (let j = 1; j < 5; j++) {
        const lineStart = margin + 5 + (j * colW) + 2;
        const lineEnd = margin + 5 + ((j + 1) * colW) - 2;
        doc.line(lineStart, currentY + 1, lineEnd, currentY + 1);
    }

    // --- 9. Nota Bene ---
    currentY += 30; // More space before Nota Bene
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Nota bene:", margin + 5, currentY);

    const nbWidth = doc.getTextWidth("Nota bene:");
    doc.setLineWidth(0.5);
    doc.line(margin + 5, currentY + 1, margin + 5 + nbWidth, currentY + 1);

    currentY += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(black);

    const drawText = (text: string, x: number, y: number, underline: boolean = false) => {
        doc.text(text, x, y);
        if (underline) {
            const w = doc.getTextWidth(text);
            doc.setLineWidth(0.2);
            doc.line(x, y + 1.0, x + w, y + 1.0);
        }
        return doc.getTextWidth(text);
    };

    const p1_line1 = "La domanda di ferie/permesso deve essere presentata al proprio responsabile almeno 3 giorni lavorativi prima della data";
    const p1_line2 = "di fruizione. È compito del dipendente accertarsi, prima dell'assenza, che la richiesta sia stata correttamente autorizzata";
    const p1_line3 = "(firmata dal DG).";

    drawText(p1_line1, margin + 5, currentY, true);
    drawText(p1_line2, margin + 5, currentY + 4, true);
    drawText(p1_line3, margin + 5, currentY + 8, true);

    const p2_line1 = "La semplice consegna di tale documento, senza quanto sopra descritto, non presuppone l'avvenuta approvazione della";
    const p2_line2 = "richiesta.";

    drawText(p2_line1, margin + 5, currentY + 12, true);
    drawText(p2_line2, margin + 5, currentY + 16, true);

    // --- 10. Dashed Footer ---
    currentY += 30;

    // Dash pattern
    doc.setLineWidth(0.3);
    const dashLen = 3;
    const spaceLen = 3;
    let x = margin + 10;
    while (x < pageWidth - margin - 10) {
        doc.line(x, currentY, x + dashLen, currentY);
        x += dashLen + spaceLen;
    }

    currentY += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.text("Autorizzazione DG", pageWidth - margin - 30, currentY, { align: "right" });

    currentY += 10;
    doc.setLineWidth(0.3);
    doc.line(pageWidth - margin - 60, currentY, pageWidth - margin - 10, currentY);

    // Save
    const workerNameSafe = workerName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const dateFormatted = format(startDate, 'yyyyMMdd');
    const filename = `richiesta_permesso_${workerNameSafe}_${dateFormatted}.pdf`;
    doc.save(filename);
}
