"use client"

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import type { Job } from "@/lib/types";
import { jobMatchReason, JobMatchReason } from "@/lib/utils/job-match";

const REASONS: Record<JobMatchReason, string> = {
    "stesso-nome": "stesso nome",
    "stesso-indirizzo": "stesso indirizzo",
    "nome-simile": "nome simile",
};

interface Props {
    name: string;
    clientId: string;
    siteAddress: string;
    jobs: Job[];
    // Commesse da non segnalare (es. quelle dello stesso cantiere da cui si sta partendo)
    excludeIds?: string[];
    onUseAsSource: (jobId: string) => void;
}

// Avviso (non bloccante) se lo stesso committente ha già una commessa con nome o indirizzo uguale/simile
export function DuplicateJobsNotice({ name, clientId, siteAddress, jobs, excludeIds = [], onUseAsSource }: Props) {
    const matches = useMemo(() => {
        if (!clientId || name.trim().length < 4) return [];
        const rank: Record<JobMatchReason, number> = { "stesso-nome": 0, "stesso-indirizzo": 1, "nome-simile": 2 };
        return jobs
            .filter(j => j.clientId === clientId && !excludeIds.includes(j.id))
            .map(j => ({ job: j, reason: jobMatchReason(j, { name, siteAddress }) }))
            .filter((m): m is { job: Job; reason: JobMatchReason } => m.reason !== null)
            .sort((a, b) => rank[a.reason] - rank[b.reason])
            .slice(0, 4);
    }, [name, clientId, siteAddress, jobs, excludeIds]);

    if (matches.length === 0) return null;

    return (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-200">
                {matches.length === 1 ? "Questo committente ha già una commessa simile" : "Questo committente ha già commesse simili"}
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300">
                Se è lo stesso cantiere, conviene usare «Nuovo inizio»: la nuova commessa resta collegata alla precedente e i dati si copiano.
            </p>
            <ul className="space-y-1">
                {matches.map(({ job, reason }) => (
                    <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white/70 p-2 dark:bg-slate-900/40">
                        <span>
                            <span className="font-mono text-xs font-semibold text-primary">{job.code}</span>{" "}
                            <span className="font-medium">{job.name}</span>
                            <span className="text-xs text-slate-500">
                                {job.startDate ? ` · dal ${new Date(job.startDate).toLocaleDateString("it-IT")}` : ""} · {REASONS[reason]}
                            </span>
                        </span>
                        <span className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => onUseAsSource(job.id)}>Parti da questa</Button>
                            <Button asChild variant="ghost" size="sm">
                                <a href={`/jobs/${job.id}`} target="_blank" rel="noopener noreferrer">Apri</a>
                            </Button>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
