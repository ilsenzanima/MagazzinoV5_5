"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Download, Package, Truck, ShoppingBag, Loader2, FileSpreadsheet, Archive } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import * as XLSX from "xlsx";
import JSZip from "jszip";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ArticoloRow {
  codice: string;
  nome: string;
  marca: string;
  categoria: string;
  quantita: number;
  unita: string;
  posizione: string;
  data_inserimento: string;
}

interface MovimentazioneRow {
  numero_bolla: string;
  tipo: string;
  causale: string;
  commessa: string;
  data_bolla: string;
  data_inserimento: string;
}

interface AcquistoRow {
  numero_bolla: string;
  fornitore: string;
  data_bolla: string;
  commessa: string;
  data_inserimento: string;
}

interface DownloadData {
  articoli: ArticoloRow[];
  movimentazioni: MovimentazioneRow[];
  acquisti: AcquistoRow[];
}

const TIPO_LABEL: Record<string, string> = {
  entry: "Entrata",
  exit: "Uscita",
  sale: "Vendita",
  waste: "Eccedenze",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: it });
  } catch {
    return iso;
  }
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: it });
  } catch {
    return iso;
  }
}

function makeWorksheet(rows: Record<string, unknown>[]): XLSX.WorkSheet {
  return XLSX.utils.json_to_sheet(rows);
}

