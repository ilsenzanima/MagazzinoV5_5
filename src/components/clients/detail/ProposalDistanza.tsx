"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, MapPin, Navigation, AlertCircle, Fuel, TriangleAlert, Zap } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { warehousesApi } from "@/lib/services/warehouses"
import type { Warehouse } from "@/lib/types"

interface Props {
    siteAddress: string
}

interface RouteResult {
    distanceKm: number
    durationMin: number
}

async function geocode(address: string): Promise<[number, number] | null> {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=it`
    const res = await fetch(url, { headers: { "Accept-Language": "it" } })
    const data = await res.json()
    if (!data.length) return null
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)]
}

async function calcRoute(from: [number, number], to: [number, number]): Promise<RouteResult> {
    const res = await fetch(`/api/route-distance?from=${from[0]},${from[1]}&to=${to[0]},${to[1]}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Percorso non trovato")
    return data
}

function fmt(n: number) { return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

export function ProposalDistanza({ siteAddress }: Props) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [selectedId, setSelectedId] = useState<string>("")
    const [result, setResult] = useState<RouteResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fromAddr, setFromAddr] = useState<string>("")
    const [loadingWh, setLoadingWh] = useState(true)

    // Parametri calcolo
    const [vehicles, setVehicles] = useState("1")
    const [days, setDays] = useState("1")
    const [fuelPrice, setFuelPrice] = useState("1.85")
    const [consumption, setConsumption] = useState("12")   // L/100km
    const [tolls, setTolls] = useState("")                  // € manuale per tratta
    const [autoToll, setAutoToll] = useState(false)         // stima automatica €/km
    const [tollPerKm, setTollPerKm] = useState("0.10")     // €/km autostrada

    useEffect(() => {
        warehousesApi.getAll().then(whs => {
            setWarehouses(whs)
            const primary = whs.find(w => w.isPrimary) || whs[0]
            if (primary) { setSelectedId(primary.id); setFromAddr(primary.address || "") }
        }).finally(() => setLoadingWh(false))
    }, [])

    useEffect(() => {
        const wh = warehouses.find(w => w.id === selectedId)
        if (wh) setFromAddr(wh.address || "")
        setResult(null); setError(null)
    }, [selectedId, warehouses])

    const calculate = async () => {
        if (!fromAddr || !siteAddress) return
        setLoading(true); setError(null); setResult(null)
        try {
            const [coordFrom, coordTo] = await Promise.all([geocode(fromAddr), geocode(siteAddress)])
            if (!coordFrom) { setError(`Indirizzo di partenza non trovato: "${fromAddr}"`); return }
            if (!coordTo) { setError(`Indirizzo cantiere non trovato: "${siteAddress}"`); return }
            setResult(await calcRoute(coordFrom, coordTo))
        } catch (e: any) {
            setError(e.message || "Errore nel calcolo del percorso")
        } finally { setLoading(false) }
    }

    const formatDuration = (min: number) => {
        const h = Math.floor(min / 60), m = min % 60
        return h > 0 ? `${h}h ${m}min` : `${m} min`
    }

    const v = Number(vehicles) || 1
    const d = Number(days) || 1
    const fp = Number(fuelPrice) || 0
    const cons = Number(consumption) || 0
    const kmRoundTrip = result ? result.distanceKm * 2 : 0
    const totalKm = kmRoundTrip * d * v
    const fuelLiters = (totalKm * cons) / 100
    const fuelCost = fuelLiters * fp
    const tollTotal = autoToll
        ? totalKm * (Number(tollPerKm) || 0)
        : (Number(tolls) || 0) * d * v * 2  // manuale: A/R per mezzo per giorno
    const totalCost = fuelCost + tollTotal

    if (loadingWh) return (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
    )

    if (!siteAddress) return (
        <Card className="border-dashed">
            <CardContent className="py-8 text-center text-slate-500 text-sm">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p>Imposta prima l&apos;indirizzo del cantiere nelle Info della proposta.</p>
            </CardContent>
        </Card>
    )

    return (
        <Card>
            <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                    <Navigation className="h-4 w-4 text-blue-500" />Calcolo Percorso
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">

                {/* Partenza */}
                <div className="space-y-1">
                    <label className="text-xs text-slate-500">Partenza</label>
                    {warehouses.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">Nessun magazzino configurato</p>
                    ) : (
                        <Select value={selectedId} onValueChange={setSelectedId}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {warehouses.map(w => (
                                    <SelectItem key={w.id} value={w.id} className="text-xs">
                                        {w.name}{w.isPrimary ? " ★" : ""}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    {fromAddr && <p className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" />{fromAddr}</p>}
                </div>

                {/* Destinazione */}
                <div className="space-y-0.5">
                    <label className="text-xs text-slate-500">Destinazione (cantiere)</label>
                    <p className="text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />{siteAddress}
                    </p>
                </div>

                {/* Parametri in griglia 2x2 */}
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                        <label className="text-xs text-slate-500">N. mezzi</label>
                        <Input type="number" min="1" className="h-8 text-xs" value={vehicles} onChange={e => setVehicles(e.target.value)} />
                    </div>
                    <div className="space-y-0.5">
                        <label className="text-xs text-slate-500">Giorni stimati</label>
                        <Input type="number" min="1" className="h-8 text-xs" value={days} onChange={e => setDays(e.target.value)} />
                    </div>
                    <div className="space-y-0.5">
                        <label className="text-xs text-slate-500">Carburante €/L</label>
                        <Input type="number" step="0.01" className="h-8 text-xs" value={fuelPrice} onChange={e => setFuelPrice(e.target.value)} />
                    </div>
                    <div className="space-y-0.5">
                        <label className="text-xs text-slate-500">Consumo L/100km</label>
                        <Input type="number" step="0.5" className="h-8 text-xs" value={consumption} onChange={e => setConsumption(e.target.value)} />
                    </div>
                </div>

                {/* Pedaggi */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs text-slate-500 flex items-center gap-1">
                            <TriangleAlert className="h-3 w-3 text-amber-500" />Pedaggi
                        </label>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">Stima €/km</span>
                            <Switch checked={autoToll} onCheckedChange={setAutoToll} className="scale-75" />
                        </div>
                    </div>
                    {autoToll ? (
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <Input type="number" step="0.01" className="h-8 text-xs" value={tollPerKm}
                                    onChange={e => setTollPerKm(e.target.value)} placeholder="0.10" />
                                <span className="text-xs text-slate-500 shrink-0">€/km</span>
                            </div>
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                                <Zap className="h-3 w-3 text-yellow-500 shrink-0" />
                                Applicato su km totali A/R. Usa ~0.10 €/km come stima media autostrade italiane.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            <Input type="number" step="0.50" className="h-8 text-xs" value={tolls}
                                onChange={e => setTolls(e.target.value)} placeholder="es. 3.50" />
                            <p className="text-xs text-slate-400">Importo per singola tratta (verrà moltiplicato × A/R × giorni × mezzi).</p>
                        </div>
                    )}
                </div>

                <Button className="w-full h-8 text-sm bg-blue-600 hover:bg-blue-700" onClick={calculate}
                    disabled={loading || !fromAddr || warehouses.length === 0}>
                    {loading
                        ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Calcolo...</>
                        : <><Navigation className="h-3.5 w-3.5 mr-2" />Calcola Percorso</>}
                </Button>

                {/* Risultato */}
                {result && (
                    <div className="space-y-3 pt-1">
                        {/* Distanza / tempo */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{result.distanceKm}</p>
                                <p className="text-xs text-slate-500 mt-0.5">km andata</p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center">
                                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatDuration(result.durationMin)}</p>
                                <p className="text-xs text-slate-500 mt-0.5">tempo stimato</p>
                            </div>
                        </div>

                        {/* Riepilogo costi */}
                        <div className="border dark:border-slate-700 rounded-lg divide-y dark:divide-slate-700 text-sm">
                            <div className="flex justify-between px-3 py-2">
                                <span className="text-xs text-slate-500">Km totali (A/R × {d}gg × {v} mezzi)</span>
                                <span className="text-xs font-medium">{totalKm.toFixed(1)} km</span>
                            </div>
                            <div className="flex justify-between px-3 py-2">
                                <span className="text-xs text-slate-500 flex items-center gap-1"><Fuel className="h-3 w-3" />Carburante ({fuelLiters.toFixed(1)} L × €{fuelPrice})</span>
                                <span className="text-xs font-medium">€ {fmt(fuelCost)}</span>
                            </div>
                            {tollTotal > 0 && (
                                <div className="flex justify-between px-3 py-2">
                                    <span className="text-xs text-slate-500 flex items-center gap-1">
                                        <TriangleAlert className="h-3 w-3 text-amber-500" />
                                        {autoToll ? `Pedaggi stimati (${tollPerKm} €/km)` : "Pedaggi stimati"}
                                    </span>
                                    <span className="text-xs font-medium">€ {fmt(tollTotal)}</span>
                                </div>
                            )}
                            <div className="flex justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-b-lg">
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Totale stimato</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white">€ {fmt(totalCost)}</span>
                            </div>
                        </div>

                        <p className="text-xs text-slate-300 dark:text-slate-600 text-center">OpenStreetMap / OSRM</p>
                    </div>
                )}

                {error && (
                    <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded p-2">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{error}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
