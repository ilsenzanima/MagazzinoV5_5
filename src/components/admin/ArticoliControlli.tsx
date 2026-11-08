"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ExternalLink, Loader2, PackageSearch, ShieldCheck, TrendingDown, Trash } from "lucide-react"
import { NotchTabs, NotchActions, NotchHelp, NotchSearch } from "@/components/ui/notch-tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/components/auth-provider"
import { useSubTab } from "@/hooks/useSubTab"
import { inventoryApi, UntrackedStockItem, NegativeLotMovement, OrphanedJobReference } from "@/lib/services/inventory"
import { InventoryItem } from "@/lib/types"
import { notify } from "@/lib/notify"

type UnverifiedItem = InventoryItem & { createdAt: string }

const TABS = ["nuovi", "fuori-lotto", "lotti-negativi", "commesse-eliminate"]

const HELP: Record<string, string> = {
  nuovi: "Nuovi articoli in attesa di verifica, dal più recente. Controlla i dati (in particolare il coefficiente) e spunta quando è tutto corretto; clicca sull'articolo per aprirne la scheda e correggerlo.",
  "fuori-lotto": "Articoli il cui stock a magazzino non è interamente coperto da lotti d'acquisto residui, di solito per un movimento agganciato al lotto sbagliato o un acquisto modificato dopo essere già stato in parte scaricato. Clicca sull'articolo per aprire la scheda (si apre già sul tab Lotti) e correggere.",
  "lotti-negativi": "Righe di bolle collegate a un lotto d'acquisto la cui quantità residua è scesa sotto zero, di solito perché agganciate per errore al lotto di un acquisto fatto direttamente per un'altra commessa. Apri la bolla e correggi il collegamento al lotto (tab Lotti nella scheda articolo).",
  "commesse-eliminate": "Acquisti o bolle ancora collegati a una commessa che è stata spostata nel cestino: riferimenti «orfani» da controllare prima di eliminare definitivamente la commessa.",
}

const headCls = "text-xs font-semibold uppercase tracking-wide text-slate-600"
const headRow = "bg-slate-100 hover:bg-slate-100 dark:bg-muted"

function formatDate(iso: string, withTime = false): string {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-xl border bg-card shadow-sm">{children}</div>
}

