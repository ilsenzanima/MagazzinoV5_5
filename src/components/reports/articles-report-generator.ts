import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ArticleLot, ArticlesReportData } from '@/lib/services/reports';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export const generateArticlesReport = (data: ArticlesReportData) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const now = new Date();
    const dateStr = format(now, 'dd/MM/yyyy HH:mm', { locale: it });

    // Header
    doc.setFontSize(14);
    doc.text('REPORT ARTICOLI MAGAZZINO', 14, 15);
    doc.setFontSize(9);
    doc.text(`Generato il: ${dateStr}`, 14, 22);
    doc.text(`Articoli con giacenza > 0`, 14, 27);

    const columns = [
        'Codice',
        'Articolo',
        'Marca',
        'Lotto',
        'Data Lotto',
        'Prezzo €',
        'Pezzi',
        'Quantità',
        'U.M.',
        'Valore €'
    ];

    // Group articles by type
    const groupedArticles: Record<string, ArticleLot[]> = {};
    data.articles.forEach(article => {
        const type = article.itemType || 'Senza Categoria';
        if (!groupedArticles[type]) {
            groupedArticles[type] = [];
        }
        groupedArticles[type].push(article);
    });

    // Sort types alphabetically
    const sortedTypes = Object.keys(groupedArticles).sort((a, b) => a.localeCompare(b));

    // Build body with type headers
    const body: any[][] = [];
    const typeRowIndices: number[] = []; // Track which rows are type headers
    const articleRowMap: Map<number, ArticleLot> = new Map(); // Map row index to article

    sortedTypes.forEach(type => {
        // Add type header row
        typeRowIndices.push(body.length);
        body.push([
            { content: type.toUpperCase(), colSpan: 10, styles: { fillColor: [180, 180, 180], fontStyle: 'bold', fontSize: 7 } }
        ]);

        // Add articles for this type
        groupedArticles[type].forEach(article => {
            const rowIndex = body.length;
            articleRowMap.set(rowIndex, article);
            body.push([
                article.itemCode,
                (article.itemName + (article.itemModel ? ` (${article.itemModel})` : '')).substring(0, 35),
                article.itemBrand,
                article.lotRef.substring(0, 15),
                article.lotDate ? format(new Date(article.lotDate), 'dd/MM/yy') : '-',
                article.price > 0 ? article.price.toFixed(2) : '-',
                article.pieces.toString(),
                article.quantity.toFixed(2),
                article.itemUnit,
                article.totalValue > 0 ? article.totalValue.toFixed(2) : '-'
            ]);
        });
    });

    // Add totals row
    const totalPieces = data.articles.reduce((sum, a) => sum + a.pieces, 0);
    const totalQuantity = data.articles.reduce((sum, a) => sum + a.quantity, 0);
    const totalsRowIndex = body.length;

    body.push([
        'TOTALE',
        '',
        '',
        '',
        '',
        '',
        totalPieces.toString(),
        totalQuantity.toFixed(2),
        '',
        data.totalValue.toFixed(2)
    ]);

    autoTable(doc, {
        startY: 32,
        head: [columns],
        body: body,
        theme: 'grid',
        headStyles: {
            fillColor: [41, 128, 185],
            textColor: 255,
            fontSize: 7,
            cellPadding: 1
        },
        styles: {
            fontSize: 6.5,
            cellPadding: 1,
            minCellHeight: 5
        },
        columnStyles: {
            0: { cellWidth: 22 }, // Codice
            1: { cellWidth: 45 }, // Articolo
            2: { cellWidth: 25 }, // Marca
            3: { cellWidth: 28 }, // Lotto
            4: { cellWidth: 18 }, // Data Lotto
            5: { cellWidth: 18, halign: 'right' }, // Prezzo
            6: { cellWidth: 15, halign: 'right' }, // Pezzi
            7: { cellWidth: 20, halign: 'right' }, // Quantità
            8: { cellWidth: 12, halign: 'center' }, // U.M.
            9: { cellWidth: 22, halign: 'right' }  // Valore
        },
        didParseCell: (cellData) => {
            // Totals row styling
            if (cellData.row.index === totalsRowIndex) {
                cellData.cell.styles.fillColor = [220, 230, 241];
                cellData.cell.styles.fontStyle = 'bold';
                cellData.cell.styles.fontSize = 7;
            }
            // Skip type header rows (they have their own styling)
            else if (typeRowIndices.includes(cellData.row.index)) {
                // Type headers already styled via content object
            }
            // Highlight rows with missing price (price = 0)
            else if (cellData.section === 'body') {
                const article = articleRowMap.get(cellData.row.index);
                if (article && article.price <= 0) {
                    cellData.cell.styles.fillColor = [255, 235, 235]; // Light red/pink
                }
            }
        }
    });

    // Footer with total value highlighted
    const finalY = (doc as any).lastAutoTable.finalY || 200;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`VALORE TOTALE MAGAZZINO: € ${data.totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 14, finalY + 10);

    doc.save(`report_articoli_${format(now, 'yyyyMMdd_HHmm')}.pdf`);
};
