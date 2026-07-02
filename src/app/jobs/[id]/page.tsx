"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Printer, Info, Package, FileText, Folder, Clock, Euro, Recycle, ClipboardList, Receipt, BarChart2, ShieldCheck, Truck, GanttChartSquare } from "lucide-react";
import Link from "next/link";
import { jobsApi, movementsApi, attendanceApi, Job, Movement } from "@/lib/api";
import { salApi, salCostsApi } from "@/lib/services/sal";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/lib/notify";
import { HelpTip } from "@/components/ui/help-tip";
import { jobConformitaDocumentTypesApi } from "@/lib/services/job-conformita-document-types";
import { jobSiteDocumentTypesApi } from "@/lib/services/job-site-document-types";
import { proposalDocumentTypesApi } from "@/lib/services/proposal-document-types";

// Components
import { JobOverview } from "@/components/jobs/details/JobOverview";
import { JobStock } from "@/components/jobs/details/JobStock";
import { JobDocuments } from "@/components/jobs/details/JobDocuments";
import { JobDdt } from "@/components/jobs/details/JobDdt";
import { JobCommessaDocuments } from "@/components/jobs/details/JobCommessaDocuments";
import { JobConformita } from "@/components/jobs/details/JobConformita";
import { JobAttendance } from "@/components/jobs/details/JobAttendance";
import { JobCostiSAL } from "@/components/jobs/details/JobCostiSAL";
import { JobEccedenze } from "@/components/jobs/details/JobEccedenze";
import { JobOrdiniDocumenti } from "@/components/jobs/details/JobOrdiniDocumenti";
import { JobFatturazione } from "@/components/jobs/details/JobFatturazione";
import { JobAnalisiCosti } from "@/components/jobs/details/JobAnalisiCosti";
import { JobCronoprogramma } from "@/components/jobs/details/JobCronoprogramma";
import { clientProposalsApi, ClientProposal } from "@/lib/services/client-proposals";

type TabGroupKey = 'generale' | 'documenti' | 'economico';

const TAB_GROUPS: { key: TabGroupKey; label: string; adminOnly?: boolean; tabs: string[] }[] = [
    { key: 'generale', label: 'Generale', tabs: ['overview', 'cronoprogramma', 'stock', 'attendance', 'eccedenze', 'ordini'] },
    { key: 'documenti', label: 'Documenti', tabs: ['conformita', 'documents', 'commessa-documents'] },
    { key: 'economico', label: 'Economico', adminOnly: true, tabs: ['costi-sal', 'analisi-costi', 'fatturazione'] },
];

function groupOfTab(tab: string): TabGroupKey {
    return TAB_GROUPS.find(g => g.tabs.includes(tab))?.key || 'generale';
}

