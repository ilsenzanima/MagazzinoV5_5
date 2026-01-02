import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Job } from "@/lib/api";
import { Search, Briefcase, Check, Loader2 } from "lucide-react";
import { useState, useMemo, useDeferredValue, memo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface JobSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (job: Job) => void;
  jobs: Job[];
  onSearch?: (term: string) => void;
  loading?: boolean;
}

export const JobSelectorDialog = memo(function JobSelectorDialog({ open, onOpenChange, onSelect, jobs, onSearch, loading }: JobSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  // Effect for server-side search
  useEffect(() => {
    if (onSearch) {
      const handler = setTimeout(() => {
        onSearch(searchTerm);
      }, 300);
      return () => clearTimeout(handler);
    }
  }, [searchTerm, onSearch]);

  const filteredJobs = useMemo(() => {
    // If server-side search is enabled, assume jobs are already filtered
    if (onSearch) return jobs;

    const term = deferredSearchTerm.toLowerCase();
    if (!term) return jobs;

    return jobs.filter(
      (job) =>
        job.code.toLowerCase().includes(term) ||
        job.name.toLowerCase().includes(term) ||
        job.description?.toLowerCase().includes(term) ||
        job.clientName?.toLowerCase().includes(term)
    );
  }, [jobs, deferredSearchTerm, onSearch]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Seleziona Commessa</DialogTitle>
          <DialogDescription>
            Cerca e seleziona una commessa per associarla al movimento.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <Input
            placeholder="Cerca per codice, nome, descrizione o cliente..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500">
                    <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                    <p>Caricamento...</p>
                  </TableCell>
                </TableRow>
              ) : filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500">
                    <Briefcase className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Nessuna commessa trovata</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.map((job) => (
                  <TableRow key={job.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => onSelect(job)}>
                    <TableCell className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{job.code}</TableCell>
                    <TableCell className="font-medium">{job.name}</TableCell>
                    <TableCell className="text-sm text-slate-500">{job.description || '-'}</TableCell>
                    <TableCell className="text-sm text-slate-600 dark:text-slate-400">{job.clientName || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={job.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                        {job.status === 'active' ? 'Attiva' : job.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
});
