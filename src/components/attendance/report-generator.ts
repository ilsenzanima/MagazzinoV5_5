import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Worker, Attendance } from "@/lib/api";
import { format, eachDayOfInterval, isWeekend } from "date-fns";
import { it } from "date-fns/locale";
import { isItalianHoliday } from "@/lib/utils";

export const generateMonthlyReport = (
    currentDate: Date,
    workers: Worker[],
    attendanceList: Attendance[]
) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const monthName = format(currentDate, 'MMMM yyyy', { locale: it }).toUpperCase();
    const days = eachDayOfInterval({
        start: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
        end: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
    });

    workers.forEach((worker, index) => {
        if (index > 0) doc.addPage();

        // Filter worker attendance
        const workerAttendance = attendanceList.filter(a => a.workerId === worker.id);
        const jobMap = new Map<string, string>();
        const warehouseMap = new Map<string, string>();

        // Collect jobs and warehouses separately
        workerAttendance.forEach(a => {
            if (a.jobId && (a.status === 'presence' || a.status === 'transfer')) {
                // Use DESCRIPTION (name) instead of code
                const label = a.jobDescription || a.jobCode || 'N/D';
                jobMap.set(a.jobId, label);
            }
            if (a.warehouseId && (a.status === 'presence' || a.status === 'transfer')) {
                const label = a.warehouseName || 'Magazzino';
                warehouseMap.set(a.warehouseId, label);
            }
        });

        // Jobs first, then warehouses at the end
        const jobIds = Array.from(jobMap.keys());
        const warehouseIds = Array.from(warehouseMap.keys());
        const allIds = [...jobIds, ...warehouseIds];

        const columns = [
            'Data',
            'Giorno',
            ...jobIds.map(id => jobMap.get(id) || 'Commessa'),
            ...warehouseIds.map(id => warehouseMap.get(id) || 'Magazzino'),
            'Note/Assenze'
        ];

        // Track totals for each column
        const totals = new Array(allIds.length).fill(0);
        let totalAbsences = 0; // Track total absence hours

        const body = days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayAtts = workerAttendance.filter(a => a.date === dateKey);
            const isHoliday = isItalianHoliday(day);
            const hasWork = dayAtts.some(a => a.status === 'presence' || a.status === 'transfer');

            const rowStr: any[] = [
                format(day, 'dd/MM/yyyy'),
                format(day, 'EEE', { locale: it }).toUpperCase()
            ];

            // If Holiday and NO Work, fill "FESTIVO"
            if (isHoliday && !hasWork) {
                rowStr.push({
                    content: 'FESTIVO',
                    colSpan: allIds.length + 1,
                    styles: { halign: 'center', textColor: [200, 0, 0], fontStyle: 'bold' }
                });
                return rowStr;
            }

            // Job/Warehouse Columns
            allIds.forEach((id, colIndex) => {
                const att = dayAtts.find(a =>
                    (a.jobId === id || a.warehouseId === id) &&
                    (a.status === 'presence' || a.status === 'transfer')
                );
                if (att) {
                    // Add to totals (extract numeric value only)
                    totals[colIndex] += att.hours;

                    if (att.status === 'transfer') {
                        rowStr.push(`${att.hours} (Trasferta)`);
                    } else {
                        rowStr.push(`${att.hours}`);
                    }
                } else {
                    rowStr.push('');
                }
            });

            // Note/Assenze Column
            const absences = dayAtts.filter(a =>
                !['presence', 'transfer'].includes(a.status)
            );

            const absenceLabels = absences.map(a => {
                // Add to absence total
                totalAbsences += a.hours;

                let type = '';
                switch (a.status) {
                    case 'holiday': type = 'Ferie'; break;
                    case 'permit': type = 'Permesso'; break;
                    case 'sick': type = 'Malattia'; break;
                    case 'injury': type = 'Infortunio'; break;
                    case 'course': type = 'Corso'; break;
                    case 'strike': type = 'Sciopero'; break;
                    case 'absence': type = 'Ass. Ing.'; break;
                    case 'medical_exam': type = 'Visita Med.'; break;
                    default: type = a.status;
                }
                return `${a.hours} (${type})`;
            });

            rowStr.push(absenceLabels.join(', '));

            return rowStr;
        });

        // Calculate grand total (all work hours + absences)
        const grandTotal = totals.reduce((sum, t) => sum + t, 0) + totalAbsences;

        // Add totals row: TOTALE in Data, grand total in Giorno, individual totals, absence total in Note/Assenze
        const totalsRow = [
            'TOTALE',
            grandTotal.toString(),
            ...totals.map(t => t > 0 ? t.toString() : ''),
            totalAbsences > 0 ? totalAbsences.toString() : ''
        ];
        body.push(totalsRow);

        // Compact header: title and worker name on same line
        doc.setFontSize(11);
        doc.text(`Report Presenze - ${monthName}`, 14, 12);
        doc.setFontSize(10);
        doc.text(`Dipendente: ${worker.lastName} ${worker.firstName}`, 150, 12);

        autoTable(doc, {
            startY: 16,
            head: [columns],
            body: body,
            theme: 'grid',
            headStyles: {
                fillColor: [41, 128, 185],
                textColor: 255,
                fontSize: 7,
                cellPadding: 0.5
            },
            styles: {
                fontSize: 6.5,
                cellPadding: 0.8,
                minCellHeight: 4
            },
            columnStyles: {
                0: { cellWidth: 20 }, // Data
                1: { cellWidth: 11 }, // Giorno
                // Job/Warehouse columns
                ...Object.fromEntries(
                    Array.from({ length: allIds.length }, (_, i) => [i + 2, { cellWidth: 22 }])
                ),
                [columns.length - 1]: { cellWidth: 32 } // Note/Assenze
            },
            didParseCell: (data) => {
                // Totals row styling
                if (data.row.index === body.length - 1) {
                    data.cell.styles.fillColor = [220, 230, 241];
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fontSize = 7;

                    // Special highlight for grand total (Giorno column)
                    if (data.column.index === 1) {
                        data.cell.styles.fillColor = [255, 200, 100]; // Orange highlight
                        data.cell.styles.textColor = [0, 0, 0];
                    }
                    return;
                }

                // Only apply colors to body rows, not header
                if (data.section !== 'body') return;

                const rowIndex = data.row.index;
                if (rowIndex >= 0 && rowIndex < days.length) {
                    const day = days[rowIndex];
                    if (isItalianHoliday(day) || data.cell.raw === 'FESTIVO') {
                        data.cell.styles.fillColor = [255, 240, 240];
                    } else if (isWeekend(day)) {
                        data.cell.styles.fillColor = [240, 240, 240];
                    }
                }
            }
        });
    });

    doc.save(`report_presenze_${monthName.replace(' ', '_')}.pdf`);
};
