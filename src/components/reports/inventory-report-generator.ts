import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InventoryCountData } from '@/lib/services/reports';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

// Scarica l'immagine dell'articolo e la converte in data URL da incorporare nel PDF.
// Se il download fallisce (rete, CORS, immagine mancante) la miniatura viene semplicemente omessa.
async function fetchImageAsDataUrl(url: string): Promise<{ dataUrl: string; format: 'PNG' | 'JPEG' | 'WEBP' } | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const format = blob.type === 'image/png' ? 'PNG' : blob.type === 'image/webp' ? 'WEBP' : 'JPEG';
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        return { dataUrl, format };
    } catch {
        return null;
    }
}

export const generateInventoryCountReport = async (data: InventoryCountData) => {
    const doc = new jsPDF({ orientation: 'portrait' });
    const now = new Date();
    const dateStr = format(now, 'dd/MM/yyyy', { locale: it });

    // Precarica le miniature di tutti gli articoli con foto prima di costruire la tabella,
    // perché il disegno delle celle nella tabella deve essere sincrono.
    const imageMap = new Map<string, { dataUrl: string; format: 'PNG' | 'JPEG' | 'WEBP' }>();
    const itemsWithImage = data.items.filter(item => item.itemImage);
    const loadedImages = await Promise.all(
        itemsWithImage.map(item => fetchImageAsDataUrl(item.itemImage!))
    );
    itemsWithImage.forEach((item, i) => {
        const loaded = loadedImages[i];
        if (loaded) imageMap.set(item.itemId, loaded);
    });

    // Header
    doc.setFontSize(16);
    doc.text('FOGLIO CONTA INVENTARIO', 14, 18);
    doc.setFontSize(10);
    doc.text(`Data: ${dateStr}`, 14, 26);
    doc.setFontSize(9);
    doc.text('Annotare le differenze riscontrate durante la verifica fisica.', 14, 33);

    const columns = [
        'Codice',
        'Foto',
        'Articolo',
        'Sistema',
        'Diff.'
    ];

    // Group items by type for organization, tracking which row belongs to which item
    // (needed later to look up the right thumbnail when drawing the Foto column).
    let currentType = '';
    const body: any[][] = [];
    const rowItemIds: (string | null)[] = [];

    data.items.forEach(item => {
        // Add type header row when type changes
        if (item.itemType !== currentType) {
            currentType = item.itemType;
            body.push([
                { content: currentType.toUpperCase(), colSpan: 5, styles: { fillColor: [230, 230, 230], fontStyle: 'bold', fontSize: 8 } }
            ]);
            rowItemIds.push(null);
        }

        body.push([
            item.itemCode,
            '', // Foto: disegnata manualmente in didDrawCell
            (item.itemName + (item.itemModel ? ` (${item.itemModel})` : '')).substring(0, 55),
            item.systemPieces.toString(),
            '' // Differenza da calcolare manualmente
        ]);
        rowItemIds.push(item.itemId);
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
            minCellHeight: 14 // Spazio sufficiente per la miniatura
        },
        columnStyles: {
            0: { cellWidth: 22 }, // Codice
            1: { cellWidth: 16, halign: 'center', valign: 'middle' }, // Foto
            2: { cellWidth: 90 }, // Articolo
            3: { cellWidth: 22, halign: 'center' }, // Sistema
            4: { cellWidth: 24, halign: 'center' }  // Differenza
        },
        didParseCell: (data) => {
            // Style empty cell for manual entry
            if (data.section === 'body' && data.column.index === 4) {
                data.cell.styles.fillColor = [255, 255, 240]; // Light yellow for entry cell
            }
        },
        didDrawCell: (cellData) => {
            if (cellData.section !== 'body' || cellData.column.index !== 1) return;
            const itemId = rowItemIds[cellData.row.index];
            if (!itemId) return;
            const image = imageMap.get(itemId);
            if (!image) return;

            const size = Math.min(cellData.cell.height, cellData.cell.width) - 3;
            const x = cellData.cell.x + (cellData.cell.width - size) / 2;
            const y = cellData.cell.y + (cellData.cell.height - size) / 2;
            try {
                doc.addImage(image.dataUrl, image.format, x, y, size, size);
            } catch {
                // Immagine corrotta o formato non supportato: si omette la miniatura
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