function Empty({ loading, icon: Icon, text }: { loading: boolean; icon: typeof ShieldCheck; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={9} className="py-14 text-center text-slate-400 dark:text-slate-500">
        {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin" /> : (<><Icon className="mx-auto mb-2 h-10 w-10 opacity-20" />{text}</>)}
      </TableCell>
    </TableRow>
  )
}

const openLink = (href: string) => (
  <Link href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
    Apri <ExternalLink className="h-3.5 w-3.5" />
  </Link>
)

// Controllo articoli + Anomalie: un'unica voce con le quattro schede
export function ArticoliControlli() {
  const { userRole } = useAuth()
  const [tab, setTab] = useSubTab(TABS, "nuovi")
  const [search, setSearch] = useState("")

  const [items, setItems] = useState<UnverifiedItem[]>([])
  const [untracked, setUntracked] = useState<UntrackedStockItem[]>([])
  const [negative, setNegative] = useState<NegativeLotMovement[]>([])
  const [orphaned, setOrphaned] = useState<OrphanedJobReference[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [a, b, c, d] = await Promise.allSettled([
      inventoryApi.getUnverified(),
      inventoryApi.getUntrackedStock(),
      inventoryApi.getNegativeLotMovements(),
      inventoryApi.getOrphanedJobReferences(),
    ])
    if (a.status === "fulfilled") setItems(a.value as UnverifiedItem[]); else notify.error("Errore nel caricamento degli articoli da controllare")
    if (b.status === "fulfilled") setUntracked(b.value); else notify.error("Errore nel caricamento degli articoli fuori lotto")
    if (c.status === "fulfilled") setNegative(c.value); else notify.error("Errore nel caricamento dei lotti negativi")
    if (d.status === "fulfilled") setOrphaned(d.value); else notify.error("Errore nel caricamento delle commesse eliminate")
    setLoading(false)
  }, [])

  useEffect(() => { if (userRole === "admin") load() }, [userRole, load])

  const handleVerify = async (id: string) => {
    setVerifying(id)
    try {
      await inventoryApi.verify(id)
      setItems(prev => prev.filter(i => i.id !== id))
      notify.success("Articolo verificato")
    } catch (error) {
      console.error("Failed to verify item", error)
      notify.error("Errore durante la verifica")
    } finally {
      setVerifying(null)
    }
  }

  const q = search.trim().toLowerCase()
  const match = (...vals: (string | number | null | undefined)[]) => !q || vals.some(v => String(v ?? "").toLowerCase().includes(q))

  const fItems = useMemo(() => items.filter(i => match(i.code, i.name, i.model, i.brand, i.type)), [items, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const fUntracked = useMemo(() => untracked.filter(i => match(i.code, i.name, i.model, i.brand)), [untracked, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const fNegative = useMemo(() => negative.filter(i => match(i.code, i.name, i.purchaseRef, i.deliveryNoteNumber)), [negative, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const fOrphaned = useMemo(() => orphaned.filter(i => match(i.reference, i.jobCode)), [orphaned, q]) // eslint-disable-line react-hooks/exhaustive-deps

  if (userRole !== "admin") {
    return <div className="py-24 text-center text-slate-500"><ShieldCheck className="mx-auto mb-4 h-12 w-12 opacity-20" />Accesso riservato agli amministratori.</div>
  }

  const count = (n: number, label: string) => (n > 0 ? `${label} (${n})` : label)

  return (
    <div className="space-y-4">
      <NotchTabs
        title="Controllo articoli"
        tabWidth={190}
        items={[
          { value: "nuovi", label: count(items.length, "Nuovi articoli"), icon: <ShieldCheck />, dot: items.length > 0 },
          { value: "fuori-lotto", label: count(untracked.length, "Fuori lotto"), icon: <PackageSearch /> },
          { value: "lotti-negativi", label: count(negative.length, "Lotti negativi"), icon: <TrendingDown />, dot: negative.length > 0 },
          { value: "commesse-eliminate", label: count(orphaned.length, "Commesse eliminate"), icon: <Trash />, dot: orphaned.length > 0 },
        ]}
        value={tab}
        onValueChange={key => { setSearch(""); setTab(key) }}
      >
        <NotchHelp wide title="Controllo articoli" lines={[HELP[tab]]} />
        <NotchActions>
          <NotchSearch value={search} onChange={setSearch} placeholder="Cerca codice, articolo, riferimento..." />
        </NotchActions>
      </NotchTabs>

      {tab === "nuovi" && (
        <Shell>
          <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
            <TableHeader>
              <TableRow className={headRow}>
                <TableHead className={`w-12 ${headCls}`} />
                <TableHead className={`w-32 ${headCls}`}>Codice</TableHead>
                <TableHead className={headCls}>Articolo</TableHead>
                <TableHead className={`hidden w-48 md:table-cell ${headCls}`}>Marca / tipo</TableHead>
                <TableHead className={`hidden w-24 text-right lg:table-cell ${headCls}`}>Coeff.</TableHead>
                <TableHead className={`hidden w-20 lg:table-cell ${headCls}`}>Unità</TableHead>
                <TableHead className={`hidden w-40 md:table-cell ${headCls}`}>Creato il</TableHead>
                <TableHead className={`w-24 ${headCls}`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fItems.length === 0 ? <Empty loading={loading} icon={ShieldCheck} text="Nessun articolo da controllare" /> : fItems.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="py-2">
                    <Checkbox checked={false} disabled={verifying === item.id} onCheckedChange={() => handleVerify(item.id)} className="h-5 w-5" aria-label={`Segna come verificato: ${item.name}`} />
                  </TableCell>
                  <TableCell className="py-2 font-mono text-xs text-slate-500">{item.code}</TableCell>
                  <TableCell className="truncate py-2 font-medium">{item.name}{item.model && <span className="ml-1 text-xs font-normal text-slate-500">({item.model})</span>}</TableCell>
                  <TableCell className="hidden truncate py-2 text-sm text-slate-600 md:table-cell">{[item.brand, item.type].filter(Boolean).join(" · ")}</TableCell>
                  <TableCell className="hidden py-2 text-right text-sm lg:table-cell">{item.coefficient}</TableCell>
                  <TableCell className="hidden py-2 text-sm lg:table-cell">{item.unit}</TableCell>
                  <TableCell className="hidden py-2 text-xs text-slate-500 md:table-cell">{formatDate(item.createdAt, true)}</TableCell>
                  <TableCell className="py-2 text-right">{openLink(`/inventory/${item.id}`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Shell>
      )}

      {tab === "fuori-lotto" && (
        <Shell>
          <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
            <TableHeader>
              <TableRow className={headRow}>
                <TableHead className={`w-32 ${headCls}`}>Codice</TableHead>
                <TableHead className={headCls}>Articolo</TableHead>
                <TableHead className={`hidden w-40 md:table-cell ${headCls}`}>Marca</TableHead>
                <TableHead className={`w-28 text-right ${headCls}`}>A lotto</TableHead>
                <TableHead className={`w-28 text-right ${headCls}`}>Totale</TableHead>
                <TableHead className={`w-36 text-right ${headCls}`}>Fuori lotto</TableHead>
                <TableHead className={`w-24 ${headCls}`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fUntracked.length === 0 ? <Empty loading={loading} icon={PackageSearch} text="Nessun articolo fuori lotto" /> : fUntracked.map(item => (
                <TableRow key={item.itemId}>
                  <TableCell className="py-2 font-mono text-xs text-slate-500">{item.code}</TableCell>
                  <TableCell className="truncate py-2 font-medium">{item.name}{item.model && <span className="ml-1 text-xs font-normal text-slate-500">({item.model})</span>}</TableCell>
                  <TableCell className="hidden truncate py-2 text-sm text-slate-600 md:table-cell">{item.brand}</TableCell>
                  <TableCell className="py-2 text-right text-sm text-slate-500">{item.trackedQuantity}</TableCell>
                  <TableCell className="py-2 text-right text-sm font-semibold">{item.totalQuantity} {item.unit}</TableCell>
                  <TableCell className="py-2 text-right text-sm font-medium text-orange-600">{item.untrackedQuantity} {item.unit}</TableCell>
                  <TableCell className="py-2 text-right">{openLink(`/inventory/${item.itemId}`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Shell>
      )}

      {tab === "lotti-negativi" && (
        <Shell>
          <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
            <TableHeader>
              <TableRow className={headRow}>
                <TableHead className={`w-32 ${headCls}`}>Codice</TableHead>
                <TableHead className={headCls}>Articolo</TableHead>
                <TableHead className={`hidden w-56 md:table-cell ${headCls}`}>Lotto acquisto</TableHead>
                <TableHead className={`w-36 text-right ${headCls}`}>Residuo</TableHead>
                <TableHead className={`hidden w-48 lg:table-cell ${headCls}`}>Bolla</TableHead>
                <TableHead className={`w-24 ${headCls}`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fNegative.length === 0 ? <Empty loading={loading} icon={ShieldCheck} text="Nessuna anomalia rilevata" /> : fNegative.map(row => (
                <TableRow key={`${row.purchaseItemId}-${row.deliveryNoteItemId}`}>
                  <TableCell className="py-2 font-mono text-xs text-slate-500">{row.code}</TableCell>
                  <TableCell className="truncate py-2 font-medium">{row.name}</TableCell>
                  <TableCell className="hidden truncate py-2 text-sm text-slate-600 md:table-cell">{row.purchaseRef} · {formatDate(row.purchaseDate)}</TableCell>
                  <TableCell className="py-2 text-right text-sm font-semibold text-red-600">
                    {row.remainingQuantity} {row.unit}{row.remainingPieces != null ? ` (${row.remainingPieces} pz)` : ""}
                  </TableCell>
                  <TableCell className="hidden truncate py-2 text-sm text-slate-600 lg:table-cell">
                    Bolla {row.deliveryNoteNumber} · {formatDate(row.deliveryNoteDate)} · {row.itemQuantity} {row.unit}
                  </TableCell>
                  <TableCell className="py-2 text-right">{openLink(`/movements/${row.deliveryNoteId}/edit`)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Shell>
      )}

      {tab === "commesse-eliminate" && (
        <Shell>
          <Table className="table-fixed border-collapse [&_td]:px-2 [&_th]:px-2">
            <TableHeader>
              <TableRow className={headRow}>
                <TableHead className={`w-28 ${headCls}`}>Tipo</TableHead>
                <TableHead className={headCls}>Riferimento</TableHead>
                <TableHead className={`hidden w-36 md:table-cell ${headCls}`}>Data</TableHead>
                <TableHead className={`w-48 ${headCls}`}>Commessa eliminata</TableHead>
                <TableHead className={`w-24 ${headCls}`} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {fOrphaned.length === 0 ? <Empty loading={loading} icon={AlertTriangle} text="Nessuna anomalia rilevata" /> : fOrphaned.map(row => (
                <TableRow key={`${row.sourceType}-${row.sourceId}`}>
                  <TableCell className="py-2 text-sm">{row.sourceType === "purchase" ? "Acquisto" : "Bolla"}</TableCell>
                  <TableCell className="truncate py-2 font-medium">{row.reference}</TableCell>
                  <TableCell className="hidden py-2 text-sm text-slate-600 md:table-cell">{formatDate(row.referenceDate)}</TableCell>
                  <TableCell className="py-2 font-mono text-sm">{row.jobCode}</TableCell>
                  <TableCell className="py-2 text-right">
                    {openLink(row.sourceType === "purchase" ? `/purchases/${row.sourceId}` : `/movements/${row.sourceId}/edit`)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Shell>
      )}
    </div>
  )
}
