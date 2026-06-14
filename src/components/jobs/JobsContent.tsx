"use client"

import { notify } from "@/lib/notify";
import { useState, useEffect, useDeferredValue } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search,
  Plus,
  Loader2,
  Briefcase,
  Calendar,
  Building,
  MapPin,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Job, jobsApi } from "@/lib/api";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";

interface JobsContentProps {
  initialJobs: Job[];
  initialTotal: number;
}

const STATUS_ORDER: Record<string, number> = { active: 0, suspended: 1, completed: 2 };

const STATUS_CONFIG = {
  active:    { label: 'Attiva',     active: 'bg-green-500 hover:bg-green-600 text-white border-green-500',    inactive: 'border border-green-300 text-green-600 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20' },
  suspended: { label: 'Sospesa',    active: 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500',    inactive: 'border border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20' },
  completed: { label: 'Completata', active: 'bg-slate-500 hover:bg-slate-600 text-white border-slate-500',   inactive: 'border border-slate-300 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800' },
} as const;

type JobStatus = keyof typeof STATUS_CONFIG;

export default function JobsContent({ initialJobs, initialTotal }: JobsContentProps) {
  const router = useRouter();
  const { userRole } = useAuth();
  const searchParams = useSearchParams();
  const filterClientId = searchParams.get('clientId');

  const [searchTerm, setSearchTerm] = useState("");
  const [jobs, setJobs] = useState<Job[]>(initialJobs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(12);
  const [totalItems, setTotalItems] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotal / 12) || 1);

  // Search Debounce
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Reset page on search
  useEffect(() => {
    setPage(1);
  }, [deferredSearchTerm, filterClientId]);

  // Sync state with props when validation/refresh happens
  useEffect(() => {
    setJobs(initialJobs);
    setTotalItems(initialTotal);
    setTotalPages(Math.ceil(initialTotal / limit) || 1);
  }, [initialJobs, initialTotal, limit]);

  // Load Jobs (Server Side Search & Pagination)
  useEffect(() => {
    if (page === 1 && !deferredSearchTerm && !filterClientId && jobs === initialJobs && initialJobs.length > 0) {
      return;
    }
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, deferredSearchTerm, filterClientId]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, total } = await jobsApi.getPaginated({
        page,
        limit,
        search: deferredSearchTerm,
        clientId: filterClientId || ''
      });

      // Sort: active → suspended → completed
      data.sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));

      setJobs(data);
      setTotalItems(total);
      setTotalPages(Math.ceil(total / limit) || 1);

    } catch (error: any) {
      console.error("Failed to load jobs:", error);
      setError(error.message || "Errore sconosciuto durante il caricamento commesse");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (job: Job, newStatus: JobStatus) => {
    if (job.status === newStatus) return;
    setUpdatingStatus(job.id);
    try {
      await jobsApi.update(job.id, { status: newStatus });
      setJobs(prev => {
        const updated = prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j);
        updated.sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));
        return updated;
      });
    } catch (err: any) {
      notify.error(err?.message || "Errore durante l'aggiornamento dello stato");
    } finally {
      setUpdatingStatus(null);
    }
  };

  const canEdit = userRole === 'admin' || userRole === 'operativo';

  // Sort initial jobs too
  const sortedJobs = [...jobs].sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));

  return (
    <>
      <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestione Commesse</h1>
          {canEdit && (
            <Link href="/jobs/new">
              <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nuova Commessa
              </Button>
            </Link>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <Input
            placeholder="Cerca Commessa (Codice, Nome, CIG, CUP, Indirizzo...)"
            className="pl-9 bg-slate-100 dark:bg-muted border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Cerca commessa"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento commesse...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full mb-4">
            <Briefcase className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Errore di Caricamento</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">{error}</p>
          <Button onClick={loadJobs} variant="outline">
            Riprova
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedJobs.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-400 dark:text-slate-500">
                <Briefcase className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nessuna commessa trovata</p>
              </div>
            ) : (
              sortedJobs.map((job) => (
                <Card
                  key={job.id}
                  className="hover:shadow-md transition-shadow flex flex-col h-full cursor-pointer"
                  onClick={() => router.push(`/jobs/${job.id}`)}
                >
                  <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-mono text-slate-500 dark:text-muted-foreground mb-1">{job.code}</div>
                        <CardTitle className="text-base sm:text-lg font-bold text-slate-800 dark:text-white break-words" title={job.name}>{job.name}</CardTitle>
                        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{job.description}</p>
                      </div>
                    </div>

                    {/* Status buttons */}
                    {canEdit ? (
                      <div
                        className="flex gap-1.5 mt-2 flex-wrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(Object.keys(STATUS_CONFIG) as JobStatus[]).map((status) => (
                          <button
                            key={status}
                            disabled={updatingStatus === job.id}
                            onClick={() => handleStatusChange(job, status)}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors disabled:opacity-50 ${
                              job.status === status
                                ? STATUS_CONFIG[status].active
                                : STATUS_CONFIG[status].inactive
                            }`}
                          >
                            {STATUS_CONFIG[status].label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2">
                        <Badge
                          className={
                            job.status === 'active' ? 'bg-green-600' :
                            job.status === 'suspended' ? 'bg-amber-500' :
                            ''
                          }
                          variant={job.status === 'completed' ? 'secondary' : undefined}
                        >
                          {STATUS_CONFIG[job.status as JobStatus]?.label ?? job.status}
                        </Badge>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 text-sm space-y-3 text-slate-600 dark:text-muted-foreground flex-1">
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                      <span className="font-medium text-slate-700 dark:text-foreground">{job.clientName || 'N/A'}</span>
                    </div>

                    {(job.cig || job.cup) && (
                      <div className="flex flex-wrap gap-2">
                        {job.cig && (
                          <Badge variant="outline" className="text-xs font-normal text-slate-500 dark:text-muted-foreground bg-slate-50 dark:bg-muted/50">
                            CIG: {job.cig}
                          </Badge>
                        )}
                        {job.cup && (
                          <Badge variant="outline" className="text-xs font-normal text-slate-500 dark:text-muted-foreground bg-slate-50 dark:bg-muted/50">
                            CUP: {job.cup}
                          </Badge>
                        )}
                      </div>
                    )}

                    {job.siteAddress && (
                      <div className="flex items-start gap-2 text-xs">
                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" />
                        <span>{job.siteAddress}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs pt-2 mt-auto border-t dark:border-slate-700">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between mt-8 border-t pt-4 dark:border-border gap-4">
              <div className="text-sm text-slate-500 dark:text-slate-400 order-2 sm:order-1">
                Pagina {page} di {totalPages} ({totalItems} commesse)
              </div>
              <div className="flex gap-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Precedente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                >
                  Successiva
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
