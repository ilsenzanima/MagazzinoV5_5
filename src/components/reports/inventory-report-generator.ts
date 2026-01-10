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
        'U.M.',
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
                { content: currentType.toUpperCase(), colSpan: 7, styles: { fillColor: [230, 230, 230], fontStyle: 'bold', fontSize: 8 } }
            ]);
        }

        body.push([
            item.itemCode,
            item.itemName.substring(0, 35),
            item.lotRef.substring(0, 12),
            item.itemUnit,
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
            0: { cellWidth: 25 }, // Codice
            1: { cellWidth: 55 }, // Articolo
            2: { cellWidth: 25 }, // Lotto
            3: { cellWidth: 15, halign: 'center' }, // U.M.
            4: { cellWidth: 20, halign: 'center' }, // Sistema
            5: { cellWidth: 25, halign: 'center' }, // Contati (bigger for writing)
            6: { cellWidth: 20, halign: 'center' }  // Differenza
        },
        didParseCell: (data) => {
            // Style empty cells for manual entry
            if (data.section === 'body' && (data.column.index === 5 || data.column.index === 6)) {
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
