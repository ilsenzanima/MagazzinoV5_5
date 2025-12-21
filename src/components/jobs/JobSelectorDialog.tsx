import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Job } from "@/lib/api";
import { Search, Briefcase, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

interface JobSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (job: Job) => void;
  jobs: Job[];
}

export function JobSelectorDialog({ open, onOpenChange, onSelect, jobs }: JobSelectorDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredJobs, setFilteredJobs] = useState<Job[]>(jobs);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredJobs(
      jobs.filter(
        (job) =>
          job.code.toLowerCase().includes(term) ||
          job.description.toLowerCase().includes(term) ||
          job.clientName?.toLowerCase().includes(term)
      )
    );
  }, [searchTerm, jobs]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Seleziona Commessa</DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cerca per codice, descrizione o cliente..."
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
                <TableHead>Descrizione</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                    <Briefcase className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Nessuna commessa trovata</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.map((job) => (
                  <TableRow key={job.id} className="cursor-pointer hover:bg-slate-50" onClick={() => onSelect(job)}>
                    <TableCell className="font-mono text-xs font-bold text-blue-600">{job.code}</TableCell>
                    <TableCell className="font-medium">{job.description}</TableCell>
                    <TableCell className="text-sm text-slate-600">{job.clientName || '-'}</TableCell>
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
}
