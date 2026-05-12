"use client"

import { useState, useEffect, useRef } from "react"
import QRCode from "react-qr-code"
import Barcode from "react-barcode"
import { inventoryApi, inventorySupplierCodesApi } from "@/lib/api"
import { InventoryItem, InventorySupplierCode } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Printer, QrCode, Barcode as BarcodeIcon, Search, CheckSquare, Square } from "lucide-react"

type Mode = "qr" | "barcode"
type LabelSize = "sm" | "md" | "lg" | "full"

const SIZE_CONFIG: Record<Exclude<LabelSize, "full">, { label: string; qr: number; barcodeWidth: number; barcodeHeight: number; class: string }> = {
  sm: { label: "Piccolo",  qr: 64,  barcodeWidth: 1.2, barcodeHeight: 40,  class: "w-[110px]" },
  md: { label: "Medio",   qr: 96,  barcodeWidth: 1.6, barcodeHeight: 55,  class: "w-[160px]" },
  lg: { label: "Grande",  qr: 128, barcodeWidth: 2.0, barcodeHeight: 70,  class: "w-[210px]" },
}

// ─── Etichetta compatta (sm/md/lg) ───────────────────────────────────────────
interface CompactLabelProps {
  item: InventoryItem
  mode: Mode
  size: Exclude<LabelSize, "full">
}

function CompactLabel({ item, mode, size }: CompactLabelProps) {
  const cfg = SIZE_CONFIG[size]
  const value = item.code || item.id
  return (
    <div className={`label-card flex flex-col items-center gap-1 p-2 border rounded ${cfg.class} break-inside-avoid`}>
      {mode === "qr"
        ? <QRCode value={value} size={cfg.qr} />
        : <Barcode value={value} width={cfg.barcodeWidth} height={cfg.barcodeHeight} displayValue={false} margin={0} />
      }
      <span className="text-[10px] font-mono font-semibold leading-tight text-center">{item.code}</span>
      <span className="text-[9px] text-center leading-tight line-clamp-2">{item.name}</span>
    </div>
  )
}

// ─── Etichetta piena pagina ───────────────────────────────────────────────────
interface FullPageLabelProps {
  item: InventoryItem
  mode: Mode
  supplierCodes: InventorySupplierCode[]
  isLast: boolean
}

