"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ArrowLeft, 
  Building2, 
  Calendar, 
  MapPin, 
  User, 
  FileText, 
  Download,
  Package
} from "lucide-react";
import { jobsApi, movementsApi, Job, Movement } from "@/lib/api";
import Link from "next/link";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [job, setJob] = useState<Job | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

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
        <div className="flex h-full items-center justify-center">
          <p>Caricamento...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!job) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <h2 className="text-2xl font-bold text-slate-900">Commessa non trovata</h2>
          <Link href="/jobs">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Torna alle Commesse
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  // Calculate totals
  const totalItems = movements.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalMovements = movements.length;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/jobs">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {job.code}
                </h1>
                <Badge variant={job.status === 'active' ? 'default' : 'secondary'} className={job.status === 'active' ? 'bg-green-600' : ''}>
                  {job.status === 'active' ? 'Attiva' : job.status === 'completed' ? 'Completata' : 'Sospesa'}
                </Badge>
              </div>
              <p className="text-slate-500">{job.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Download className="mr-2 h-4 w-4" /> Stampa Report
            </Button>
            {/* Edit button could go here */}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Job Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dettagli Commessa</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Committente</p>
                    <p className="text-sm text-slate-500">{job.clientName}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Indirizzo Cantiere</p>
                    <p className="text-sm text-slate-500">{job.siteAddress || "Non specificato"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Capocantiere</p>
                    <p className="text-sm text-slate-500">{job.siteManager || "Non assegnato"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">Periodo</p>
                    <p className="text-sm text-slate-500">
                      {new Date(job.startDate).toLocaleDateString()} - {job.endDate ? new Date(job.endDate).toLocaleDateString() : "In corso"}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase">CIG</p>
                        <p className="font-mono text-sm">{job.cig || "-"}</p>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-slate-500 uppercase">CUP</p>
                        <p className="font-mono text-sm">{job.cup || "-"}</p>
                    </div>
                </div>
              </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Riepilogo Materiali</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                        <div className="p-4 bg-slate-50 rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">{totalMovements}</p>
                            <p className="text-xs text-slate-500 uppercase font-medium">Movimenti</p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">{totalItems}</p>
                            <p className="text-xs text-slate-500 uppercase font-medium">Quantità Totale</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
          </div>

          {/* Right Column: Movements Report */}
          <div className="md:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Report Materiali Utilizzati</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Articolo</TableHead>
                      <TableHead>Riferimento</TableHead>
                      <TableHead>Operatore</TableHead>
                      <TableHead className="text-right">Quantità</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                          Nessun materiale movimentato per questa commessa
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.map((move) => (
                        <TableRow key={move.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {new Date(move.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                                <span className="font-medium text-slate-900">{move.itemName || "Articolo eliminato"}</span>
                                <span className="text-xs text-slate-500 font-mono">{move.itemCode}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {move.reference || "-"}
                          </TableCell>
                           <TableCell className="text-sm text-slate-500">
                            {move.userName || "Utente"}
                          </TableCell>
                          <TableCell className="text-right font-bold whitespace-nowrap">
                            <Badge variant="outline" className={move.type === 'load' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
                                {move.type === 'load' ? '+' : '-'}{move.quantity} {move.itemUnit}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
