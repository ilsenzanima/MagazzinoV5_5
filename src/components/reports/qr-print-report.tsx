"use client"

import { useState, useEffect, useRef } from "react"
import QRCode from "react-qr-code"
import Barcode from "react-barcode"
import { inventoryApi } from "@/lib/api"
import { InventoryItem } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, Printer, QrCode, Barcode as BarcodeIcon, Search, CheckSquare, Square } from "lucide-react"

type Mode = "qr" | "barcode"
type LabelSize = "sm" | "md" | "lg"

const SIZE_CONFIG: Record<LabelSize, { label: string; qr: number; barcodeWidth: number; barcodeHeight: number; class: string }> = {
  sm: { label: "Piccolo",  qr: 64,  barcodeWidth: 1.2, barcodeHeight: 40,  class: "w-[110px]" },
  md: { label: "Medio",   qr: 96,  barcodeWidth: 1.6, barcodeHeight: 55,  class: "w-[160px]" },
  lg: { label: "Grande",  qr: 128, barcodeWidth: 2.0, barcodeHeight: 70,  class: "w-[210px]" },
}

interface LabelProps {
  item: InventoryItem
  mode: Mode
  size: LabelSize
}

function ItemLabel({ item, mode, size }: LabelProps) {
  const cfg = SIZE_CONFIG[size]
  const value = item.code || item.id

  return (
    <div className={`label-card flex flex-col items-center gap-1 p-2 border rounded ${cfg.class} break-inside-avoid`}>
      {mode === "qr" ? (
        <QRCode value={value} size={cfg.qr} />
      ) : (
        <Barcode
          value={value}
          width={cfg.barcodeWidth}
          height={cfg.barcodeHeight}
          displayValue={false}
          margin={0}
        />
      )}
      <span className="text-[10px] font-mono font-semibold leading-tight text-center">{item.code}</span>
      <span className="text-[9px] text-center leading-tight line-clamp-2">{item.name}</span>
    </div>
  )
}

export default function QrPrintReport() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<Mode>("barcode")
  const [size, setSize] = useState<LabelSize>("md")
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inventoryApi.getAll()
      .then(data => setItems(data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = items.filter(i =>
    !search || i.name?.toLowerCase().includes(search.toLowerCase()) || i.code?.toLowerCase().includes(search.toLowerCase())
  )

  const selectedItems = items.filter(i => selected.has(i.id))

  const toggleItem = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (filtered.every(i => selected.has(i.id))) {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(i => next.delete(i.id)); return next })
    } else {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(i => next.add(i.id)); return next })
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id))

  const handlePrint = () => {
    if (selectedItems.length === 0) return
    window.print()
  }

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
    </div>
  )

  return (
    <>
      {/* Stile di stampa iniettato inline */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-area,
          #qr-print-area * { visibility: visible; }
          #qr-print-area {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            display: flex !important;
            flex-wrap: wrap;
            gap: 8px;
            padding: 16px;
            background: white;
          }
          #qr-print-area .label-card { border: 1px solid #ccc; break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div className="flex flex-col gap-6">
        {/* Toolbar */}
        <Card>
          <CardContent className="pt-4 flex flex-wrap gap-4 items-end">
            {/* Tipo codice */}
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

            {/* Dimensione etichetta */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-slate-500">Dimensione etichetta</Label>
              <div className="flex gap-2">
                {(Object.keys(SIZE_CONFIG) as LabelSize[]).map(s => (
                  <Button key={s} size="sm" variant={size === s ? "default" : "outline"} onClick={() => setSize(s)}>
                    {SIZE_CONFIG[s].label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Stampa */}
            <Button
              className="ml-auto gap-2"
              onClick={handlePrint}
              disabled={selectedItems.length === 0}
            >
              <Printer className="h-4 w-4" />
              Stampa {selectedItems.length > 0 ? `(${selectedItems.length})` : ""}
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lista articoli */}
          <Card>
            <CardContent className="pt-4 flex flex-col gap-3">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cerca articolo o codice..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={toggleAll} className="gap-1 shrink-0">
                  {allFilteredSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  {allFilteredSelected ? "Deseleziona" : "Seleziona tutti"}
                </Button>
              </div>

              <div className="max-h-[500px] overflow-y-auto flex flex-col gap-1">
                {filtered.map(item => (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <span className="font-mono text-xs text-slate-500 w-16 shrink-0">{item.code}</span>
                    <span className="text-sm truncate">{item.name}</span>
                  </label>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-8">Nessun articolo trovato</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Anteprima */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-slate-500 mb-3 font-medium">
                Anteprima etichette {selectedItems.length > 0 ? `(${selectedItems.length} selezionate)` : ""}
              </p>
              <div className="max-h-[500px] overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {selectedItems.map(item => (
                    <ItemLabel key={item.id} item={item} mode={mode} size={size} />
                  ))}
                  {selectedItems.length === 0 && (
                    <p className="text-sm text-slate-400 py-8 w-full text-center">
                      Seleziona gli articoli dalla lista per visualizzare l'anteprima
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Area di stampa — fuori dal flusso visivo, visibile solo in @media print */}
      <div
        id="qr-print-area"
        ref={printRef}
        style={{ position: "absolute", visibility: "hidden", top: 0, left: 0, width: 0, height: 0, overflow: "hidden" }}
      >
        {selectedItems.map(item => (
          <ItemLabel key={item.id} item={item} mode={mode} size={size} />
        ))}
      </div>
    </>
  )
}
