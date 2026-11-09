"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMobileSearch } from "./mobile-actions"

interface Hit { cat: string; id: string; title: string; subtitle?: string; href: string }
interface Category { key: string; label: string }

// Ricerca unica da telefono: scrivi e i risultati compaiono divisi per categoria, i chip restringono a una sola
export function MobileSearchSheet({ onClose }: { onClose: () => void }) {
  const open = true
  const onOpenChange = (_: boolean) => onClose()
  const router = useRouter()
  const mobile = useMobileSearch()
  const pageSearch = mobile?.searchInfo ?? null
  // Se la pagina ha una sua ricerca si parte da quella, altrimenti dalla ricerca su tutto
  const [tab, setTab] = useState<"page" | "all">("all")
  const [query, setQuery] = useState("")
  const [cat, setCat] = useState<string | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [results, setResults] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  // Ogni apertura parte dalla ricerca della pagina, se c'e'
  useEffect(() => {
    if (open) setTab(pageSearch ? "page" : "all")
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pageSearch) setTab("all")
  }, [pageSearch])

  // Ogni apertura riparte pulita
  useEffect(() => {
    if (open) return
    setQuery("")
    setCat(null)
    setResults([])
    setError(false)
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q })
        if (cat) params.set("cat", cat)
        const res = await fetch(`/api/search?${params}`, { signal: controller.signal })
        if (!res.ok) throw new Error(String(res.status))
        const data = await res.json()
        setCategories(data.categories ?? [])
        setResults(data.results ?? [])
        setError(false)
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError(true)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query, cat, open])

  const groups = useMemo(() => {
    const map = new Map<string, Hit[]>()
    for (const r of results) map.set(r.cat, [...(map.get(r.cat) ?? []), r])
    return Array.from(map.entries())
  }, [results])
  const labelOf = (key: string) => categories.find(c => c.key === key)?.label ?? key

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  const chip = (active: boolean) =>
    cn("shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
      active ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-200 active:bg-slate-600")

  // Pannello che sale dalla barra: stessa tinta scura, il tasto Cerca diventa Chiudi
  return (
    <div className="relative -mb-[22px] flex max-h-[calc(100dvh-9rem)] flex-col gap-3 rounded-t-3xl bg-slate-800 px-3 pb-[34px] pt-4 text-slate-100 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] animate-in slide-in-from-bottom-6 fade-in duration-200">
      {pageSearch && (
        <div className="flex gap-2">
          <button type="button" className={chip(tab === "page")} onClick={() => setTab("page")}>{pageSearch.title}</button>
          <button type="button" className={chip(tab === "all")} onClick={() => setTab("all")}>Cerca ovunque</button>
        </div>
      )}

      {tab === "page" && pageSearch ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl bg-card p-3 text-card-foreground">
            <div ref={mobile?.setSearchSlot} />
          </div>
          <button type="button" onClick={onClose} className="h-11 w-full shrink-0 rounded-full bg-blue-600 text-sm font-semibold text-white active:bg-blue-700">
            Mostra i risultati
          </button>
        </>
      ) : (
        <>
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Cerca articoli, commesse, operai..."
              aria-label="Cerca"
              className="h-11 w-full rounded-full border border-slate-300 bg-white pl-10 pr-4 text-base text-slate-800 outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          {categories.length > 0 && (
            <div className="-mx-3 flex shrink-0 gap-2 overflow-x-auto px-3 scrollbar-hide">
              <button type="button" className={chip(cat === null)} onClick={() => setCat(null)}>Tutto</button>
              {categories.map(c => (
                <button key={c.key} type="button" className={chip(cat === c.key)} onClick={() => setCat(c.key)}>{c.label}</button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl bg-card text-card-foreground">
            {loading && results.length === 0 && (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /></div>
            )}
            {!loading && !query.trim() && (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">Scrivi il nome, il codice o il numero che cerchi.</p>
            )}
            {!loading && query.trim() && !error && results.length === 0 && (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">Nessun risultato.</p>
            )}
            {error && <p className="px-6 py-8 text-center text-sm text-red-500">Ricerca non riuscita. Riprova.</p>}

            {groups.map(([key, hits]) => (
              <section key={key}>
                <h3 className="sticky top-0 z-10 bg-slate-100 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {labelOf(key)}
                </h3>
                <ul className="divide-y">
                  {hits.map(h => (
                    <li key={`${h.cat}-${h.id}`}>
                      <button type="button" onClick={() => go(h.href)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-100 dark:active:bg-slate-800">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{h.title}</span>
                          {h.subtitle && <span className="block truncate text-xs text-muted-foreground">{h.subtitle}</span>}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                      </button>
                    </li>
                  ))}
                </ul>
                {!cat && hits.length >= 5 && (
                  <button type="button" onClick={() => setCat(key)} className="w-full px-4 py-2 text-left text-xs font-medium text-blue-600">
                    Mostra tutti in {labelOf(key)}
                  </button>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
