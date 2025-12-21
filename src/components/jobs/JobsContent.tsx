"use client"

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Plus, 
  Loader2,
  Briefcase,
  Calendar,
  Building,
  MapPin,
  FileText,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { Job, jobsApi } from "@/lib/api";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filterClientId = searchParams.get('clientId');

  const [searchTerm, setSearchTerm] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    loadJobs();
  }, [filterClientId]);

  const loadJobs = async () => {
    try {
        setLoading(true);
        let data;
        if (filterClientId) {
            data = await jobsApi.getByClientId(filterClientId);
        } else {
            data = await jobsApi.getAll();
        }
        setJobs(data);
    } catch (error) {
        console.error("Failed to load jobs:", error);
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteJob = async () => {
    if (!jobToDelete) return;
    try {
      await jobsApi.delete(jobToDelete.id);
      await loadJobs();
      setIsDeleteDialogOpen(false);
      setJobToDelete(null);
    } catch (error) {
      console.error("Failed to delete job:", error);
      alert("Errore durante l'eliminazione della commessa");
    }
  };

  const filteredJobs = jobs.filter((job) => {
    return (
      job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.siteAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.cig?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.cup?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'active': return <Badge className="bg-green-600">Attiva</Badge>;
        case 'completed': return <Badge variant="secondary">Completata</Badge>;
        case 'suspended': return <Badge variant="destructive">Sospesa</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-slate-900">Gestione Commesse</h1>
          <Link href="/jobs/new">
            <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nuova Commessa
            </Button>
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cerca Commessa (Codice, Nome, CIG, CUP, Indirizzo...)" 
            className="pl-9 bg-slate-100 border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Cerca commessa"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-500">Caricamento commesse...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.length === 0 ? (
            <div className="col-span-full text-center py-10 text-slate-400">
              <Briefcase className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nessuna commessa trovata</p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <Card 
                key={job.id} 
                className="hover:shadow-md transition-shadow flex flex-col h-full cursor-pointer relative group"
                onClick={() => router.push(`/jobs/${job.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-mono text-slate-500 mb-1">{job.code}</div>
                        <CardTitle className="text-base leading-tight mb-1">{job.description}</CardTitle>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {getStatusBadge(job.status)}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setJobToDelete(job);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-3 text-slate-600 flex-1">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="font-medium text-slate-700">{job.clientName || 'N/A'}</span>
                  </div>

                  {(job.cig || job.cup) && (
                      <div className="flex flex-wrap gap-2">
                          {job.cig && (
                              <Badge variant="outline" className="text-xs font-normal text-slate-500 bg-slate-50">
                                CIG: {job.cig}
                              </Badge>
                          )}
                          {job.cup && (
                              <Badge variant="outline" className="text-xs font-normal text-slate-500 bg-slate-50">
                                CUP: {job.cup}
                              </Badge>
                          )}
                      </div>
                  )}

                  {job.siteAddress && (
                    <div className="flex items-start gap-2 text-xs">
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" />
                        <span>{job.siteAddress}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs pt-2 mt-auto border-t">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>
                        {job.startDate ? new Date(job.startDate).toLocaleDateString() : 'N/D'} 
                        {' - '} 
                        {job.endDate ? new Date(job.endDate).toLocaleDateString() : 'In corso'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Commessa</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare la commessa <strong>{jobToDelete?.description}</strong>?
              <br />
              Questa azione è irreversibile e potrebbe eliminare i dati associati (movimenti, logs, ecc.).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleDeleteJob}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
