import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Briefcase, Trash2 } from "lucide-react";
import { Job } from "@/lib/types";
import { JobSelectorDialog } from "@/components/jobs/JobSelectorDialog";

interface MovementJobSelectorProps {
    selectedJob: Job | null;
    onSelect: (job: Job) => void;
    onClear: () => void;
    // Dialog props
    isOpen: boolean;
    setIsOpen: (v: boolean) => void;
    jobs: Job[];
    onSearch: (term: string) => Promise<void>;
    loading: boolean;
}

export function MovementJobSelector({
    selectedJob, onSelect, onClear,
    isOpen, setIsOpen, jobs, onSearch, loading
}: MovementJobSelectorProps) {
    return (
        <div className="space-y-2">
            <Label>Commessa di Riferimento</Label>
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    className={`w-full justify-start text-left font-normal ${!selectedJob && "text-muted-foreground"}`}
                    onClick={() => setIsOpen(true)}
                >
                    <Briefcase className="mr-2 h-4 w-4" />
                    {selectedJob ? (
                        <span className="truncate">
                            <span className="font-bold text-slate-900">{selectedJob.code}</span>
                            <span className="mx-2">-</span>
                            {selectedJob.description}
                        </span>
                    ) : (
                        "Seleziona Commessa..."
                    )}
                </Button>
                {selectedJob && (
                    <Button variant="ghost" size="icon" onClick={onClear}>
                        <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                    </Button>
                )}
            </div>

            <JobSelectorDialog
                open={isOpen}
                onOpenChange={setIsOpen}
                onSelect={onSelect}
                jobs={jobs}
                onSearch={onSearch}
                loading={loading}
            />
        </div>
    );
}
