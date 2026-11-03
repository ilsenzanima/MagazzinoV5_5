"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { jobsApi } from "@/lib/services/jobs";
import { guestSitesApi } from "@/lib/services/guest-sites";
import { GuestSite, Job, JobChainItem } from "@/lib/types";

const NEW = "__new__";

interface Props {
    jobId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // "completed": appena la commessa e' stata completata (se e' gia' in un portale non si chiede nulla); "manual": dal pulsante
    reason: "completed" | "manual";
}

// Crea il portale ospiti di una commessa, oppure aggiunge la commessa a un portale gia' esistente
// dello stesso cantiere (le commesse collegate da "nuovo inizio" finiscono tutte nello stesso portale).
export function JobPortalDialog({ jobId, open, onOpenChange, reason }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [job, setJob] = useState<Job | null>(null);
    const [chain, setChain] = useState<JobChainItem[]>([]);
    const [sites, setSites] = useState<{ site: GuestSite; jobIds: string[] }[]>([]);
    const [target, setTarget] = useState<string>(NEW);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");

    const alreadyIn = sites.find((s) => jobId && s.jobIds.includes(jobId)) || null;
    const targetEntry = sites.find((s) => s.site.id === target) || null;

    useEffect(() => {
        if (!open || !jobId) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const [j, ch] = await Promise.all([jobsApi.getById(jobId), jobsApi.getChain(jobId)]);
                const found = await guestSitesApi.findSitesForJobs(ch.map((c) => c.id));
                if (cancelled) return;
                setJob(j);
                setChain(ch);
                setSites(found);
                setName(j.name || "");
                setAddress(j.siteAddress || j.clientAddress || "");
                const inThis = found.find((s) => s.jobIds.includes(jobId));
                // Gia' in un portale: se la commessa e' appena stata completata non c'e' nulla da chiedere
                if (inThis && reason === "completed") {
                    onOpenChange(false);
                    return;
                }
                setTarget(found[0]?.site.id ?? NEW);
                setSelected(new Set(ch.map((c) => c.id)));
            } catch (e) {
                console.error(e);
                toast.error("Errore nel caricamento dei dati della commessa");
                if (!cancelled) onOpenChange(false);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, jobId]);

    // Commesse proponibili: tutte quelle della catena, tranne quelle che il portale scelto contiene gia'
    const candidates = chain.filter((c) => !(targetEntry && targetEntry.jobIds.includes(c.id)));

    const toggle = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });

    const toLink = candidates.filter((c) => selected.has(c.id));

    const handleConfirm = async () => {
        if (toLink.length === 0) { toast.error("Seleziona almeno una commessa"); return; }
        if (target === NEW && (!name.trim() || !address.trim())) { toast.error("Nome e indirizzo sono obbligatori"); return; }
        try {
            setSaving(true);
            let siteId = target;
            if (target === NEW) {
                const created = await guestSitesApi.create({ name: name.trim(), address: address.trim() });
                siteId = created.id;
            }
            for (const c of toLink) await guestSitesApi.associateJob(siteId, c.id);
            toast.success(target === NEW ? "Portale ospiti creato" : "Commessa aggiunta al portale");
            onOpenChange(false);
            router.push(`/guest-sites/${siteId}`);
        } catch (e: any) {
            console.error(e);
            toast.error(e.message || "Errore durante il salvataggio");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{reason === "completed" ? "Commessa completata: portale ospiti" : "Portale ospiti"}</DialogTitle>
                    <DialogDescription>
                        {alreadyIn
                            ? "Questa commessa è già in un portale ospiti."
                            : "L'ospite potrà consultare in sola lettura i documenti e le conformità delle commesse collegate."}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : alreadyIn ? (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button>
                        <Button onClick={() => { onOpenChange(false); router.push(`/guest-sites/${alreadyIn.site.id}`); }}>
                            Apri il portale «{alreadyIn.site.name}»
                        </Button>
                    </DialogFooter>
                ) : (
                    <>
                        <div className="space-y-4 py-2">
                            {sites.length > 0 && (
                                <div className="space-y-2">
                                    <Label>Questo cantiere ha già un portale</Label>
                                    {sites.map((s) => (
                                        <label key={s.site.id} className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm">
                                            <input type="radio" name="portal-target" className="mt-1" checked={target === s.site.id} onChange={() => setTarget(s.site.id)} />
                                            <span>
                                                <span className="font-medium">Aggiungi al portale «{s.site.name}»</span>
                                                <span className="block text-xs text-muted-foreground">{s.jobIds.length} {s.jobIds.length === 1 ? "commessa collegata" : "commesse collegate"}</span>
                                            </span>
                                        </label>
                                    ))}
                                    <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm">
                                        <input type="radio" name="portal-target" className="mt-1" checked={target === NEW} onChange={() => setTarget(NEW)} />
                                        <span className="font-medium">Crea un nuovo portale</span>
                                    </label>
                                </div>
                            )}

                            {target === NEW && (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label htmlFor="portal-name">Nome del portale *</Label>
                                        <Input id="portal-name" value={name} onChange={(e) => setName(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label htmlFor="portal-address">Indirizzo cantiere *</Label>
                                        <Input id="portal-address" value={address} onChange={(e) => setAddress(e.target.value)} />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Commesse da collegare</Label>
                                {candidates.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Sono già tutte nel portale.</p>
                                ) : candidates.map((c) => (
                                    <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                                        <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">{c.code}</span>
                                        <span className="truncate">{c.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                                {reason === "completed" ? "Non ora" : "Annulla"}
                            </Button>
                            <Button onClick={handleConfirm} disabled={saving || toLink.length === 0}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {target === NEW ? "Crea portale" : "Aggiungi al portale"}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
