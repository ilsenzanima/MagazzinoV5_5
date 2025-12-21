"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { jobsApi, movementsApi, Job, Movement } from "@/lib/api";

// Components
import { JobOverview } from "@/components/jobs/details/JobOverview";
import { JobStock } from "@/components/jobs/details/JobStock";
import { JobJournal } from "@/components/jobs/details/JobJournal";
import { JobDocuments } from "@/components/jobs/details/JobDocuments";

export default function JobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Ref for printing
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    // Simple print implementation
    // For a more complex "Card" print, we might want a dedicated CSS print media query
    // hiding the TabsList and showing all content, or just printing the current view.
    // The user requested "Stampa scheda per uso in ufficio".
    // Usually this means the Overview + Costs.
    window.print();
  };

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const [jobData, movementsData] = await Promise.all([
          jobsApi.getById(id),
          movementsApi.getByJobId(id)
        ]);
        setJob(jobData);
        setMovements(movementsData);
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

  // Calculate Total Cost
  // Logic: Unload (To Site) = Cost (+), Load (Return) = Refund (-)
  const totalCost = movements.reduce((acc, m) => {
    const cost = m.quantity * (m.itemPrice || 0);
    return acc + (m.type === 'unload' ? cost : -cost);
  }, 0);

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
            <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Stampa Scheda
            </Button>
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
