"use client"

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { jobMatchReason, JobMatchReason } from "@/lib/utils/job-match";

const REASONS: Record<JobMatchReason, string> = {
    "stesso-nome": "stesso titolo",
    "stesso-indirizzo": "stesso indirizzo",
    "nome-simile": "titolo simile",
};

interface ProposalLike {
    id: string;
    clientId: string;
    title: string;
    date?: string | null;
    siteStreet?: string | null;
    siteStreetNumber?: string | null;
    siteCity?: string | null;
}

interface Props {
    title: string;
    clientId: string;
    siteAddress: string;
    proposals: ProposalLike[];
}

const addressOf = (p: ProposalLike) => [p.siteStreet, p.siteStreetNumber, p.siteCity].filter(Boolean).join(" ");

// Avviso (non bloccante) se lo stesso committente ha già un'offerta con titolo o indirizzo uguale/simile
export function DuplicateProposalsNotice({ title, clientId, siteAddress, proposals }: Props) {
    const matches = useMemo(() => {
        if (!clientId || title.trim().length < 4) return [];
        const rank: Record<JobMatchReason, number> = { "stesso-nome": 0, "stesso-indirizzo": 1, "nome-simile": 2 };
        return proposals
            .filter(p => p.clientId === clientId)
            .map(p => ({ proposal: p, reason: jobMatchReason({ name: p.title, siteAddress: addressOf(p) }, { name: title, siteAddress }) }))
            .filter((m): m is { proposal: ProposalLike; reason: JobMatchReason } => m.reason !== null)
            .sort((a, b) => rank[a.reason] - rank[b.reason])
            .slice(0, 4);
    }, [title, clientId, siteAddress, proposals]);

    if (matches.length === 0) return null;

    return (
        <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-950/30">
            <p className="font-medium text-amber-900 dark:text-amber-200">
                {matches.length === 1 ? "Questo committente ha già un'offerta simile" : "Questo committente ha già offerte simili"}
            </p>
            <ul className="space-y-1">
                {matches.map(({ proposal, reason }) => (
                    <li key={proposal.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-white/70 p-2 dark:bg-slate-900/40">
                        <span>
                            <span className="font-medium">{proposal.title}</span>
                            <span className="text-xs text-slate-500">
                                {proposal.date ? ` · del ${new Date(proposal.date).toLocaleDateString("it-IT")}` : ""} · {REASONS[reason]}
                            </span>
                        </span>
                        <Button asChild variant="ghost" size="sm">
                            <a href={`/clients/${proposal.clientId}/proposals/${proposal.id}`} target="_blank" rel="noopener noreferrer">Apri</a>
                        </Button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
