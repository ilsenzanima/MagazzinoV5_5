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

        // Collect all worked jobs (presence or transfer)
        workerAttendance.forEach(a => {
            if (a.jobId && (a.status === 'presence' || a.status === 'transfer')) {
                const label = a.jobCode || a.jobDescription || 'N/D';
                jobMap.set(a.jobId, label);
            }
        });

        const jobIds = Array.from(jobMap.keys());
        // Use job descriptions (names) for column headers
        const columns = ['Data', 'Giorno', ...jobIds.map(id => jobMap.get(id) || 'Commessa'), 'Note/Assenze'];

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
                    colSpan: jobIds.length + 1,
                    styles: { halign: 'center', textColor: [200, 0, 0], fontStyle: 'bold' }
                });
                return rowStr;
            }

            // Job Columns
            jobIds.forEach(jid => {
                const att = dayAtts.find(a => a.jobId === jid && (a.status === 'presence' || a.status === 'transfer'));
                if (att) {
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
                let type = '';
                switch (a.status) {
                    case 'holiday': type = 'Ferie'; break;
                    case 'permit': type = 'Permesso'; break;
                    case 'sick': type = 'Malattia'; break;
                    case 'injury': type = 'Infortunio'; break;
                    case 'course': type = 'Corso'; break;
                    case 'strike': type = 'Sciopero'; break;
                    case 'absence': type = 'Ass. Ing.'; break;
                    default: type = a.status;
                }
                return `${a.hours} (${type})`;
            });

            rowStr.push(absenceLabels.join(', '));

            return rowStr;
        });

        doc.setFontSize(16);
        doc.text(`Report Presenze - ${monthName}`, 14, 15);
        doc.setFontSize(12);
        doc.text(`Dipendente: ${worker.lastName} ${worker.firstName}`, 14, 22);

        autoTable(doc, {
            startY: 25,
            head: [columns],
            body: body,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 8, cellPadding: 1 },
            columnStyles: {
                0: { cellWidth: 22 }, // Data - fixed width
                1: { cellWidth: 12 }, // Giorno - fixed width
                [columns.length - 1]: { cellWidth: 35 } // Note/Assenze - fixed width
            },
            didParseCell: (data) => {
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
