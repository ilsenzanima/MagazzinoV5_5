import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Worker, Attendance } from "@/lib/api";
import { format, eachDayOfInterval, isWeekend, getDay } from "date-fns";
import { it } from "date-fns/locale";

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

        // 1. Gather all jobs worked by this worker this month to define columns
        const workerAttendance = attendanceList.filter(a => a.workerId === worker.id);
        const jobMap = new Map<string, string>(); // id -> code/desc

        workerAttendance.forEach(a => {
            if (a.jobId) {
                const label = a.jobCode || a.jobDescription || 'N/D';
                jobMap.set(a.jobId, label);
            }
        });

        const jobIds = Array.from(jobMap.keys());
        // If no jobs, we might still want basic columns for presence types? 
        // User asked for "Columns: Job Name". 
        // We probably also need columns for "Ferie", "Permessi", "Malattia", etc.?
        // Or should those be rows? User said "Rows: Days". 
        // So standard attendance (Ferie, Malattia) should probably be columns too or just marked in a specific column?
        // Let's add standard columns: "Ferie", "Permessi", "Malattia", "Altro".

        const standardColumns = ['Ferie', 'Perm.', 'Mal.', 'Altro'];
        const columns: string[] = ['Giorno', ...jobIds.map(id => jobMap.get(id) || 'N/D'), ...standardColumns];

        // Prepare Body
        const body = days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayAtts = workerAttendance.filter(a => a.date === dateKey);

            const row: any[] = [format(day, 'dd/MM')];

            // Job Columns
            jobIds.forEach(jid => {
                const att = dayAtts.find(a => a.jobId === jid);
                row.push(att ? `${att.hours}` : '');
            });

            // Standard Columns
            // Ferie
            const holiday = dayAtts.find(a => a.status === 'holiday');
            row.push(holiday ? '8' : '');

            // Permessi
            const permit = dayAtts.find(a => a.status === 'permit');
            row.push(permit ? `${permit.hours}` : '');

            // Malattia
            const sick = dayAtts.find(a => a.status === 'sick');
            row.push(sick ? '8' : '');

            // Altro (Others)
            const other = dayAtts.find(a => !['holiday', 'permit', 'sick', 'presence'].includes(a.status));
            row.push(other ? `${other.status.substring(0, 3)}` : '');

            // Return row object with style info if needed
            // highligh weekends
            // We can't pass style in simple array, used didParseCell hook later? 
            // actually autotable allows object rows? No, simplest is hook.
            return row;
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
            didParseCell: (data) => {
                // Highlight Weekends
                const rowIndex = data.row.index;
                // data.row.index corresponds to body array index?
                if (rowIndex >= 0 && rowIndex < days.length) {
                    const day = days[rowIndex];
                    if (isWeekend(day)) {
                        data.cell.styles.fillColor = [240, 240, 240];
                    }
                }
            }
        });
    });

    doc.save(`report_presenze_${monthName.replace(' ', '_')}.pdf`);
};
