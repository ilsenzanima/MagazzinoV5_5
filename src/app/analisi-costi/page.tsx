"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ListPageHeader } from "@/components/ui/list-page-header";
import { FloatingAddButton } from "@/components/ui/floating-add-button";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Calculator, Copy, Bookmark, BookmarkCheck, Trash2, Layers } from "lucide-react";
import { clientProposalsApi, ClientProposal } from "@/lib/services/client-proposals";
import { jobsApi, Job } from "@/lib/api";
import { proposalCostAnalysisVersionsApi, ProposalCostAnalysisVersion } from "@/lib/services/proposal-cost-analysis";
import { costAnalysisArchiveApi, ArchiveTarget } from "@/lib/services/cost-analysis-archive";
import { ProposalAnalisiCosti } from "@/components/clients/detail/ProposalAnalisiCosti";
import { InlineNote } from "@/components/ui/table-bits";
import { useHistoryStep } from "@/hooks/useHistoryStep";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/lib/notify";

const PAGE_SIZE = 50;

type Area = "created" | "templates";
type ProposalWithClient = ClientProposal & { clientName: string };
type DestKind = "proposal" | "job" | "template";

export default function AnalisiCostiArchivePage() {
  const { userRole } = useAuth();
  const router = useRouter();
  const [versions, setVersions] = useState<ProposalCostAnalysisVersion[]>([]);
  const [proposals, setProposals] = useState<ProposalWithClient[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState<Area>("created");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, openVersion, closeVersion] = useHistoryStep<string>("magCostArchive");

  // «Usa come base»
  const [baseOpen, setBaseOpen] = useState(false);
  const [baseIds, setBaseIds] = useState<string[]>([]);
  const [baseName, setBaseName] = useState("");
  const [baseNote, setBaseNote] = useState("");
  const [destKind, setDestKind] = useState<DestKind>("proposal");
  const [destId, setDestId] = useState("");
  const [refreshPrices, setRefreshPrices] = useState(true);
  const [creating, setCreating] = useState(false);

  // «Salva come modello»
  const [tplSource, setTplSource] = useState<ProposalCostAnalysisVersion | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplNote, setTplNote] = useState("");

  // Nuovo modello vuoto
  const [newTplOpen, setNewTplOpen] = useState(false);
  const [newTplName, setNewTplName] = useState("");
  const [newTplNote, setNewTplNote] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ProposalCostAnalysisVersion | null>(null);

  useEffect(() => {
    if (userRole && userRole !== "admin" && userRole !== "operativo") { router.push("/dashboard"); return; }
    if (userRole) load();
  }, [userRole]);

  const load = async () => {
    try {
      setLoading(true);
      const [vs, ps, js] = await Promise.all([
        proposalCostAnalysisVersionsApi.getAll(), clientProposalsApi.getAll(), jobsApi.getAll(),
      ]);
      setVersions(vs); setProposals(ps); setJobs(js);
    } catch { notify.error("Errore nel caricamento dell'archivio"); }
    finally { setLoading(false); }
  };

  const versionById = useMemo(() => new Map(versions.map(v => [v.id, v])), [versions]);
  const jobById = useMemo(() => new Map(jobs.map(j => [j.id, j])), [jobs]);
  const proposalById = useMemo(() => new Map(proposals.map(p => [p.id, p])), [proposals]);
  // Commessa nata da un'offerta: la sua analisi costi vive nell'offerta
  const proposalByJobId = useMemo(() => new Map(proposals.filter(p => p.convertedJobId).map(p => [p.convertedJobId as string, p])), [proposals]);

  // Commessa (o offerta) di riferimento di un'analisi
  const refOf = (v: ProposalCostAnalysisVersion): { main: string; sub: string } => {
    if (v.isTemplate) return { main: "", sub: "" };
    if (v.proposalId) {
      const p = proposalById.get(v.proposalId);
      const job = p?.convertedJobId ? jobById.get(p.convertedJobId) : undefined;
      if (job) return { main: `${job.code} · ${job.name}`, sub: `Offerta: ${p?.title ?? ""}` };
      return { main: p ? `Offerta: ${p.title}` : "Offerta eliminata", sub: p?.clientName ?? "" };
    }
    const job = v.jobId ? jobById.get(v.jobId) : undefined;
    return { main: job ? `${job.code} · ${job.name}` : "Commessa eliminata", sub: job?.clientName ?? "" };
  };

  const rows = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return versions.filter(v => {
      if (v.isTemplate !== (area === "templates")) return false;
      const r = refOf(v);
      const text = [v.name, v.note, r.main, r.sub].filter(Boolean).join(" ").toLowerCase();
      return words.every(w => text.includes(w));
    });
  }, [versions, area, search, proposalById, jobById]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const changeArea = (a: Area) => { setArea(a); setSelected(new Set()); setPage(1); };
  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Destinazioni selezionabili
  const proposalOptions = useMemo(() => proposals.map(p => ({ value: p.id, label: p.title, description: p.clientName })), [proposals]);
  const jobOptions = useMemo(() => jobs.map(j => ({ value: j.id, label: `${j.code} · ${j.name}`, description: j.clientName || undefined })), [jobs]);

  const openBase = (ids: string[]) => {
    const names = ids.map(id => versionById.get(id)?.name).filter(Boolean) as string[];
    setBaseIds(ids);
    setBaseName(names.length === 1 ? `${names[0]} (copia)` : names.join(" + "));
    setBaseNote("");
    setDestKind(area === "templates" && ids.length > 1 ? "template" : "proposal");
    setDestId("");
    // Dai modelli i prezzi vengono copiati così come sono; l'aggiornamento ad oggi si propone solo partendo da analisi create
    setRefreshPrices(area === "created");
    setBaseOpen(true);
  };

  const handleCreateBase = async () => {
    const name = baseName.trim();
    if (!name || baseIds.length === 0) return;
    if (destKind !== "template" && !destId) { notify.warning("Scegli l'offerta o la commessa di destinazione"); return; }
    let target: ArchiveTarget;
    if (destKind === "template") target = { kind: "template" };
    else if (destKind === "proposal") target = { kind: "proposal", proposalId: destId };
    else {
      // Una commessa nata da un'offerta tiene le sue analisi nell'offerta
      const linked = proposalByJobId.get(destId);
      target = linked ? { kind: "proposal", proposalId: linked.id } : { kind: "job", jobId: destId };
    }
    try {
      setCreating(true);
      const res = await costAnalysisArchiveApi.createFromVersions(baseIds, target, name, baseNote.trim() || null, refreshPrices);
      const parts = [`${res.rowCount} righe`];
      if (refreshPrices) parts.push(`${res.refreshedCount} prezzi d'acquisto aggiornati`);
      if (res.manualPriceCount > 0) parts.push(`${res.manualPriceCount} prezzi unitari manuali mantenuti: ricontrollali`);
      notify.success(`Analisi creata (${parts.join(", ")})`);
      setBaseOpen(false); setSelected(new Set());
      await load();
      if (target.kind === "template") changeArea("templates");
      openVersion(res.version.id);
    } catch { notify.error("Errore durante la creazione dell'analisi"); }
    finally { setCreating(false); }
  };

  const handleSaveTemplate = async () => {
    const name = tplName.trim();
    if (!tplSource || !name) return;
    try {
      setCreating(true);
      await costAnalysisArchiveApi.createFromVersions([tplSource.id], { kind: "template" }, name, tplNote.trim() || null, false);
      notify.success("Modello salvato");
      setTplSource(null);
      await load();
    } catch { notify.error("Errore durante il salvataggio del modello"); }
    finally { setCreating(false); }
  };

  const handleCreateTemplate = async () => {
    const name = newTplName.trim();
    if (!name) return;
    try {
      setCreating(true);
      const v = await proposalCostAnalysisVersionsApi.createGeneric({ isTemplate: true }, name, newTplNote.trim() || null);
      setNewTplOpen(false);
      await load();
      openVersion(v.id);
    } catch { notify.error("Errore durante la creazione del modello"); }
    finally { setCreating(false); }
  };

  // Nota di un modello modificabile direttamente dalla tabella
  const handleSaveNote = async (v: ProposalCostAnalysisVersion, note: string) => {
    const prev = v.note;
    setVersions(list => list.map(x => x.id === v.id ? { ...x, note: note || null } : x));
    try { await proposalCostAnalysisVersionsApi.update(v.id, { note: note || null }); }
    catch {
      setVersions(list => list.map(x => x.id === v.id ? { ...x, note: prev } : x));
      notify.error("Errore durante il salvataggio della nota");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await proposalCostAnalysisVersionsApi.delete(deleteTarget.id);
      setVersions(prev => prev.filter(v => v.id !== deleteTarget.id));
      notify.success("Modello eliminato");
    } catch { notify.error("Errore durante l'eliminazione"); }
    finally { setDeleteTarget(null); }
  };

  // ── Editor di un'analisi/modello aperto dall'archivio ───────────────────────
  if (openId) {
    const v = versionById.get(openId);
    return (
      <DashboardLayout>
        <ListPageHeader strip title={v?.isTemplate ? `Modello · ${v.name}` : `Analisi costi · ${v?.name ?? ""}`} />
        <ProposalAnalisiCosti
          proposalId={v?.proposalId ?? null}
          jobLabel={v ? (v.isTemplate ? "Modello" : refOf(v).main) : undefined}
          versionId={openId}
          versionName={v?.name ?? ""}
          versionCreatedAt={v?.createdAt ?? ""}
          onBack={() => { closeVersion(); load(); }}
        />
      </DashboardLayout>
    );
  }

  const isTpl = area === "templates";
  const colCount = isTpl ? 5 : 5;
  const selCount = selected.size;

  return (
    <DashboardLayout>
      <ListPageHeader
        strip
        title="Archivio analisi costi"
        tabs={{
          items: [
            { value: "created", label: "Analisi create", icon: <Calculator /> },
            { value: "templates", label: "Modelli", icon: <Bookmark /> },
          ],
          value: area,
          onValueChange: v => changeArea(v as Area),
        }}
        search={{
          id: "cost-archive-search", label: "Cerca analisi costi", value: search,
          onChange: v => { setSearch(v); setPage(1); },
          placeholder: isTpl ? "Cerca un modello per nome o nota..." : "Cerca per nome, commessa, offerta, committente...",
        }}
      />

      {selCount > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <span className="font-medium text-blue-900 dark:text-blue-200">{selCount} selezionat{selCount === 1 ? "a" : "e"}</span>
          <Button size="sm" onClick={() => openBase([...selected])} className="bg-blue-600 hover:bg-blue-700">
            <Layers className="mr-1 h-4 w-4" />{selCount === 1 ? "Usa come base" : `Unisci in una nuova analisi`}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Deseleziona</Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <div className="mb-4 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-card">
            <Table className="border-collapse [&_td]:px-2 [&_th]:px-2">
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                  <TableHead className="w-10 border-r" />
                  <TableHead className="border-r text-xs font-semibold uppercase tracking-wide text-slate-600">Analisi costi</TableHead>
                  <TableHead className="border-r text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {isTpl ? "Nota" : "Commessa di riferimento"}
                  </TableHead>
                  <TableHead className="w-32 border-r text-xs font-semibold uppercase tracking-wide text-slate-600">Creata il</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colCount} className="py-10 text-center text-slate-400">
                      <Calculator className="mx-auto mb-2 h-12 w-12 opacity-20" />
                      {versions.some(v => v.isTemplate === isTpl)
                        ? "Nessun risultato per la ricerca."
                        : isTpl
                          ? "Nessun modello. Nella scheda «Analisi create» usa «Salva come modello» su un'analisi che vuoi riutilizzare."
                          : "Nessuna analisi costi creata."}
                    </TableCell>
                  </TableRow>
                ) : pageRows.map(v => {
                  const r = refOf(v);
                  const src = v.sourceVersionId ? versionById.get(v.sourceVersionId) : undefined;
                  return (
                    <TableRow key={v.id} className="group cursor-pointer" onClick={() => openVersion(v.id)}>
                      <TableCell className="border-r py-2" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selected.has(v.id)} onCheckedChange={() => toggle(v.id)} aria-label={`Seleziona ${v.name}`} />
                      </TableCell>
                      <TableCell className="border-r py-2">
                        <span className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                          {v.isTemplate ? <BookmarkCheck className="h-4 w-4 shrink-0 text-amber-600" /> : <Calculator className="h-4 w-4 shrink-0 text-emerald-600" />}
                          {v.name}
                        </span>
                        {src && <div className="text-[11px] text-slate-400">Creata da: {src.name}</div>}
                      </TableCell>
                      <TableCell className="border-r py-2 text-sm" onClick={isTpl ? (e => e.stopPropagation()) : undefined}>
                        {isTpl
                          ? <InlineNote value={v.note ?? ""} onSave={note => handleSaveNote(v, note)} />
                          : <>
                              <div className="text-blue-700 dark:text-blue-400">{r.main}</div>
                              {r.sub && <div className="text-[11px] text-slate-400">{r.sub}</div>}
                            </>}
                      </TableCell>
                      <TableCell className="border-r py-2 text-sm text-slate-600 dark:text-slate-300">{new Date(v.createdAt).toLocaleDateString("it-IT")}</TableCell>
                      <TableCell className="py-2" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button title="Usa come base" className="p-1 text-slate-400 hover:text-blue-600" onClick={() => openBase([v.id])}><Copy className="h-4 w-4" /></button>
                          {!isTpl && (
                            <button title="Salva come modello" className="p-1 text-slate-400 hover:text-amber-600"
                              onClick={() => { setTplSource(v); setTplName(v.name); setTplNote(v.note ?? ""); }}>
                              <Bookmark className="h-4 w-4" />
                            </button>
                          )}
                          {isTpl && (
                            <button title="Elimina modello" className="p-1 text-slate-400 hover:text-red-600" onClick={() => setDeleteTarget(v)}><Trash2 className="h-4 w-4" /></button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} onPageChange={setPage} totalItems={rows.length} itemLabel={isTpl ? "modelli" : "analisi"} />
        </>
      )}

      {/* Nuovo modello: solo nell'area Modelli */}
      {isTpl && <FloatingAddButton onClick={() => { setNewTplName(""); setNewTplNote(""); setNewTplOpen(true); }} label="Nuovo modello" />}

      <Dialog open={newTplOpen} onOpenChange={setNewTplOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo modello</DialogTitle>
            <DialogDescription>Crea un modello vuoto per una specifica occasione (es. una parete, una porta): poi riunendo più modelli ottieni una base per le nuove analisi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1"><Label>Nome del modello *</Label><Input autoFocus value={newTplName} onChange={e => setNewTplName(e.target.value)} placeholder="Es. Parete EI120, Porta tagliafuoco…" /></div>
            <div className="space-y-1"><Label>Nota</Label><Textarea value={newTplNote} onChange={e => setNewTplNote(e.target.value)} placeholder="Nota opzionale" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTplOpen(false)}>Annulla</Button>
            <Button onClick={handleCreateTemplate} disabled={!newTplName.trim() || creating} className="bg-blue-600 hover:bg-blue-700">
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crea e apri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usa come base / unisci */}
      <Dialog open={baseOpen} onOpenChange={setBaseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{baseIds.length > 1 ? "Unisci in una nuova analisi" : "Usa come base"}</DialogTitle>
            <DialogDescription>
              {baseIds.length > 1
                ? `Righe e voci di ${baseIds.length} analisi vengono unite: lo stesso articolo o la stessa voce compare una volta sola, con le quantità sommate.`
                : "Righe, voci di trasporto e posa e parametri vengono copiati in una nuova analisi, che poi modifichi liberamente."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input autoFocus value={baseName} onChange={e => setBaseName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nota</Label>
              <Textarea value={baseNote} onChange={e => setBaseNote(e.target.value)} placeholder="Nota opzionale" />
            </div>
            <div className="space-y-1">
              <Label>Dove la creo</Label>
              <Select value={destKind} onValueChange={v => { setDestKind(v as DestKind); setDestId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="proposal">In un'offerta</SelectItem>
                  <SelectItem value="job">In una commessa</SelectItem>
                  <SelectItem value="template">Come nuovo modello</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {destKind !== "template" && (
              <div className="space-y-1">
                <Label>{destKind === "proposal" ? "Offerta" : "Commessa"} *</Label>
                <SearchableSelect
                  options={destKind === "proposal" ? proposalOptions : jobOptions}
                  value={destId}
                  onValueChange={setDestId}
                  placeholder={destKind === "proposal" ? "Cerca offerta..." : "Cerca commessa..."}
                  searchPlaceholder="Digita per cercare..."
                  emptyMessage="Nessun risultato."
                />
              </div>
            )}
            {area === "created" && (
            <div className="flex items-start gap-2 pt-1">
                <Checkbox id="refresh-prices" checked={refreshPrices} onCheckedChange={v => setRefreshPrices(v === true)} className="mt-0.5" />
                <label htmlFor="refresh-prices" className="cursor-pointer text-sm text-slate-600 dark:text-slate-300">
                  Aggiorna i prezzi d'acquisto di riferimento ad oggi
                  <span className="block text-xs text-slate-400">I prezzi unitari impostati a mano restano invariati e ti verranno segnalati.</span>
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaseOpen(false)}>Annulla</Button>
            <Button onClick={handleCreateBase} disabled={!baseName.trim() || creating} className="bg-blue-600 hover:bg-blue-700">
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Crea e apri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Salva come modello */}
      <Dialog open={!!tplSource} onOpenChange={o => !o && setTplSource(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Salva come modello</DialogTitle>
            <DialogDescription>Crea una copia nell'area Modelli: l'analisi originale resta dov'è.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1"><Label>Nome del modello *</Label><Input autoFocus value={tplName} onChange={e => setTplName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Nota</Label><Textarea value={tplNote} onChange={e => setTplNote(e.target.value)} placeholder="Nota opzionale" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTplSource(null)}>Annulla</Button>
            <Button onClick={handleSaveTemplate} disabled={!tplName.trim() || creating}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salva modello
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={o => !o && setDeleteTarget(null)}
        title="Elimina modello"
        description={`Eliminare il modello "${deleteTarget?.name}"? Le analisi create a partire da questo modello non vengono toccate.`}
        onConfirm={handleDelete}
      />
    </DashboardLayout>
  );
}