async function buildZip(
  data: DownloadData,
  selected: { articoli: boolean; movimentazioni: boolean; acquisti: boolean }
): Promise<Blob> {
  const zip = new JSZip();

  if (selected.articoli && data.articoli.length > 0) {
    const rows = data.articoli.map((r) => ({
      Codice: r.codice,
      Nome: r.nome,
      Marca: r.marca,
      Categoria: r.categoria,
      "Quantità": r.quantita,
      Unità: r.unita,
      Posizione: r.posizione,
      "Data Inserimento": r.data_inserimento,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, makeWorksheet(rows), "Articoli");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    zip.file("articoli.xlsx", buf);
  }

  if (selected.movimentazioni && data.movimentazioni.length > 0) {
    const rows = data.movimentazioni.map((r) => ({
      "Numero Bolla": r.numero_bolla,
      Tipo: r.tipo,
      Causale: r.causale,
      Commessa: r.commessa,
      "Data Bolla": r.data_bolla,
      "Data Inserimento Sistema": r.data_inserimento,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, makeWorksheet(rows), "Movimentazioni");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    zip.file("movimentazioni.xlsx", buf);
  }

  if (selected.acquisti && data.acquisti.length > 0) {
    const rows = data.acquisti.map((r) => ({
      "Numero Bolla": r.numero_bolla,
      Fornitore: r.fornitore,
      "Data Bolla": r.data_bolla,
      Commessa: r.commessa,
      "Data Inserimento Sistema": r.data_inserimento,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, makeWorksheet(rows), "Acquisti");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    zip.file("acquisti.xlsx", buf);
  }

  return zip.generateAsync({ type: "blob" });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-16 text-slate-400 dark:text-slate-500">
      <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-20" />
      <p>Nessun dato trovato per {label}.</p>
      <p className="text-sm mt-1">Imposta il filtro data e premi Cerca.</p>
    </div>
  );
}

function ArticoliTable({ rows }: { rows: ArticoloRow[] }) {
  if (rows.length === 0) return <EmptyState label="gli articoli" />;
  return (
    <div className="overflow-auto max-h-[500px] rounded border border-slate-200 dark:border-slate-700">
      <Table>
        <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
          <TableRow>
            <TableHead>Codice</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Marca</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Quantità</TableHead>
            <TableHead>Unità</TableHead>
            <TableHead>Posizione</TableHead>
            <TableHead>Data Inserimento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{r.codice}</TableCell>
              <TableCell>{r.nome}</TableCell>
              <TableCell>{r.marca}</TableCell>
              <TableCell>{r.categoria}</TableCell>
              <TableCell className="text-right">{r.quantita}</TableCell>
              <TableCell>{r.unita}</TableCell>
              <TableCell>{r.posizione}</TableCell>
              <TableCell className="text-xs text-slate-500">{r.data_inserimento}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MovimentazioniTable({ rows }: { rows: MovimentazioneRow[] }) {
  if (rows.length === 0) return <EmptyState label="le movimentazioni" />;
  return (
    <div className="overflow-auto max-h-[500px] rounded border border-slate-200 dark:border-slate-700">
      <Table>
        <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
          <TableRow>
            <TableHead>Numero Bolla</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Causale</TableHead>
            <TableHead>Commessa</TableHead>
            <TableHead>Data Bolla</TableHead>
            <TableHead>Data Inserimento Sistema</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{r.numero_bolla}</TableCell>
              <TableCell>{r.tipo}</TableCell>
              <TableCell>{r.causale}</TableCell>
              <TableCell>{r.commessa}</TableCell>
              <TableCell className="text-xs">{r.data_bolla}</TableCell>
              <TableCell className="text-xs text-slate-500">{r.data_inserimento}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AcquistiTable({ rows }: { rows: AcquistoRow[] }) {
  if (rows.length === 0) return <EmptyState label="gli acquisti" />;
  return (
    <div className="overflow-auto max-h-[500px] rounded border border-slate-200 dark:border-slate-700">
      <Table>
        <TableHeader className="sticky top-0 bg-slate-50 dark:bg-slate-800 z-10">
          <TableRow>
            <TableHead>Numero Bolla</TableHead>
            <TableHead>Fornitore</TableHead>
            <TableHead>Data Bolla</TableHead>
            <TableHead>Commessa</TableHead>
            <TableHead>Data Inserimento Sistema</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="font-mono text-xs">{r.numero_bolla}</TableCell>
              <TableCell>{r.fornitore}</TableCell>
              <TableCell className="text-xs">{r.data_bolla}</TableCell>
              <TableCell>{r.commessa}</TableCell>
              <TableCell className="text-xs text-slate-500">{r.data_inserimento}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DownloadReport() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [data, setData] = useState<DownloadData>({ articoli: [], movimentazioni: [], acquisti: [] });

  // Export dialog state
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState({ articoli: true, movimentazioni: true, acquisti: true });

  const handleSearch = async () => {
    setLoading(true);
    setSearched(true);
    try {
      // Build created_at range: dateTo must cover the full day
      const fromTs = dateFrom ? dateFrom : undefined;
      const toTs = dateTo ? dateTo + "T23:59:59" : undefined;

      // ── Articoli ────────────────────────────────────────────────────────────
      let artQuery = supabase
        .from("inventory")
        .select("code, name, brand, category, quantity, unit, location, created_at")
        .order("created_at", { ascending: false });
      if (fromTs) artQuery = artQuery.gte("created_at", fromTs);
      if (toTs) artQuery = artQuery.lte("created_at", toTs);
      const { data: artData } = await artQuery;

      // ── Movimentazioni ──────────────────────────────────────────────────────
      let movQuery = supabase
        .from("delivery_notes")
        .select("number, type, causal, created_at, date, jobs(code, name)")
        .order("created_at", { ascending: false });
      if (fromTs) movQuery = movQuery.gte("created_at", fromTs);
      if (toTs) movQuery = movQuery.lte("created_at", toTs);
      const { data: movData } = await movQuery;

      // ── Acquisti ────────────────────────────────────────────────────────────
      let acqQuery = supabase
        .from("purchases")
        .select("delivery_note_number, delivery_note_date, created_at, suppliers(name), jobs(code, name)")
        .order("created_at", { ascending: false });
      if (fromTs) acqQuery = acqQuery.gte("created_at", fromTs);
      if (toTs) acqQuery = acqQuery.lte("created_at", toTs);
      const { data: acqData } = await acqQuery;

      setData({
        articoli: (artData || []).map((r: any): ArticoloRow => ({
          codice: r.code ?? "",
          nome: r.name ?? "",
          marca: r.brand ?? "",
          categoria: r.category ?? "",
          quantita: r.quantity ?? 0,
          unita: r.unit ?? "",
          posizione: r.location ?? "",
          data_inserimento: fmtDateTime(r.created_at),
        })),
        movimentazioni: (movData || []).map((r: any): MovimentazioneRow => ({
          numero_bolla: r.number ?? "",
          tipo: TIPO_LABEL[r.type] ?? r.type ?? "",
          causale: r.causal ?? "",
          commessa: r.jobs ? `${r.jobs.code ?? ""} ${r.jobs.name ?? ""}`.trim() : "",
          data_bolla: fmtDate(r.date),
          data_inserimento: fmtDateTime(r.created_at),
        })),
        acquisti: (acqData || []).map((r: any): AcquistoRow => ({
          numero_bolla: r.delivery_note_number ?? "",
          fornitore: r.suppliers?.name ?? "",
          data_bolla: fmtDate(r.delivery_note_date),
          commessa: r.jobs ? `${r.jobs.code ?? ""} ${r.jobs.name ?? ""}`.trim() : "",
          data_inserimento: fmtDateTime(r.created_at),
        })),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await buildZip(data, selected);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `export_magazzino_${format(new Date(), "yyyyMMdd_HHmm")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setExportOpen(false);
    } finally {
      setExporting(false);
    }
  };

  const canExport =
    searched &&
    (data.articoli.length > 0 || data.movimentazioni.length > 0 || data.acquisti.length > 0);

  const noneSelected = !selected.articoli && !selected.movimentazioni && !selected.acquisti;

  return (
    <div className="space-y-6">
      {/* ── Filter bar ── */}
      <div className="bg-white dark:bg-card p-4 rounded-lg border dark:border-border shadow-sm space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Filtra per <span className="font-medium text-slate-700 dark:text-slate-300">data di inserimento nel sistema</span> (created_at).
          Lascia vuoto per ottenere tutti i dati.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">Dal</span>
            <Input
              type="date"
              className="bg-slate-100 dark:bg-muted border-none w-36"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 dark:text-slate-400 shrink-0">Al</span>
            <Input
              type="date"
              className="bg-slate-100 dark:bg-muted border-none w-36"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-slate-400 hover:text-slate-700"
            >
              Azzera date
            </Button>
          )}
          <Button
            onClick={handleSearch}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            Cerca
          </Button>
          {canExport && (
            <Button
              variant="outline"
              onClick={() => setExportOpen(true)}
              className="border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
            >
              <Archive className="mr-2 h-4 w-4" />
              Esporta ZIP
            </Button>
          )}
        </div>
        {searched && !loading && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Risultati: {data.articoli.length} articoli · {data.movimentazioni.length} movimentazioni · {data.acquisti.length} acquisti
          </p>
        )}
      </div>

      {/* ── Sub-tabs ── */}
      <Tabs defaultValue="articoli" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[500px]">
          <TabsTrigger value="articoli" className="gap-2">
            <Package className="h-4 w-4" />
            <span>Articoli</span>
            {searched && !loading && (
              <span className="ml-1 text-xs bg-slate-200 dark:bg-slate-700 rounded-full px-1.5">
                {data.articoli.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="movimentazioni" className="gap-2">
            <Truck className="h-4 w-4" />
            <span>Movimentazioni</span>
            {searched && !loading && (
              <span className="ml-1 text-xs bg-slate-200 dark:bg-slate-700 rounded-full px-1.5">
                {data.movimentazioni.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="acquisti" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            <span>Acquisti</span>
            {searched && !loading && (
              <span className="ml-1 text-xs bg-slate-200 dark:bg-slate-700 rounded-full px-1.5">
                {data.acquisti.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento dati...</span>
            </div>
          ) : (
            <>
              <TabsContent value="articoli">
                <ArticoliTable rows={data.articoli} />
              </TabsContent>
              <TabsContent value="movimentazioni">
                <MovimentazioniTable rows={data.movimentazioni} />
              </TabsContent>
              <TabsContent value="acquisti">
                <AcquistiTable rows={data.acquisti} />
              </TabsContent>
            </>
          )}
        </div>
      </Tabs>

      {/* ── Export dialog ── */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Archive className="h-5 w-5 text-green-600" />
              Seleziona cosa esportare
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Verrà generato un file ZIP con un file Excel separato per ogni sezione selezionata.
            </p>
            <div className="space-y-3 pt-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <Checkbox
                  checked={selected.articoli}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, articoli: !!v }))}
                  disabled={data.articoli.length === 0}
                />
                <div className="flex items-center gap-2 select-none">
                  <Package className="h-4 w-4 text-slate-500" />
                  <span className="font-medium">Articoli</span>
                  <span className="text-xs text-slate-400">({data.articoli.length} righe)</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <Checkbox
                  checked={selected.movimentazioni}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, movimentazioni: !!v }))}
                  disabled={data.movimentazioni.length === 0}
                />
                <div className="flex items-center gap-2 select-none">
                  <Truck className="h-4 w-4 text-slate-500" />
                  <span className="font-medium">Movimentazioni</span>
                  <span className="text-xs text-slate-400">({data.movimentazioni.length} righe)</span>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <Checkbox
                  checked={selected.acquisti}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, acquisti: !!v }))}
                  disabled={data.acquisti.length === 0}
                />
                <div className="flex items-center gap-2 select-none">
                  <ShoppingBag className="h-4 w-4 text-slate-500" />
                  <span className="font-medium">Acquisti</span>
                  <span className="text-xs text-slate-400">({data.acquisti.length} righe)</span>
                </div>
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setExportOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={handleExport}
              disabled={exporting || noneSelected}
              className="bg-green-600 hover:bg-green-700"
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Scarica ZIP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
