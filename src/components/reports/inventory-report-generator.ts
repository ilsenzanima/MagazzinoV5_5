import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InventoryCountData } from '@/lib/services/reports';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export const generateInventoryCountReport = (data: InventoryCountData) => {
    const doc = new jsPDF({ orientation: 'portrait' });
    const now = new Date();
    const dateStr = format(now, 'dd/MM/yyyy', { locale: it });

    // Header
    doc.setFontSize(16);
    doc.text('FOGLIO CONTA INVENTARIO', 14, 18);
    doc.setFontSize(10);
    doc.text(`Data: ${dateStr}`, 14, 26);
    doc.setFontSize(9);
    doc.text('Compilare la colonna "Contati" durante la verifica fisica.', 14, 33);

    const columns = [
        'Codice',
        'Articolo',
        'Lotto',
        'Sistema',
        'Contati',
        'Diff.'
    ];

    // Group items by type for organization
    let currentType = '';
    const body: any[][] = [];

    data.items.forEach(item => {
        // Add type header row when type changes
        if (item.itemType !== currentType) {
            currentType = item.itemType;
            body.push([
                { content: currentType.toUpperCase(), colSpan: 6, styles: { fillColor: [230, 230, 230], fontStyle: 'bold', fontSize: 8 } }
            ]);
        }

        body.push([
            item.itemCode,
            item.itemName.substring(0, 40),
            item.lotRef.substring(0, 15),
            item.systemPieces.toString(),
            '', // Empty cell for manual count
            ''  // Difference to be calculated manually
        ]);
    });

    autoTable(doc, {
        startY: 38,
        head: [columns],
        body: body,
        theme: 'grid',
        headStyles: {
            fillColor: [52, 73, 94],
            textColor: 255,
            fontSize: 8,
            cellPadding: 2
        },
        styles: {
            fontSize: 7,
            cellPadding: 2,
            minCellHeight: 8 // More space for writing
        },
        columnStyles: {
            0: { cellWidth: 28 }, // Codice
            1: { cellWidth: 60 }, // Articolo (bigger now)
            2: { cellWidth: 28 }, // Lotto (bigger now)
            3: { cellWidth: 22, halign: 'center' }, // Sistema
            4: { cellWidth: 26, halign: 'center' }, // Contati (bigger for writing)
            5: { cellWidth: 22, halign: 'center' }  // Differenza
        },
        didParseCell: (data) => {
            // Style empty cells for manual entry
            if (data.section === 'body' && (data.column.index === 4 || data.column.index === 5)) {
                data.cell.styles.fillColor = [255, 255, 240]; // Light yellow for entry cells
            }
        }
    });

    // Footer with signature line
    const finalY = (doc as any).lastAutoTable.finalY || 250;
    if (finalY < 260) {
        doc.setFontSize(9);
        doc.text('Rilevato da: _________________________', 14, finalY + 15);
        doc.text('Data conta: _________________________', 120, finalY + 15);
        doc.text('Firma: _________________________', 14, finalY + 25);
    }

    doc.save(`foglio_inventario_${format(now, 'yyyyMMdd')}.pdf`);
};