function FullPageLabel({ item, mode, supplierCodes, isLast }: FullPageLabelProps) {
  const value = item.code || item.id
  return (
    <div
      className="label-card full-page-label"
      style={{
        width: "100%",
        minHeight: "270mm",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        padding: "32px",
        border: "1px solid #ccc",
        pageBreakAfter: isLast ? "auto" : "always",
        breakAfter: isLast ? "auto" : "page",
        background: "white",
      }}
    >
      {/* Codice grande */}
      <div style={{ fontSize: "48px", fontWeight: 700, fontFamily: "monospace", letterSpacing: "4px" }}>
        {item.code}
      </div>

      {/* Nome articolo */}
      <div style={{ fontSize: "28px", fontWeight: 600, textAlign: "center", maxWidth: "180mm" }}>
        {item.name}
      </div>

      {/* QR / Barcode grande */}
      {mode === "qr"
        ? <QRCode value={value} size={220} />
        : <Barcode value={value} width={3} height={120} fontSize={16} />
      }

      {/* Dettagli articolo */}
      <table style={{ fontSize: "16px", borderCollapse: "collapse", width: "160mm" }}>
        <tbody>
          {item.brand && (
            <tr>
              <td style={{ padding: "6px 12px", fontWeight: 600, width: "80px", borderBottom: "1px solid #eee" }}>Marca</td>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid #eee" }}>{item.brand}</td>
            </tr>
          )}
          {item.model && (
            <tr>
              <td style={{ padding: "6px 12px", fontWeight: 600, borderBottom: "1px solid #eee" }}>Modello</td>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid #eee" }}>{item.model}</td>
            </tr>
          )}
          {item.type && (
            <tr>
              <td style={{ padding: "6px 12px", fontWeight: 600, borderBottom: "1px solid #eee" }}>Categoria</td>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid #eee" }}>{item.type}</td>
            </tr>
          )}
          {item.unit && (
            <tr>
              <td style={{ padding: "6px 12px", fontWeight: 600, borderBottom: "1px solid #eee" }}>Unità</td>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid #eee" }}>{item.unit}</td>
            </tr>
          )}
          {item.supplierCode && (
            <tr>
              <td style={{ padding: "6px 12px", fontWeight: 600, borderBottom: "1px solid #eee" }}>Cod. fornitore</td>
              <td style={{ padding: "6px 12px", borderBottom: "1px solid #eee", fontFamily: "monospace" }}>{item.supplierCode}</td>
            </tr>
          )}
          {supplierCodes.length > 0 && (
            <tr>
              <td style={{ padding: "6px 12px", fontWeight: 600, verticalAlign: "top" }}>Varianti</td>
              <td style={{ padding: "6px 12px" }}>
                {supplierCodes.map(sc => (
                  <div key={sc.id} style={{ fontFamily: "monospace", marginBottom: "2px" }}>
                    <strong>{sc.code}</strong>
                    {sc.supplierName && <span style={{ color: "#666", fontFamily: "sans-serif" }}> — {sc.supplierName}</span>}
                    {sc.note && <span style={{ color: "#999", fontFamily: "sans-serif" }}> ({sc.note})</span>}
                  </div>
                ))}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Componente principale ────────────────────────────────────────────────────
export default function QrPrintReport() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<Mode>("barcode")
  const [size, setSize] = useState<LabelSize>("md")
  const [supplierCodesMap, setSupplierCodesMap] = useState<Map<string, InventorySupplierCode[]>>(new Map())
  const [loadingCodes, setLoadingCodes] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inventoryApi.getAll()
      .then(data => setItems(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Carica codici fornitore quando si passa a piena pagina o cambiano gli articoli selezionati
  useEffect(() => {
    if (size !== "full" || selected.size === 0) return
    const missingIds = [...selected].filter(id => !supplierCodesMap.has(id))
    if (missingIds.length === 0) return

    setLoadingCodes(true)
    Promise.all(missingIds.map(id =>
      inventorySupplierCodesApi.getByItemId(id).then(codes => ({ id, codes }))
    )).then(results => {
      setSupplierCodesMap(prev => {
        const next = new Map(prev)
        results.forEach(({ id, codes }) => next.set(id, codes))
        return next
      })
    }).catch(console.error).finally(() => setLoadingCodes(false))
  }, [size, selected])

  const filtered = items.filter(i =>
    !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.code?.toLowerCase().includes(search.toLowerCase())
  )
  const selectedItems = items.filter(i => selected.has(i.id))

  const toggleItem = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  const toggleAll = () => {
    if (filtered.every(i => selected.has(i.id))) {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(i => next.delete(i.id)); return next })
    } else {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(i => next.add(i.id)); return next })
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id))
  const printReady = selectedItems.length > 0 && (size !== "full" || !loadingCodes)

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  )

  const sizes: { key: LabelSize; label: string }[] = [
    { key: "sm",   label: "Piccolo" },
    { key: "md",   label: "Medio" },
    { key: "lg",   label: "Grande" },
    { key: "full", label: "Piena pagina" },
  ]

  return (
    <>
      <style>{`
        @media screen {
          #qr-print-area { position: fixed; left: -9999px; top: 0; width: 210mm; }
        }
        @media print {
          body * { visibility: hidden; }
          #qr-print-area, #qr-print-area * { visibility: visible; }
          #qr-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
          }
          #qr-print-area .label-card { border: 1px solid #ccc; break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="flex flex-col gap-6">
        {/* Toolbar */}
        <Card>
          <CardContent className="pt-4 flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-slate-500">Tipo codice</Label>
              <div className="flex gap-2">
                <Button size="sm" variant={mode === "barcode" ? "default" : "outline"} onClick={() => setMode("barcode")} className="gap-1">
                  <BarcodeIcon className="h-4 w-4" /> Codice a barre
                </Button>
                <Button size="sm" variant={mode === "qr" ? "default" : "outline"} onClick={() => setMode("qr")} className="gap-1">
                  <QrCode className="h-4 w-4" /> QR Code
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-slate-500">Dimensione etichetta</Label>
              <div className="flex gap-2 flex-wrap">
                {sizes.map(s => (
                  <Button key={s.key} size="sm" variant={size === s.key ? "default" : "outline"} onClick={() => setSize(s.key)}>
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            <Button className="ml-auto gap-2" onClick={() => window.print()} disabled={!printReady}>
              {loadingCodes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Stampa {selectedItems.length > 0 ? `(${selectedItems.length})` : ""}
            </Button>
          </CardContent>
        </Card>

        {size === "full" && (
          <div className="flex items-center gap-2 px-1 text-sm text-slate-500">
            <span className="text-blue-600">ℹ</span>
            Modalità piena pagina: ogni etichetta occupa un foglio A4 con marca, modello e codici fornitore (varianti).
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista articoli */}
          <Card>
            <CardContent className="pt-4 flex flex-col gap-3">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input placeholder="Cerca articolo o codice..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
                </div>
                <Button size="sm" variant="ghost" onClick={toggleAll} className="gap-1 shrink-0">
                  {allFilteredSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  {allFilteredSelected ? "Deseleziona" : "Seleziona tutti"}
                </Button>
              </div>
              <div className="max-h-[500px] overflow-y-auto flex flex-col gap-1">
                {filtered.map(item => (
                  <label key={item.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                    <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleItem(item.id)} />
                    <span className="font-mono text-xs text-slate-500 w-16 shrink-0">{item.code}</span>
                    <span className="text-sm truncate">{item.name}</span>
                    {item.brand && <span className="text-xs text-slate-400 shrink-0">{item.brand}</span>}
                  </label>
                ))}
                {filtered.length === 0 && <p className="text-center text-sm text-slate-400 py-8">Nessun articolo trovato</p>}
              </div>
            </CardContent>
          </Card>

          {/* Anteprima */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-500 mb-3 font-medium">
                Anteprima {selectedItems.length > 0 ? `(${selectedItems.length} selezionate)` : ""}
              </p>
              <div className="max-h-[500px] overflow-y-auto">
                {size === "full" ? (
                  <div className="flex flex-col gap-4">
                    {selectedItems.map((item, i) => (
                      <div key={item.id} className="border rounded p-3 text-sm flex flex-col gap-1">
                        <div className="font-mono font-bold">{item.code}</div>
                        <div className="font-medium">{item.name}</div>
                        {item.brand && <div className="text-slate-500">Marca: {item.brand}</div>}
                        {item.model && <div className="text-slate-500">Modello: {item.model}</div>}
                        {(supplierCodesMap.get(item.id) ?? []).map(sc => (
                          <div key={sc.id} className="text-xs text-slate-400 font-mono">{sc.code}{sc.supplierName ? ` — ${sc.supplierName}` : ""}</div>
                        ))}
                        {loadingCodes && !supplierCodesMap.has(item.id) && <div className="text-xs text-slate-400">Caricamento varianti…</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedItems.map(item => (
                      <CompactLabel key={item.id} item={item} mode={mode} size={size as Exclude<LabelSize, "full">} />
                    ))}
                  </div>
                )}
                {selectedItems.length === 0 && (
                  <p className="text-sm text-slate-400 py-8 w-full text-center">Seleziona gli articoli dalla lista</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Area di stampa */}
      <div
        id="qr-print-area"
        ref={printRef}
        style={size === "full" ? { display: "flex", flexDirection: "column" } : { display: "flex", flexWrap: "wrap", gap: "12px", padding: "16px" }}
      >
        {size === "full"
          ? selectedItems.map((item, i) => (
              <FullPageLabel
                key={item.id}
                item={item}
                mode={mode}
                supplierCodes={supplierCodesMap.get(item.id) ?? []}
                isLast={i === selectedItems.length - 1}
              />
            ))
          : selectedItems.map(item => (
              <CompactLabel key={item.id} item={item} mode={mode} size={size as Exclude<LabelSize, "full">} />
            ))
        }
      </div>
    </>
  )
}
