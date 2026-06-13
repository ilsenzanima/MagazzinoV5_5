"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, MapPin, Navigation, AlertCircle } from "lucide-react"
import { warehousesApi } from "@/lib/services/warehouses"
import type { Warehouse } from "@/lib/types"

interface Props {
    siteAddress: string // indirizzo destinazione già formattato
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
    const url = `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=false`
    const res = await fetch(url)
    const data = await res.json()
    if (data.code !== "Ok" || !data.routes?.length) throw new Error("Percorso non trovato")
    const route = data.routes[0]
    return {
        distanceKm: Math.round(route.distance / 100) / 10,
        durationMin: Math.round(route.duration / 60),
    }
}

export function ProposalDistanza({ siteAddress }: Props) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([])
    const [selectedId, setSelectedId] = useState<string>("")
    const [result, setResult] = useState<RouteResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fromAddr, setFromAddr] = useState<string>("")
    const [loadingWh, setLoadingWh] = useState(true)

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
        setResult(null)
        setError(null)
    }, [selectedId, warehouses])

    const calculate = async () => {
        if (!fromAddr || !siteAddress) return
        setLoading(true)
        setError(null)
        setResult(null)
        try {
            const [coordFrom, coordTo] = await Promise.all([geocode(fromAddr), geocode(siteAddress)])
            if (!coordFrom) { setError(`Indirizzo di partenza non trovato: "${fromAddr}"`); return }
            if (!coordTo) { setError(`Indirizzo cantiere non trovato: "${siteAddress}"`); return }
            setResult(await calcRoute(coordFrom, coordTo))
        } catch (e: any) {
            setError(e.message || "Errore nel calcolo del percorso")
        } finally {
            setLoading(false)
        }
    }

    const formatDuration = (min: number) => {
        const h = Math.floor(min / 60)
        const m = min % 60
        return h > 0 ? `${h}h ${m}min` : `${m} min`
    }

    if (loadingWh) return (
        <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
    )

    if (!siteAddress) return (
        <Card className="border-dashed">
            <CardContent className="py-12 text-center text-slate-500">
                <MapPin className="h-10 w-10 mx-auto mb-2 opacity-20" />
                <p>Imposta prima l&apos;indirizzo del cantiere nelle Info della proposta.</p>
            </CardContent>
        </Card>
    )

    return (
        <div className="max-w-lg space-y-4">
            <Card>
                <CardContent className="py-5 px-5 space-y-4">
                    {/* Partenza */}
                    <div className="space-y-1">
                        <label className="text-xs uppercase tracking-wide text-slate-500">Punto di partenza</label>
                        {warehouses.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">Nessun magazzino configurato</p>
                        ) : (
                            <Select value={selectedId} onValueChange={setSelectedId}>
                                <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Seleziona magazzino" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map(w => (
                                        <SelectItem key={w.id} value={w.id}>
                                            {w.name}{w.isPrimary ? " ★" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                        {fromAddr && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                                <MapPin className="h-3 w-3 shrink-0" />{fromAddr}
                            </p>
                        )}
                    </div>

                    {/* Destinazione */}
                    <div className="space-y-1">
                        <label className="text-xs uppercase tracking-wide text-slate-500">Destinazione (cantiere)</label>
                        <p className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-blue-500 shrink-0" />{siteAddress}
                        </p>
                    </div>

                    <Button
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        onClick={calculate}
                        disabled={loading || !fromAddr || warehouses.length === 0}
                    >
                        {loading
                            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Calcolo in corso...</>
                            : <><Navigation className="h-4 w-4 mr-2" />Calcola Percorso</>
                        }
                    </Button>
                </CardContent>
            </Card>

            {/* Risultato */}
            {result && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
                    <CardContent className="py-5 px-5">
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div>
                                <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{result.distanceKm}</p>
                                <p className="text-xs uppercase tracking-wide text-slate-500 mt-1">km (andata)</p>
                            </div>
                            <div>
                                <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{formatDuration(result.durationMin)}</p>
                                <p className="text-xs uppercase tracking-wide text-slate-500 mt-1">tempo stimato</p>
                            </div>
                        </div>
                        <p className="text-center text-xs text-slate-400 mt-4">
                            Andata e ritorno: <strong>{(result.distanceKm * 2).toFixed(1)} km</strong> · {formatDuration(result.durationMin * 2)}
                        </p>
                        <p className="text-center text-xs text-slate-300 dark:text-slate-600 mt-2">
                            Dati forniti da OpenStreetMap / OSRM
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Errore */}
            {error && (
                <Card className="border-red-200 dark:border-red-800">
                    <CardContent className="py-4 px-5 flex items-start gap-3 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <p>{error}</p>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
