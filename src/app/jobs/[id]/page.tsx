"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { jobsApi, movementsApi, Job, Movement } from "@/lib/api";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from "date-fns";
import { it } from "date-fns/locale";

// Components
import { JobOverview } from "@/components/jobs/details/JobOverview";
import { JobStock } from "@/components/jobs/details/JobStock";
import { JobJournal } from "@/components/jobs/details/JobJournal";
import { JobDocuments } from "@/components/jobs/details/JobDocuments";

export default function JobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { userRole } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [job, setJob] = useState<Job | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Ref for printing
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!job) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("SCHEDA CANTIERE / COMMESSA", 105, 15, { align: "center" });
    
    // Job Info
    doc.setFontSize(10);
    doc.setLineWidth(0.1);
    
    // Box 1: General Info
    doc.rect(14, 25, 182, 35);
    doc.setFont("helvetica", "bold");
    doc.text("Codice:", 16, 32);
    doc.setFont("helvetica", "normal");
    doc.text(job.code || "-", 35, 32);
    
    doc.setFont("helvetica", "bold");
    doc.text("Descrizione:", 16, 38);
    doc.setFont("helvetica", "normal");
    doc.text(job.description, 16, 44, { maxWidth: 178 });

    doc.setFont("helvetica", "bold");
    doc.text("Cliente:", 16, 52);
    doc.setFont("helvetica", "normal");
    doc.text(job.clientName || "-", 35, 52);

    // Box 2: Site Info & Status
    doc.rect(14, 65, 90, 30);
    doc.setFont("helvetica", "bold");
    doc.text("Indirizzo Cantiere:", 16, 72);
    doc.setFont("helvetica", "normal");
    doc.text(job.siteAddress || "-", 16, 78, { maxWidth: 86 });

    doc.rect(106, 65, 90, 30);
    doc.setFont("helvetica", "bold");
    doc.text("Stato:", 108, 72);
    doc.setFont("helvetica", "normal");
    const statusLabel = job.status === 'active' ? 'In Lavorazione' : job.status === 'completed' ? 'Completata' : 'Sospesa';
    doc.text(statusLabel, 125, 72);
    
    doc.setFont("helvetica", "bold");
    doc.text("Data Inizio:", 108, 80);
    doc.setFont("helvetica", "normal");
    doc.text(job.startDate ? format(new Date(job.startDate), 'dd/MM/yyyy') : "-", 135, 80);

    // Box 3: Economics
    if (userRole === 'admin' || userRole === 'operativo') {
        doc.rect(14, 100, 182, 20);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Totale Costo Materiali:", 16, 113);
        doc.text(`€ ${totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 190, 113, { align: "right" });
    } else {
        // Alternative placeholder for restricted roles or just skip
        doc.rect(14, 100, 182, 20);
        doc.setFontSize(10);
        doc.setFont("helvetica", "italic");
        doc.text("Dati economici riservati", 16, 113);
    }

    // Table of Recent Movements (Limit to last 20 for brevity in summary)
    doc.setFontSize(11);
    doc.text("Ultimi Movimenti (Max 20)", 14, 130);
    
    const tableBody = movements.slice(0, 20).map(m => [
        format(new Date(m.date), 'dd/MM/yyyy'),
        m.type === 'purchase' ? 'Acquisto' : m.type === 'exit' ? 'Uscita' : m.type === 'entry' ? 'Rientro' : m.type,
        m.itemCode || "-",
        m.itemName || "Articolo",
        m.quantity.toString() + " " + (m.itemUnit || ""),
        // Only show price if relevant/visible logic
        (userRole === 'admin' || userRole === 'operativo') && m.type === 'purchase' ? `€ ${m.itemPrice?.toFixed(2)}` : "-" 
    ]);

    autoTable(doc, {
        startY: 135,
        head: [['Data', 'Tipo', 'Codice', 'Descrizione', 'Q.tà', 'Prezzo (Acq.)']],
        body: tableBody,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 128, 185] }
    });

    // Footer
    const finalY = (doc as any).lastAutoTable.finalY || 135;
    doc.setFontSize(8);
    doc.text(`Generato il ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, finalY + 10);

    doc.save(`Commessa_${job.code}.pdf`);
  };

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        // Parallel fetch: Job Details, Movements (for tabs), and Server-side Cost
        const [jobData, movementsData, costData] = await Promise.all([
          jobsApi.getById(id),
          movementsApi.getByJobId(id),
          jobsApi.getCost(id)
        ]);
        setJob(jobData);
        setMovements(movementsData);
        setTotalCost(costData);
      } catch (error) {
        console.error("Error loading job details:", error);
      } finally {
        setLoading(false);
      }
    };
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
      <div className="max-w-6xl mx-auto space-y-6 pb-20 print:p-0 print:max-w-none">
        
        {/* Header Navigation - Hidden in print */}
        <div className="flex items-center justify-between print:hidden">
            <Link href="/jobs">
            <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Torna alle Commesse
            </Button>
            </Link>
            {(userRole === 'admin' || userRole === 'operativo') && (
            <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Stampa Report
            </Button>
            )}
        </div>

        {/* Printable Area */}
        <div ref={printRef}>
            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="print:hidden w-full justify-start border-b rounded-none p-0 h-auto bg-transparent">
                    <TabsTrigger 
                        value="overview" 
                        className="rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-6 py-3"
                    >
                        Dettagli & Costi
                    </TabsTrigger>
                    <TabsTrigger 
                        value="stock" 
                        className="rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-6 py-3"
                    >
                        Materiali & Giacenza
                    </TabsTrigger>
                    <TabsTrigger 
                        value="journal" 
                        className="rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-6 py-3"
                    >
                        Giornale Lavori
                    </TabsTrigger>
                    <TabsTrigger 
                        value="documents" 
                        className="rounded-t-lg data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:shadow-none px-6 py-3"
                    >
                        Documenti
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 focus-visible:outline-none">
                    <JobOverview job={job} totalCost={totalCost} />
                </TabsContent>

                <TabsContent value="stock" className="space-y-6 focus-visible:outline-none">
                    <JobStock movements={movements} />
                </TabsContent>

                <TabsContent value="journal" className="space-y-6 focus-visible:outline-none">
                    <JobJournal jobId={job.id} />
                </TabsContent>

                <TabsContent value="documents" className="space-y-6 focus-visible:outline-none">
                    <JobDocuments />
                </TabsContent>
            </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
