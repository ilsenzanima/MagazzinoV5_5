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
    // Draw box around header (Logo + Title)
    // Logo is at margin + 5, Title ends around logoY + 35. 
    const headerHeight = 35;
    const headerY = margin;
    doc.rect(margin, headerY, contentWidth, headerHeight);

    // --- 2. Logo ---
    let logoY = headerY + 2; // Inside the box
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
    // Center title horizontally
    doc.text(title, (pageWidth / 2) - (titleWidth / 2), headerY + headerHeight - 10);

    // --- 4. Worker Name Line ---
    let currentY = headerY + headerHeight + 15;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Il sottoscritto", margin + 5, currentY);

    // Worker name
    const workerName = `${request.worker?.first_name || ''} ${request.worker?.last_name || ''}`.trim();
    doc.setFont("helvetica", "bold");
    doc.text(workerName, margin + 35, currentY);

    // Underline from name start to end of page equivalent (margin)
    doc.setLineWidth(0.5);
    doc.line(margin + 35, currentY + 1.5, pageWidth - margin - 5, currentY + 1.5);

    // --- 5. Request Text ---
    currentY += 15;
    doc.setFont("helvetica", "normal");
    doc.text("chiede di poter usufruire di ferie/permessi per i seguenti giorni:", margin + 5, currentY);

    // --- 6. Table Layout ---
    currentY += 10;

    // Top line of table
    doc.setLineWidth(0.3);
    doc.line(margin + 5, currentY, pageWidth - margin - 5, currentY);

    // Headers
    currentY += 5;
    const totalTableWidth = pageWidth - (margin * 2) - 10;
    const colW = totalTableWidth / 5;

    const headers = ["Data", "Firma del\nrichiedente", "Firma Responsabile\ndel Servizio", "Firma\nProject Manager", "Autorizzazione\nDirettore Operativo"];

    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");

    let colX = margin + 5;
    // Store Y positions to find max height of header row if needed, but fixed spacing is safer
    headers.forEach((header, i) => {
        const lines = header.split('\n');
        lines.forEach((line, lineIdx) => {
            doc.text(line, colX + colW / 2, currentY + (lineIdx * 4), { align: "center" });
        });
        colX += colW;
    });

    currentY += 10;
    // Bottom line of header row
    doc.line(margin + 5, currentY, pageWidth - margin - 5, currentY);

    // --- 7. Date Rows ---
    currentY += 8; // Start slightly lower
    const startDate = new Date(request.date);
    const endDate = new Date(request.end_date);
    const daysDiff = differenceInDays(endDate, startDate);
    const maxRows = Math.min(daysDiff + 1, 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    for (let i = 0; i < maxRows; i++) {
        const rowDate = addDays(startDate, i);
        const dateStr = format(rowDate, 'dd/MM/yyyy', { locale: it });

        colX = margin + 5;

        // Date
        doc.text(dateStr, colX + colW / 2, currentY, { align: "center" });

        // Underlines for signatures (Cols 2-5)
        for (let j = 1; j < 5; j++) {
            const lineStart = margin + 5 + (j * colW) + 2;
            const lineEnd = margin + 5 + ((j + 1) * colW) - 2;
            doc.line(lineStart, currentY + 1, lineEnd, currentY + 1);
        }

        currentY += 12; // Row spacing
    }

    // --- 8. Nota Bene ---
    currentY += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Nota bene:", margin + 5, currentY);

    // Underline "Nota bene:"
    const nbWidth = doc.getTextWidth("Nota bene:");
    doc.setLineWidth(0.5);
    doc.line(margin + 5, currentY + 1, margin + 5 + nbWidth, currentY + 1);

    currentY += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(black); // Forced black

    // Helper to draw text and underline specific parts
    const drawText = (text: string, x: number, y: number, underline: boolean = false) => {
        doc.text(text, x, y);
        if (underline) {
            const w = doc.getTextWidth(text);
            doc.setLineWidth(0.2);
            doc.line(x, y + 1.0, x + w, y + 1.0); // Closer underline
        }
        return doc.getTextWidth(text);
    };

    // First paragraph
    // "La domanda di ferie/permesso deve essere presentata al proprio responsabile almeno 3 giorni lavorativi prima della data"
    // "di fruizione. È compito del dipendente accertarsi, prima dell'assenza, che la richiesta sia stata correttamente autorizzata"
    // "(firmata dal DG)."
    // All of this IS underlined in the original image.

    const p1_line1 = "La domanda di ferie/permesso deve essere presentata al proprio responsabile almeno 3 giorni lavorativi prima della data";
    const p1_line2 = "di fruizione. È compito del dipendente accertarsi, prima dell'assenza, che la richiesta sia stata correttamente autorizzata";
    const p1_line3 = "(firmata dal DG).";

    drawText(p1_line1, margin + 5, currentY, true);
    drawText(p1_line2, margin + 5, currentY + 4, true);
    drawText(p1_line3, margin + 5, currentY + 8, true);

    // Second paragraph
    // "La semplice consegna di tale documento, senza quanto sopra descritto, non presuppone l'avvenuta approvazione della"
    // "richiesta."
    // Also underlined in original? Looking closely at crop 4... 
    // The second paragraph starts with "La semplice consegna..."
    // In the first image, it HAS a line under it. Yes.

    const p2_line1 = "La semplice consegna di tale documento, senza quanto sopra descritto, non presuppone l'avvenuta approvazione della";
    const p2_line2 = "richiesta.";

    drawText(p2_line1, margin + 5, currentY + 12, true);
    drawText(p2_line2, margin + 5, currentY + 16, true);

    // --- 9. Dashed Footer ---
    currentY += 25;

    // Dash pattern manually
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
