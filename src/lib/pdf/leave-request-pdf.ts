import { format, addDays, differenceInDays } from 'date-fns';
import { it } from 'date-fns/locale';
import type { LeaveRequest } from '@/lib/services/leave-requests';

/**
 * Generates a PDF for a leave request (Richiesta Ferie/Permessi)
 */
export async function generateLeaveRequestPDF(request: LeaveRequest): Promise<void> {
    const { default: jsPDF } = await import('jspdf');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2);

    // Colors
    const borderColor = [0, 0, 0] as [number, number, number];

    // --- 1. Border ---
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.5);
    doc.rect(margin, margin, contentWidth, 250);

    // --- 2. Logo ---
    let logoY = margin + 5;
    try {
        const logoUrl = '/logo_header.png';
        const logoData = await fetch(logoUrl).then(res => res.blob()).then(blob => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        }));
        doc.addImage(logoData as string, 'PNG', pageWidth - margin - 60, logoY, 55, 18);
    } catch (e) {
        console.error("Could not load logo", e);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("OPI Firesafe", pageWidth - margin - 30, logoY + 10, { align: "center" });
    }

    // --- 3. Title ---
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text("RICHIESTA FERIE/PERMESSI", margin + 10, logoY + 25);

    // --- 4. Worker Name Line ---
    let currentY = logoY + 45;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Il sottoscritto", margin + 10, currentY);

    // Worker name with underline
    const workerName = `${request.worker?.first_name || ''} ${request.worker?.last_name || ''}`.trim();
    doc.setFont("helvetica", "bold");
    doc.text(workerName, margin + 45, currentY);
    doc.setLineWidth(0.3);
    doc.line(margin + 45, currentY + 2, pageWidth - margin - 10, currentY + 2);

    // --- 5. Request Text ---
    currentY += 15;
    doc.setFont("helvetica", "normal");
    doc.text("chiede di poter usufruire di ferie/permessi per i seguenti giorni:", margin + 10, currentY);

    // --- 6. Table Header ---
    currentY += 15;
    const colWidths = [35, 35, 35, 35, 35];
    const headers = ["Data", "Firma del\nrichiedente", "Firma Responsabile\ndel Servizio", "Firma\nProject Manager", "Autorizzazione\nDirettore Operativo"];

    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");

    let colX = margin + 10;
    headers.forEach((header, i) => {
        const lines = header.split('\n');
        lines.forEach((line, lineIdx) => {
            doc.text(line, colX + colWidths[i] / 2, currentY + (lineIdx * 4), { align: "center" });
        });
        colX += colWidths[i];
    });

    // --- 7. Date Rows ---
    currentY += 12;
    const startDate = new Date(request.date);
    const endDate = new Date(request.end_date);
    const daysDiff = differenceInDays(endDate, startDate);
    const maxRows = Math.min(daysDiff + 1, 10); // Limit to 10 rows

    doc.setLineWidth(0.3);

    for (let i = 0; i < maxRows; i++) {
        const rowDate = addDays(startDate, i);
        const dateStr = format(rowDate, 'dd/MM/yyyy', { locale: it });

        colX = margin + 10;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(dateStr, colX + colWidths[0] / 2, currentY + 5, { align: "center" });

        // Draw signature lines for each column
        for (let j = 0; j < 5; j++) {
            doc.line(colX + 3, currentY + 8, colX + colWidths[j] - 3, currentY + 8);
            colX += colWidths[j];
        }
        currentY += 12;
    }

    // --- 8. Nota Bene Section ---
    currentY += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Nota bene:", margin + 10, currentY);
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.line(margin + 10, currentY + 1, margin + 35, currentY + 1);

    currentY += 8;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 0, 0); // Red text

    const notaText = [
        "La domanda di ferie/permesso deve essere presentata al proprio responsabile almeno 3 giorni lavorativi prima della data",
        "di fruizione. È compito del dipendente accertarsi, prima dell'assenza, che la richiesta sia stata correttamente autorizzata",
        "(firmata dal DG).",
        "La semplice consegna di tale documento, senza quanto sopra descritto, non presuppone l'avvenuta approvazione della",
        "richiesta."
    ];

    notaText.forEach((line, i) => {
        if (i < 3) {
            doc.line(margin + 10, currentY + 1 + (i * 4), margin + 10 + doc.getTextWidth(line.replace(/\.$/, '')), currentY + 1 + (i * 4));
        }
        doc.text(line, margin + 10, currentY + (i * 4));
    });

    // --- 9. Footer Section ---
    currentY += 35;
    doc.setTextColor(0);
    doc.setLineWidth(0.3);

    // Dashed line
    for (let x = margin + 10; x < pageWidth - margin - 10; x += 8) {
        doc.line(x, currentY, x + 4, currentY);
    }

    currentY += 15;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Autorizzazione DG", pageWidth - margin - 45, currentY, { align: "right" });

    currentY += 15;
    doc.line(pageWidth - margin - 60, currentY, pageWidth - margin - 10, currentY);

    // --- Save PDF ---
    const workerNameSafe = workerName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
    const dateFormatted = format(startDate, 'yyyyMMdd');
    const filename = `richiesta_permesso_${workerNameSafe}_${dateFormatted}.pdf`;
    doc.save(filename);
}
