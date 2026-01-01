import { format } from 'date-fns';
import type { DeliveryNote, DeliveryNoteItem } from '@/lib/types';

/**
 * Generates a PDF for a delivery note (DDT - Documento Di Trasporto)
 * @param movement - The delivery note data
 * @param groupedItems - The items to include in the PDF (already grouped)
 */
export async function generateDeliveryNotePDF(
    movement: DeliveryNote,
    groupedItems: DeliveryNoteItem[]
): Promise<void> {
    // Dynamic import of jsPDF to reduce initial bundle size (~248KB saved)
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width; // 210
    const pageHeight = doc.internal.pageSize.height; // 297
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    // --- Colors (Softer/Lighter) ---
    const grayBg = [245, 245, 245] as [number, number, number]; // Very light gray background
    const borderColor = [180, 180, 180] as [number, number, number]; // Softer border

    // --- Helper: Draw Box (Rounded) ---
    const drawBox = (x: number, y: number, w: number, h: number, fill: boolean = false) => {
        if (fill) doc.setFillColor(...grayBg);
        doc.setDrawColor(...borderColor);
        doc.roundedRect(x, y, w, h, 1, 1, fill ? 'FD' : 'S');
    };

    // --- Helper: Draw Header Box (Title) ---
    const drawHeaderBox = (x: number, y: number, w: number, h: number, title: string, fontSize = 8, bold = true) => {
        drawBox(x, y, w, h, true);
        doc.setTextColor(50); // Dark gray text, not black
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", bold ? "bold" : "normal");
        doc.text(title, x + 2, y + h - 2);
    };

    // --- Helper: Calculate Text Height ---
    const getTextHeight = (text: string, width: number, fontSize: number, fontStyle: string = "normal") => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", fontStyle);
        const lines = doc.splitTextToSize(text, width - 4);
        const lineHeight = fontSize * 0.3527 * 1.5; // mm approx with line spacing
        return Math.max(lines.length * lineHeight + 4, 8); // Min height 8mm
    };

    // --- 1. Logo & Company Info ---
    try {
        const logoUrl = '/logo_header.png'; // Updated logo
        const logoData = await fetch(logoUrl).then(res => res.blob()).then(blob => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        }));
        // Logo centered/large
        doc.addImage(logoData as string, 'PNG', 60, 5, 90, 25);
    } catch (e) {
        console.error("Could not load logo", e);
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("OPI Firesafe", pageWidth / 2, 20, { align: "center" });
    }

    // Company Details (Right aligned below logo)
    doc.setFontSize(7);
    doc.setTextColor(80); // Gray text
    doc.setFont("helvetica", "normal");
    const headerTextY = 35;
    doc.text("Via G. Galilei, 8 Fraz. Feletto Umberto 33010 TAVAGNACCO (UD)", pageWidth - margin, headerTextY, { align: "right" });
    doc.text("Tel. 0432-1901608 - email: amministrazione@opifiresafe.com", pageWidth - margin, headerTextY + 3, { align: "right" });
    doc.text("Cod. Fisc: 02357730304 - P.IVA e RI UD 02357730304 - Capitale Sociale € 250.000,00 i.v.", pageWidth - margin, headerTextY + 6, { align: "right" });

    // --- 2. Grid Layout (Dynamic) ---
    let currentY = 45;
    const col1W = 50;
    const col2W = contentWidth - col1W;

    // -- Row A: Headers --
    drawHeaderBox(margin, currentY, col1W, 6, "DOCUMENTO DI TRASPORTO", 7, true);
    drawHeaderBox(margin + col1W, currentY, col2W, 6, "CAUSALE DEL TRASPORTO:", 8, true);
    currentY += 6;

    // -- Row B: Sub-headers / Content --
    // Calculate max height for Row B
    const dprText = "D.D.T. - D.P.R. 472 del 14-08-1996 - D.P.R. 696 del 21-12-1996";
    const causalText = movement.causal || "Rifornimento cantiere";

    const rowBHeight = Math.max(
        getTextHeight(dprText, col1W, 5, "normal"),
        getTextHeight(causalText, col2W, 10, "bold")
    );

    // Col 1: Subtext
    drawBox(margin, currentY, col1W, rowBHeight);
    doc.setTextColor(0);
    doc.setFontSize(5);
    doc.setFont("helvetica", "normal");
    doc.text(dprText, margin + 2, currentY + 4, { maxWidth: col1W - 4 });

    // Col 2: Causale Content
    drawBox(margin + col1W, currentY, col2W, rowBHeight);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(causalText, margin + col1W + 2, currentY + 6);

    currentY += rowBHeight;

    // -- Row C: Number & Pickup --
    // Header strip for Pickup (from selected warehouse)
    drawHeaderBox(margin + col1W, currentY, col2W, 6, "LUOGO DI RITIRO MERCE:", 7, false);
    // Number box (spans header + content height of pickup) needs to wait for pickup content height
    const pickupY = currentY + 6;

    const pickupText = movement.pickupLocation || "OPI Firesafe S.r.l. MAGAZZINO: Via A. Malignani, 9 REANA DEL ROJALE (UD)";
    const pickupContentHeight = getTextHeight(pickupText, col2W, 9, "normal");
    const rowCHeight = 6 + pickupContentHeight; // Header + Content

    // Col 1: Number (Full height)
    drawBox(margin, currentY, col1W, rowCHeight);
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(movement.number, margin + col1W / 2, currentY + (rowCHeight / 2) + 2, { align: "center" });

    // Col 2: Pickup Content
    drawBox(margin + col1W, pickupY, col2W, pickupContentHeight);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(pickupText, margin + col1W + 2, pickupY + 5, { maxWidth: col2W - 4 });

    currentY += rowCHeight;

    // -- Row D: Date & Destination --
    drawHeaderBox(margin, currentY, col1W, 6, "DATA DI CARICO", 7, true);
    drawHeaderBox(margin + col1W, currentY, col2W, 6, "LUOGO DI DESTINAZIONE MERCE:", 7, false);
    currentY += 6;

    // -- Row E: Content --
    let destText = movement.deliveryLocation || "Sede cliente";

    const destHeight = getTextHeight(destText, col2W, 9, "normal");
    const rowEHeight = Math.max(12, destHeight); // Min 12mm

    // Col 1: Date Content
    drawBox(margin, currentY, col1W, rowEHeight);
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(format(new Date(movement.date), 'dd/MM/yyyy'), margin + col1W / 2, currentY + (rowEHeight / 2) + 2, { align: "center" });

    // Col 2: Dest Content
    drawBox(margin + col1W, currentY, col2W, rowEHeight);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(destText, margin + col1W + 2, currentY + 5, { maxWidth: col2W - 4 });

    currentY += rowEHeight + 5; // Gap before table

    // --- 3. Table (Harmonized) ---
    const tableBody = groupedItems.map(item => [
        item.inventoryCategory || "-",
        `${item.inventoryName || "Articolo"} ${item.inventoryDescription ? `- ${item.inventoryDescription}` : ""}`,
        item.inventoryUnit || "PZ",
        item.quantity.toString()
    ]);

    // Footer Height Calculation (Dynamic)
    const notesText = movement.notes || "";
    const notesHeight = movement.notes ? getTextHeight(notesText, contentWidth, 8) : 0;
    const footerBaseHeight = 13 + 13 + 20; // Transport + Aspect + Signatures
    const footerHeight = footerBaseHeight + (notesHeight > 0 ? notesHeight + 8 : 0) + 10; // + Header for notes + Padding

    autoTable(doc, {
        startY: currentY,
        head: [['Categoria', 'Prodotto', 'U.M.', 'Quantità']],
        body: tableBody,
        theme: 'plain', // Cleaner look
        styles: {
            fontSize: 9,
            cellPadding: 3,
            textColor: 50,
            lineColor: [230, 230, 230],
            lineWidth: 0.1,
        },
        headStyles: {
            fillColor: grayBg,
            textColor: 0,
            fontStyle: 'bold',
            lineColor: borderColor,
            lineWidth: 0.1
        },
        bodyStyles: {
            // Add bottom border to rows
            lineWidth: { bottom: 0.1 },
            lineColor: [230, 230, 230]
        },
        columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 20, halign: 'center' },
            3: { cellWidth: 20, halign: 'right' }
        },
        margin: { bottom: footerHeight + 10, left: margin, right: margin },
        tableWidth: 'auto',
        rowPageBreak: 'avoid',
    });

    // --- 4. Footer Drawing Function ---
    const drawFooter = (y: number) => {
        let fy = y;
        const footerRowHeight = 5;
        const footerContentHeight = 8;

        // Labels positions
        const col1X = margin + 2;
        const col2X = margin + 100;
        const col3X = margin + 150;

        // Row 1: Transport
        drawHeaderBox(margin, fy, contentWidth, footerRowHeight, "", 6, false);
        doc.setTextColor(100);
        doc.text("TRASPORTO A MEZZO", col1X, fy + 3.5);
        doc.text("DATA DI RITIRO", col2X, fy + 3.5);
        doc.text("ORA DEL RITIRO", col3X, fy + 3.5);
        fy += footerRowHeight;

        // Content Row 1
        drawBox(margin, fy, contentWidth, footerContentHeight);
        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.text("Mittente", col1X, fy + 5);
        doc.text(format(new Date(movement.date), 'dd/MM/yyyy'), col2X, fy + 5);
        doc.text("08:00:00", col3X, fy + 5);
        // Vertical dividers
        doc.setDrawColor(...borderColor);
        doc.line(margin + 98, fy, margin + 98, fy + footerContentHeight);
        doc.line(margin + 148, fy, margin + 148, fy + footerContentHeight);
        fy += footerContentHeight;

        // Row 2: Aspect
        drawHeaderBox(margin, fy, contentWidth, footerRowHeight, "", 6, false);
        doc.setTextColor(100);
        doc.text("ASPETTO ESTERIORE DEI BENI", col1X, fy + 3.5);
        doc.text("NUMERO DI COLLI", col3X, fy + 3.5);
        fy += footerRowHeight;

        // Content Row 2
        drawBox(margin, fy, contentWidth, footerContentHeight);
        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.text(movement.appearance || "A VISTA", col1X, fy + 5);
        doc.text((movement.packagesCount || 0).toString(), col3X + 30, fy + 5, { align: "right" });
        doc.line(margin + 148, fy, margin + 148, fy + footerContentHeight);
        fy += footerContentHeight;

        // Row 3: Notes (Dynamic)
        if (notesHeight > 0) {
            drawHeaderBox(margin, fy, contentWidth, footerRowHeight, "ANNOTAZIONI", 6, false);
            fy += footerRowHeight;

            drawBox(margin, fy, contentWidth, notesHeight);
            doc.setTextColor(0);
            doc.setFontSize(8);
            doc.text(notesText, col1X, fy + 5, { maxWidth: contentWidth - 4 });
            fy += notesHeight + 2;
        } else {
            fy += 2;
        }

        // Signatures (Side by Side)
        const sigW = contentWidth / 3;
        const sigH = 5;
        const sigBoxH = 15;

        const drawSigBlock = (x: number, title: string) => {
            // Header
            doc.setFillColor(...grayBg);
            doc.setDrawColor(...borderColor);
            doc.roundedRect(x, fy, sigW, sigH, 1, 1, 'FD');

            doc.setTextColor(100);
            doc.setFontSize(6);
            doc.text(title, x + 2, fy + 3.5);
            // Box
            doc.roundedRect(x, fy + sigH, sigW, sigBoxH, 1, 1, 'S');
        };

        drawSigBlock(margin, "FIRMA MITTENTE");
        drawSigBlock(margin + sigW, "FIRMA VETTORE");
        drawSigBlock(margin + sigW * 2, "FIRMA DESTINATARIO");

        // Page Numbering (bottom right)
        const pageCount = (doc.internal as any).getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(100);
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.text(`Pagina ${i} di ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: "right" });
        }
    };

    // --- Handle Pagination for Footer ---
    const finalY = (doc as any).lastAutoTable.finalY || currentY;
    const spaceNeeded = footerHeight + margin;

    // If not enough space on current page, add new page
    if (pageHeight - finalY < spaceNeeded) {
        doc.addPage();
    }

    // Draw footer at the bottom of the current (last) page
    drawFooter(pageHeight - footerHeight - margin);

    doc.save(`DDT_${movement.number.replace(/\//g, '-')}.pdf`);
}