export default function JobDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const { userRole } = useAuth();
    const [activeTab, setActiveTab] = useState("overview");
    const [activeGroup, setActiveGroup] = useState<TabGroupKey>(groupOfTab("overview"));
    const [job, setJob] = useState<Job | null>(null);
    const [movements, setMovements] = useState<Movement[]>([]);
    const [totalCost, setTotalCost] = useState(0);
    const [totalHours, setTotalHours] = useState(0);
    const [loading, setLoading] = useState(true);
    const [linkedProposal, setLinkedProposal] = useState<ClientProposal | null>(null);

    // Ref for printing
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = async () => {
        if (!job) return;

        // ── Fetch all data needed for the comprehensive PDF ──────────────────
        const [allAttendance, salItems, salCosts, workerCosts] = await Promise.all([
            attendanceApi.getByJobId(id),
            salApi.getByJobId(id),
            salCostsApi.getByJobId(id),
            attendanceApi.getWorkerCostsByJobId(id),
        ]);

        // Landscape A4
        const doc = new jsPDF({ orientation: 'landscape' });
        const PW = 297;
        const ML = 12;
        const CW = PW - ML * 2;
        const HDR_COLOR: [number, number, number] = [30, 58, 95];

        let curY = 14;

        // ── helper ────────────────────────────────────────────────────────────
        const sectionTitle = (title: string) => {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setFillColor(...HDR_COLOR);
            doc.rect(ML, curY, CW, 6, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(title, ML + 2, curY + 4.2);
            doc.setTextColor(0, 0, 0);
            curY += 8;
        };

        const checkPage = (needed = 40) => {
            if (curY + needed > 195) {
                doc.addPage();
                curY = 14;
            }
        };

        // ── 1. HEADER / INFO COMMESSA ─────────────────────────────────────────
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("SCHEDA CANTIERE / COMMESSA", PW / 2, curY, { align: "center" });
        curY += 7;

        const statusLabel = job.status === 'active' ? 'In Lavorazione' : job.status === 'completed' ? 'Completata' : 'Sospesa';

        doc.setLineWidth(0.2);
        doc.rect(ML, curY, CW, 26);

        // Left column
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold"); doc.text("Codice:", ML + 2, curY + 6);
        doc.setFont("helvetica", "normal"); doc.text(job.code || "-", ML + 20, curY + 6);

        doc.setFont("helvetica", "bold"); doc.text("Nome:", ML + 2, curY + 12);
        doc.setFont("helvetica", "normal"); doc.text(job.name || "-", ML + 20, curY + 12, { maxWidth: 100 });

        doc.setFont("helvetica", "bold"); doc.text("Cliente:", ML + 2, curY + 20);
        doc.setFont("helvetica", "normal"); doc.text(job.clientName || "-", ML + 20, curY + 20);

        // Middle column
        doc.setFont("helvetica", "bold"); doc.text("Indirizzo:", ML + 130, curY + 6);
        doc.setFont("helvetica", "normal"); doc.text(job.siteAddress || "-", ML + 150, curY + 6, { maxWidth: 60 });

        // Right column
        doc.setFont("helvetica", "bold"); doc.text("Stato:", ML + 215, curY + 6);
        doc.setFont("helvetica", "normal"); doc.text(statusLabel, ML + 228, curY + 6);

        doc.setFont("helvetica", "bold"); doc.text("Inizio:", ML + 215, curY + 12);
        doc.setFont("helvetica", "normal");
        doc.text(job.startDate ? format(new Date(job.startDate), 'dd/MM/yyyy') : "-", ML + 228, curY + 12);

        if (job.description) {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(7);
            doc.text(job.description, ML + 2, curY + 24, { maxWidth: CW - 4 });
        }

        curY += 30;

        // ── 2. MATERIALI ──────────────────────────────────────────────────────
        // Build SAL lookup for movements
        const movSalMap = new Map<string, string>(); // movement.id → salName
        const purSalMap = new Map<string, string>(); // purchaseId → salName
        salItems.forEach(s => {
            if (!s.itemId) return;
            if (s.itemType === 'movement') movSalMap.set(s.itemId, s.salName || '');
            if (s.itemType === 'purchase') purSalMap.set(s.itemId, s.salName || '');
        });

        const matRows = movements
            .filter(m => m.type === 'exit' || m.type === 'purchase' || m.type === 'entry')
            .map(m => {
                const typeLabel = m.type === 'purchase' ? 'Acquisto' : m.type === 'exit' ? 'Uscita' : 'Rientro';
                const salName = m.type === 'purchase'
                    ? (m.purchaseId ? purSalMap.get(m.purchaseId) || '-' : '-')
                    : (movSalMap.get(m.id) || '-');
                const unitPrice = m.itemPrice ?? 0;
                const amount = m.type !== 'entry' && unitPrice > 0
                    ? `€ ${(unitPrice * Math.abs(m.quantity)).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
                    : '-';
                const desc = m.itemModel ? `${m.itemName || ''} (${m.itemModel})` : (m.itemName || '-');
                const purDate = m.purchaseDate
                    ? format(new Date(m.purchaseDate.split('T')[0] + 'T00:00:00'), 'dd/MM/yy')
                    : '-';
                return [
                    m.date ? format(new Date(m.date.split('T')[0] + 'T00:00:00'), 'dd/MM/yy') : '-',
                    typeLabel,
                    m.purchaseNumber ? `DDT ${m.purchaseNumber}` : '-',
                    purDate,
                    m.supplierName || '-',
                    desc,
                    `${Math.abs(m.quantity)} ${m.itemUnit || ''}`.trim(),
                    amount,
                    salName,
                ];
            });

        checkPage(50);
        sectionTitle(`MATERIALI  (totale acquisti: € ${totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })})`);

        autoTable(doc, {
            startY: curY,
            head: [['Data mov.', 'Tipo', 'Acquisto', 'Data acq.', 'Fornitore', 'Articolo', 'Q.tà', 'Importo', 'SAL']],
            body: matRows,
            foot: [['', '', '', '', '', 'TOTALE MATERIALI', '', `€ ${totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, '']],
            theme: 'grid',
            styles: { fontSize: 6.5, cellPadding: 1.2 },
            headStyles: { fillColor: HDR_COLOR, textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: HDR_COLOR, textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 18 },
                1: { cellWidth: 16 },
                2: { cellWidth: 22 },
                3: { cellWidth: 18 },
                4: { cellWidth: 38 },
                5: { cellWidth: 'auto' },
                6: { cellWidth: 18 },
                7: { cellWidth: 28, halign: 'right' },
                8: { cellWidth: 22 },
            },
            margin: { left: ML, right: ML },
        });
        curY = (doc as any).lastAutoTable.finalY + 6;

        // ── 3. ORE OPERAI ─────────────────────────────────────────────────────
        // Build SAL coverage: workerId_date → salName(s)
        const attSalMap = new Map<string, string>();
        salItems
            .filter(s => s.itemType === 'worker_hours' && s.workerHoursData)
            .forEach(s => {
                s.workerHoursData!.workers.forEach(w => {
                    w.days.forEach(d => {
                        if (d.normalHours > 0 || d.transferHours > 0) {
                            const key = `${w.workerId}_${d.date}`;
                            const prev = attSalMap.get(key);
                            attSalMap.set(key, prev ? `${prev},${s.salName || ''}` : (s.salName || ''));
                        }
                    });
                });
            });

        // Group attendance by worker
        const workerDayMap = new Map<string, {
            name: string;
            days: Map<string, { normal: number; transfer: number }>;
        }>();
        allAttendance.forEach(a => {
            if (!workerDayMap.has(a.workerId)) {
                workerDayMap.set(a.workerId, { name: a.workerName || a.workerId, days: new Map() });
            }
            const we = workerDayMap.get(a.workerId)!;
            if (!we.days.has(a.date)) we.days.set(a.date, { normal: 0, transfer: 0 });
            const de = we.days.get(a.date)!;
            if (a.status === 'transfer') de.transfer += a.hours;
            else de.normal += a.hours;
        });

        const allDates = [...new Set(allAttendance.map(a => a.date))].sort();
        const allWorkers = [...workerDayMap.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

        // ── 3a. CROSS-TABLE (dates × workers) ─────────────────────────────────
        // Each worker column gets a short first-name label
        const workerShortNames = allWorkers.map(([, w]) => w.name.trim());

        const crossHead = ['Data', ...workerShortNames];
        const crossBody = allDates.map(dateStr => {
            const label = format(new Date(dateStr + 'T00:00:00'), 'EE dd/MM', { locale: it });
            const row: string[] = [label];
            allWorkers.forEach(([wid, w]) => {
                const day = w.days.get(dateStr);
                if (!day || (day.normal === 0 && day.transfer === 0)) {
                    row.push('');
                } else {
                    const parts: string[] = [];
                    if (day.normal > 0) parts.push(`${day.normal}`);
                    if (day.transfer > 0) parts.push(`${day.transfer}T`);
                    const sal = attSalMap.get(`${wid}_${dateStr}`);
                    if (sal) parts.push(`[${sal}]`);
                    row.push(parts.join(' '));
                }
            });
            return row;
        });

        checkPage(50);
        doc.addPage();
        curY = 14;
        sectionTitle('ORE OPERAI — Presenze giornaliere');

        // Dynamic column width: date col fixed, rest split evenly
        const dateColW = 22;
        const remainW = CW - dateColW;
        const workerColW = allWorkers.length > 0 ? Math.max(14, Math.floor(remainW / allWorkers.length)) : 20;

        const crossColStyles: Record<number, any> = { 0: { cellWidth: dateColW } };
        allWorkers.forEach((_, i) => { crossColStyles[i + 1] = { cellWidth: workerColW, halign: 'center' }; });

        autoTable(doc, {
            startY: curY,
            head: [crossHead],
            body: crossBody,
            theme: 'grid',
            styles: { fontSize: 6, cellPadding: 0.8 },
            headStyles: { fillColor: HDR_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 6 },
            columnStyles: crossColStyles,
            margin: { left: ML, right: ML },
        });
        curY = (doc as any).lastAutoTable.finalY + 6;

        // ── 3b. SUMMARY PER WORKER (costs) ────────────────────────────────────
        checkPage(40);
        const wCostRows = workerCosts.rows.map(r => [
            r.workerName,
            `${r.normalHours}h`,
            `${r.transferHours}h`,
            `€ ${r.normalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
            `€ ${r.trasfertaCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
            `€ ${r.total.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        ]);

        autoTable(doc, {
            startY: curY,
            head: [['Operaio', 'Ore norm.', 'Ore trasf.', 'Costo normale', 'Costo trasferta', 'Totale operaio']],
            body: wCostRows,
            foot: [['TOTALE ORE OPERAI', `${totalHours}h`, '', '', '', `€ ${workerCosts.totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`]],
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: HDR_COLOR, textColor: 255, fontStyle: 'bold' },
            footStyles: { fillColor: HDR_COLOR, textColor: 255, fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 60 },
                1: { cellWidth: 22, halign: 'right' },
                2: { cellWidth: 22, halign: 'right' },
                3: { cellWidth: 36, halign: 'right' },
                4: { cellWidth: 36, halign: 'right' },
                5: { cellWidth: 36, halign: 'right' },
            },
            margin: { left: ML, right: ML },
        });
        curY = (doc as any).lastAutoTable.finalY + 6;

        // ── 4. ALTRI COSTI ────────────────────────────────────────────────────
        const altriTotal = salCosts.reduce((s, c) => s + c.amount, 0);

        checkPage(30);
        sectionTitle('ALTRI COSTI');

        if (salCosts.length === 0) {
            doc.setFontSize(7);
            doc.setFont("helvetica", "italic");
            doc.text("Nessun altro costo registrato.", ML + 2, curY + 4);
            curY += 10;
        } else {
            const altriRows = salCosts.map(c => [
                c.description,
                c.salName || '-',
                `€ ${c.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
            ]);

            autoTable(doc, {
                startY: curY,
                head: [['Descrizione', 'SAL', 'Importo']],
                body: altriRows,
                foot: [['TOTALE ALTRI COSTI', '', `€ ${altriTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`]],
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: 1.5 },
                headStyles: { fillColor: HDR_COLOR, textColor: 255, fontStyle: 'bold' },
                footStyles: { fillColor: HDR_COLOR, textColor: 255, fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 'auto' },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 45, halign: 'right' },
                },
                margin: { left: ML, right: ML },
            });
            curY = (doc as any).lastAutoTable.finalY + 6;
        }

        // ── 5. TOTALE RIEPILOGATIVO ───────────────────────────────────────────
        const grandTotal = totalCost + workerCosts.totalCost + altriTotal;

        checkPage(40);
        sectionTitle('RIEPILOGO TOTALE COMMESSA');

        autoTable(doc, {
            startY: curY,
            body: [
                ['Materiali (acquisti diretti)',    `€ ${totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`],
                ['Ore Operai (costo manodopera)',   `€ ${workerCosts.totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`],
                ['Altri Costi',                     `€ ${altriTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`],
            ],
            foot: [['TOTALE GENERALE', `€ ${grandTotal.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`]],
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            footStyles: { fillColor: HDR_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
            columnStyles: {
                0: { cellWidth: 100 },
                1: { cellWidth: 50, halign: 'right' },
            },
            margin: { left: ML, right: ML },
        });

        // ── Footer on all pages ───────────────────────────────────────────────
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(120, 120, 120);
            doc.text(
                `Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm')}  —  Pagina ${i} di ${totalPages}`,
                ML, 205
            );
            doc.text(`Commessa ${job.code} — ${job.name || ''}`, PW - ML, 205, { align: 'right' });
            doc.setTextColor(0, 0, 0);
        }

        const pdfSlug = [job.code, job.name]
            .filter(Boolean)
            .join('_')
            .replace(/[^a-zA-Z0-9_\-àáèéìíòóùú]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .slice(0, 50);
        doc.save(`Scheda_${pdfSlug}.pdf`);
    };

    const loadData = async () => {
        if (!id) return;
        try {
            setLoading(true);
            // Parallel fetch: Job Details, Movements (for tabs), Cost and Hours
            const [jobData, movementsData, costData, hoursData] = await Promise.all([
                jobsApi.getById(id),
                movementsApi.getByJobId(id),
                jobsApi.getCost(id),
                attendanceApi.getTotalHoursByJobId(id)
            ]);
            setJob(jobData);
            setMovements(movementsData);
            setTotalCost(costData);
            setTotalHours(hoursData);
            // Cerca proposta collegata (se creata da conversione)
            clientProposalsApi.getByConvertedJobId(id)
                .then(p => setLinkedProposal(p))
                .catch(e => console.error("getByConvertedJobId error:", e));
        } catch (error) {
            console.error("Error loading job details:", error);
            notify.error("Errore nel caricamento dei dettagli della commessa");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [id]);

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    if (!job) {
        return (
            <DashboardLayout>
                <div className="text-center py-10">
                    <h2 className="text-xl font-bold text-slate-700">Commessa non trovata</h2>
                    <Link href="/jobs" className="text-blue-600 hover:underline mt-2 inline-block">
                        Torna alla lista
                    </Link>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-6xl mx-auto space-y-6 pb-20 print:p-0 print:max-w-none overflow-x-hidden">

                {/* Header Navigation - Hidden in print */}
                <div className="flex items-center justify-between gap-2 print:hidden">
                    <Link href="/jobs">
                        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 px-2 md:px-4">
                            <ArrowLeft className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Torna alle Commesse</span>
                        </Button>
                    </Link>
                    <h1 className="flex-1 text-center text-sm md:text-lg font-semibold text-slate-800 dark:text-slate-100 truncate px-2">
                        {job?.name}
                    </h1>
                    {(userRole === 'admin' || userRole === 'operativo') && (
                        <Button variant="outline" size="sm" onClick={handlePrint} className="px-2 md:px-4">
                            <Printer className="h-4 w-4 md:mr-2" />
                            <span className="hidden sm:inline">Stampa</span>
                        </Button>
                    )}
                </div>

                {/* Printable Area */}
                <div ref={printRef}>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                        {/* Selettore di gruppo */}
                        <div className="print:hidden flex gap-2">
                            {TAB_GROUPS.filter(g => !g.adminOnly || userRole === 'admin' || userRole === 'operativo').map(g => (
                                <button
                                    key={g.key}
                                    type="button"
                                    onClick={() => { setActiveGroup(g.key); setActiveTab(g.tabs[0]); }}
                                    className={`flex-1 rounded-md px-2 py-2 text-xs sm:text-sm font-medium transition-colors ${
                                        activeGroup === g.key
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>

                        {/* Tab del gruppo selezionato (max 5 voci, sempre con etichetta visibile) */}
                        <TabsList className="print:hidden w-full justify-start border-b rounded-none p-0 h-auto bg-transparent flex-nowrap overflow-x-auto overflow-y-hidden">
                            {activeGroup === 'generale' && (
                                <>
                                    <TabsTrigger value="overview" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <Info className="h-4 w-4 mr-1" />Dettagli
                                    </TabsTrigger>
                                    <TabsTrigger value="cronoprogramma" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <GanttChartSquare className="h-4 w-4 mr-1" />Cronoprogramma
                                    </TabsTrigger>
                                    <TabsTrigger value="stock" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <Package className="h-4 w-4 mr-1" />Materiali
                                    </TabsTrigger>
                                    <TabsTrigger value="attendance" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <Clock className="h-4 w-4 mr-1" />Ore
                                    </TabsTrigger>
                                    <TabsTrigger value="eccedenze" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-violet-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <Recycle className="h-4 w-4 mr-1 text-violet-500" />Eccedenze
                                    </TabsTrigger>
                                </>
                            )}
                            {activeGroup === 'documenti' && (
                                <>
                                    <TabsTrigger value="conformita" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-green-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <ShieldCheck className="h-4 w-4 mr-1 text-green-600" />Conformità
                                        <HelpTip
                                            title="Documenti Conformità Cantiere"
                                            description="Tipi disponibili per i documenti caricati direttamente sulla commessa."
                                            fetchItems={async () => (await jobConformitaDocumentTypesApi.getAll()).map(t => t.name)}
                                            emptyText="Nessun tipo configurato. Vai in Impostazioni > Dati > Documenti Conformità Cantiere per crearne uno."
                                        />
                                    </TabsTrigger>
                                    <TabsTrigger value="documents" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <FileText className="h-4 w-4 mr-1" />Documenti Cantiere
                                        <HelpTip
                                            title="Documenti Cantiere"
                                            description="Tipi disponibili per i documenti caricati in questa sezione."
                                            fetchItems={async () => (await jobSiteDocumentTypesApi.getAll()).map(t => t.name)}
                                            emptyText="Nessun tipo configurato. Vai in Impostazioni > Dati > Documenti Cantiere per crearne uno."
                                        />
                                    </TabsTrigger>
                                    {(userRole === 'admin' || userRole === 'operativo') && (
                                        <TabsTrigger value="commessa-documents" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                            <Folder className="h-4 w-4 mr-1" />Documenti Commessa
                                            <HelpTip
                                                title="Documenti Commessa"
                                                description="Tipi disponibili per i documenti caricati in questa sezione (condivisi con le proposte)."
                                                fetchItems={async () => (await proposalDocumentTypesApi.getAll()).map(t => t.name)}
                                                emptyText="Nessun tipo configurato. Vai in Impostazioni > Dati > Documenti Offerte per crearne uno."
                                            />
                                        </TabsTrigger>
                                    )}
                                    <TabsTrigger value="ordini" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-orange-500 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <ClipboardList className="h-4 w-4 mr-1 text-orange-500" />Ordini
                                    </TabsTrigger>
                                    <TabsTrigger value="ddt" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <Truck className="h-4 w-4 mr-1" />DDT
                                    </TabsTrigger>
                                </>
                            )}
                            {activeGroup === 'economico' && (userRole === 'admin' || userRole === 'operativo') && (
                                <>
                                    <TabsTrigger value="costi-sal" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <Euro className="h-4 w-4 mr-1" />Costi
                                    </TabsTrigger>
                                    <TabsTrigger value="analisi-costi" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-emerald-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <BarChart2 className="h-4 w-4 mr-1 text-emerald-600" />Analisi Costi
                                    </TabsTrigger>
                                    <TabsTrigger value="fatturazione" className="rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800 data-[state=active]:border-b-2 data-[state=active]:border-teal-600 data-[state=active]:shadow-none px-2 py-2 text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                        <Receipt className="h-4 w-4 mr-1 text-teal-600" />Fatturazione
                                    </TabsTrigger>
                                </>
                            )}
                        </TabsList>

                        <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
                            <JobOverview job={job} totalCost={totalCost} totalHours={totalHours} onJobUpdated={loadData} />
                            {linkedProposal && (
                                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 flex items-center justify-between gap-4">
                                    <div>
                                        <p className="text-xs uppercase tracking-wide text-blue-500 mb-0.5">Creata da proposta</p>
                                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{linkedProposal.title}</p>
                                        {linkedProposal.date && <p className="text-xs text-slate-500">{format(new Date(linkedProposal.date), "d MMM yyyy", { locale: it })}</p>}
                                    </div>
                                    <Link href={`/clients/${linkedProposal.clientId}/proposals/${linkedProposal.id}`}>
                                        <Button size="sm" variant="outline" className="shrink-0 text-blue-600 border-blue-300">
                                            Vai alla Proposta
                                        </Button>
                                    </Link>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="cronoprogramma" className="space-y-6 focus-visible:outline-none">
                            <JobCronoprogramma jobId={job.id} />
                        </TabsContent>

                        <TabsContent value="stock" className="space-y-6 focus-visible:outline-none">
                            <JobStock movements={movements} jobId={job.id} />
                        </TabsContent>

                        <TabsContent value="conformita" className="space-y-6 focus-visible:outline-none">
                            <JobConformita jobId={job.id} jobLabel={`${job.code} ${job.name}`} />
                        </TabsContent>

                        <TabsContent value="documents" className="space-y-6 focus-visible:outline-none">
                            <JobDocuments jobId={job.id} jobLabel={`${job.code} ${job.name}`} />
                        </TabsContent>

                        {(userRole === 'admin' || userRole === 'operativo') && (
                            <TabsContent value="commessa-documents" className="space-y-6 focus-visible:outline-none">
                                <JobCommessaDocuments jobId={job.id} jobLabel={`${job.code} ${job.name}`} />
                            </TabsContent>
                        )}

                        <TabsContent value="ddt" className="space-y-6 focus-visible:outline-none">
                            <JobDdt jobId={job.id} jobName={job.name} />
                        </TabsContent>

                        <TabsContent value="attendance" className="space-y-6 focus-visible:outline-none">
                            <JobAttendance jobId={job.id} />
                        </TabsContent>

                        <TabsContent value="costi-sal" className="space-y-6 focus-visible:outline-none">
                            <JobCostiSAL jobId={job.id} jobCode={job.code} jobName={job.name} materialCost={totalCost} movements={movements} />
                        </TabsContent>

                        {(userRole === 'admin' || userRole === 'operativo') && (
                            <TabsContent value="analisi-costi" className="space-y-6 focus-visible:outline-none">
                                <JobAnalisiCosti jobId={job.id} movements={movements} />
                            </TabsContent>
                        )}

                        <TabsContent value="eccedenze" className="space-y-6 focus-visible:outline-none">
                            <JobEccedenze jobId={job.id} />
                        </TabsContent>

                        <TabsContent value="ordini" className="space-y-6 focus-visible:outline-none">
                            <JobOrdiniDocumenti jobId={job.id} jobCode={job.code} jobLabel={`${job.code} ${job.name}`} />
                        </TabsContent>

                        {(userRole === 'admin' || userRole === 'operativo') && (
                            <TabsContent value="fatturazione" className="space-y-6 focus-visible:outline-none">
                                <JobFatturazione jobId={job.id} job={job} onJobUpdated={loadData} />
                            </TabsContent>
                        )}
                    </Tabs>
                </div>
            </div>
        </DashboardLayout>
    );
}
