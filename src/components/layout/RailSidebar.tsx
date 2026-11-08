"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from "react"
import {
  LayoutDashboard, Package, ClipboardList, BarChart3, Settings, ShoppingCart, Truck, Users, Building2, HardHat,
  Calendar, FileText, ShieldCheck, GanttChartSquare, UserCircle, LogOut, Wrench, Briefcase,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useAuth } from "@/components/auth-provider"
import { NotificationBell } from "./NotificationBell"
import { inventoryApi } from "@/lib/services/inventory"
import { countExpiredTrash } from "@/lib/services/trash"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

// Geometria del menu (px)
const W0 = 72 // larghezza a riposo: sole icone
const W1 = 288 // larghezza aperta
const HEAD = 64 // testata con il logo
const FOOT = 16 // margine in fondo
const RH = 38 // altezza di una voce
const GAP = 10 // spazio tra gruppi di voci
const R = 26 // raggio dello scavo attorno alla voce evidenziata
const FR = 12 // raggio dei raccordi
const CR = 18 // raggio degli angoli del menu
const BUB = 40 // diametro della bolla

interface Item {
  key: string
  label: string
  icon: ComponentType<{ className?: string }>
  href: string
  active: boolean
}

const rectPath = (w: number, h: number) =>
  `M${CR},0 H${w - CR} A${CR},${CR} 0 0 1 ${w},${CR} V${h - CR} A${CR},${CR} 0 0 1 ${w - CR},${h} H${CR} A${CR},${CR} 0 0 1 0,${h - CR} V${CR} A${CR},${CR} 0 0 1 ${CR},0 Z`

// Contorno del menu con lo scavo a capsula centrato in cy: da cx verso il bordo destro.
// A riposo cx è vicino al bordo (lo scavo diventa una tacca tonda), aperto arriva fino all'icona.
function panelPath(w: number, h: number, cx: number, cy: number) {
  const top = cy - R
  const bot = cy + R
  return (
    `M${CR},0 H${w - CR} A${CR},${CR} 0 0 1 ${w},${CR} V${top - FR} ` +
    `A${FR},${FR} 0 0 1 ${w - FR},${top} H${cx} A${R},${R} 0 0 0 ${cx},${bot} H${w - FR} ` +
    `A${FR},${FR} 0 0 1 ${w},${bot + FR} V${h - CR} A${CR},${CR} 0 0 1 ${w - CR},${h} H${CR} ` +
    `A${CR},${CR} 0 0 1 0,${h - CR} V${CR} A${CR},${CR} 0 0 1 ${CR},0 Z`
  )
}

// Il fondo pieno dello scavo: la capsula intera, così le etichette si leggono sempre
const slotPath = (w: number, cx: number, cy: number) =>
  `M${cx},${cy - R} H${w} V${cy + R} H${cx} A${R},${R} 0 0 1 ${cx},${cy - R} Z`

// Il menu vive nel layout principale e resta montato tra una pagina e l'altra:
// le pagine lo "richiedono" con useRailRequest e così non si richiude al cambio pagina.
let railWanted = false
let railTimer: ReturnType<typeof setTimeout> | undefined
const railListeners = new Set<() => void>()
// Larghezza attuale del menu (animata): la barra in alto parte sempre dal suo bordo destro
let railW = W0
const railWListeners = new Set<(w: number) => void>()
const setRail = (v: boolean) => { if (railWanted !== v) { railWanted = v; railListeners.forEach(l => l()) } }
export function useRailRequest(on: boolean) {
  useEffect(() => {
    if (!on) return
    clearTimeout(railTimer)
    setRail(true)
    return () => { railTimer = setTimeout(() => setRail(false), 400) }
  }, [on])
}
export function RailHost() {
  const wanted = useSyncExternalStore(
    cb => { railListeners.add(cb); return () => { railListeners.delete(cb) } },
    () => railWanted,
    () => false
  )
  return wanted ? <><TopBar /><RailSidebar /><ScrollPill /></> : null
}

function RailSidebar() {
  const pathname = usePathname()
  const { userRole, simulatedRole } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [vh, setVh] = useState(900)
  useEffect(() => {
    const f = () => setVh(window.innerHeight)
    f()
    window.addEventListener("resize", f)
    return () => window.removeEventListener("resize", f)
  }, [])

  const is = (...bases: string[]) => bases.some(b => pathname === b || pathname.startsWith(b + "/"))
  const staff = userRole === "admin" || userRole === "operativo"
  const groups: Item[][] = [
    [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", active: pathname === "/dashboard" }],
    [
      { key: "inventory", label: "Inventario", icon: Package, href: "/inventory", active: is("/inventory") && pathname !== "/inventory/verifica" },
      { key: "purchases", label: "Acquisti", icon: ShoppingCart, href: "/purchases", active: is("/purchases") },
      { key: "movements", label: "Movimentazione", icon: Truck, href: "/movements", active: is("/movements") },
      { key: "load-notes", label: "Note di carico", icon: ClipboardList, href: "/load-notes", active: is("/load-notes") },
    ],
    [
      { key: "workers", label: "Operai", icon: HardHat, href: "/workers", active: is("/workers") },
      { key: "attendance", label: "Presenze", icon: Calendar, href: "/attendance", active: is("/attendance") },
      { key: "cronoprogramma", label: "Cronoprogramma", icon: GanttChartSquare, href: "/cronoprogramma", active: is("/cronoprogramma") },
    ],
    ...(staff ? [[
      { key: "compliance", label: "Gestione conformità", icon: ShieldCheck, href: "/compliance", active: is("/compliance") },
      { key: "guest-sites", label: "Cantieri ospiti", icon: Building2, href: "/guest-sites", active: is("/guest-sites") },
    ]] : []),
    [
      { key: "jobs", label: "Commesse", icon: Briefcase, href: "/jobs", active: is("/jobs") },
      { key: "anagrafiche", label: "Committenti e fornitori", icon: Users, href: "/anagrafiche", active: is("/anagrafiche", "/clients", "/suppliers") },
      ...(staff ? [{ key: "proposals", label: "Offerte generali", icon: FileText, href: "/proposals", active: pathname === "/proposals" }] : []),
    ],
    ...(staff ? [[{ key: "report", label: "Report", icon: BarChart3, href: "/reports", active: is("/report-analisi", "/reports") }]] : []),
  ]
  const items = groups.flat()
  // Le voci si stringono se la finestra è bassa, così stanno tutte senza barra di scorrimento
  const availH = vh - (simulatedRole ? 48 : 8) - 8 - HEAD - FOOT - GAP * (groups.length - 1)
  const rh = Math.max(28, Math.min(RH, Math.floor(availH / items.length)))
  const rhRef = useRef(rh)
  rhRef.current = rh
  const ys: number[] = []
  let acc = 0
  groups.forEach((g, gi) => {
    g.forEach(() => { ys.push(acc); acc += rh })
    if (gi < groups.length - 1) acc += GAP
  })
  const listHeight = acc
  const activeIdx = items.findIndex(i => i.active)
  // Lo scavo segue il mouse quando il menu è aperto, altrimenti sta sulla pagina in cui si è
  const holeIdx = expanded && hoverIdx !== null ? hoverIdx : activeIdx
  const HoleIcon = holeIdx >= 0 ? items[holeIdx].icon : null

  const panelRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const slotRef = useRef<SVGPathElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const anim = useRef({ w: W0, cx: W0 - FR, cy: -200, my: -999, lastMy: -1 })
  const target = useRef({ w: W0, cx: W0 - FR, cy: -200 })
  const raf = useRef(0)
  const ysRef = useRef(ys)
  ysRef.current = ys

  const holeY = holeIdx >= 0 ? HEAD + ys[holeIdx] + rh / 2 - scrollTop : null
  target.current.w = expanded ? W1 : W0
  target.current.cx = expanded ? BUB / 2 + 16 : W0 - FR
  target.current.cy = holeY ?? -200

  const frame = useCallback(() => {
    raf.current = 0
    const a = anim.current
    const t = target.current
    const k = 0.11
    a.w += (t.w - a.w) * k
    const prevW = railW
    a.cx += (t.cx - a.cx) * k
    a.cy += (t.cy - a.cy) * (a.cy < -100 || t.cy < -100 ? 1 : 0.16)
    let moving = false
    if (Math.abs(t.w - a.w) < 0.3) a.w = t.w; else moving = true
    if (Math.abs(t.cx - a.cx) < 0.3) a.cx = t.cx; else moving = true
    if (Math.abs(t.cy - a.cy) < 0.3) a.cy = t.cy; else moving = true
    const panel = panelRef.current
    if (panel && pathRef.current && slotRef.current && svgRef.current && bubbleRef.current) {
      const h = panel.clientHeight
      const lo = HEAD - 6 + R
      const hi = h - FOOT + 6 - R
      const hasHole = t.cy > -100
      const cy = Math.min(Math.max(a.cy, lo), hi)
      panel.style.width = `${a.w}px`
      if (a.w !== prevW) { railW = a.w; railWListeners.forEach(f => f(a.w)) }
      svgRef.current.setAttribute("width", String(a.w))
      svgRef.current.setAttribute("height", String(h))
      pathRef.current.setAttribute("d", hasHole ? panelPath(a.w, h, a.cx, cy) : rectPath(a.w, h))
      slotRef.current.setAttribute("d", hasHole ? slotPath(a.w, a.cx, cy) : "")
      bubbleRef.current.style.transform = `translate(${a.cx - BUB / 2}px, ${cy - BUB / 2}px)`
      bubbleRef.current.style.opacity = hasHole ? "1" : "0"
      // Effetto zoom: le voci vicine al mouse crescono, quelle lontane si rimpiccioliscono
      const open = a.w > 140
      if (open && a.my > -900) {
        const st = navRef.current?.scrollTop ?? 0
        rowRefs.current.forEach((row, i) => {
          if (!row) return
          const rowY = HEAD + ysRef.current[i] + rhRef.current / 2 - st
          const d = (rowY - a.my) / 75
          row.style.transform = `scale(${(0.88 + 0.3 * Math.exp(-d * d)).toFixed(3)})`
        })
      } else if (a.lastMy !== -999 || !open) {
        rowRefs.current.forEach(row => { if (row) row.style.transform = "" })
      }
      a.lastMy = open ? a.my : -999
    }
    if (moving) raf.current = requestAnimationFrame(frame)
  }, [])
  const kick = useCallback(() => { if (!raf.current) raf.current = requestAnimationFrame(frame) }, [frame])

  // Qualsiasi cambio di bersaglio rimette in moto l'animazione, che poi si ferma da sola
  useEffect(() => { kick() }, [expanded, holeIdx, scrollTop, kick, listHeight])
  useEffect(() => () => { cancelAnimationFrame(raf.current); railW = W0; railWListeners.forEach(f => f(W0)) }, [])

  const close = () => {
    setExpanded(false)
    setHoverIdx(null)
    anim.current.my = -999
    kick()
  }
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const top = e.currentTarget.getBoundingClientRect().top
    const my = e.clientY - top
    anim.current.my = my
    const st = navRef.current?.scrollTop ?? 0
    let idx: number | null = null
    if (my >= HEAD && my <= e.currentTarget.clientHeight - FOOT) {
      let best = Infinity
      ys.forEach((y, i) => {
        const d = Math.abs(HEAD + y + rh / 2 - st - my)
        if (d < best) { best = d; idx = i }
      })
    }
    setHoverIdx(prev => (prev === idx ? prev : idx))
    kick()
  }

  const top = simulatedRole ? 48 : 8

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-50 hidden h-screen w-20 lg:block">
      <div
        ref={panelRef}
        className="pointer-events-auto absolute bottom-2 left-2"
        style={{ width: W0, top, ["--color-sidebar-foreground" as string]: "#e2e8f0" }}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={close}
        onMouseMove={onMove}
        onFocus={() => setExpanded(true)}
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close() }}
      >
        <svg ref={svgRef} className="absolute left-0 top-0 overflow-visible" aria-hidden="true">
          <path ref={slotRef} className="fill-background" />
          <path ref={pathRef} className="fill-slate-800 stroke-white/10 dark:fill-slate-800" />
        </svg>

        {/* Bolla della voce evidenziata */}
        <div
          ref={bubbleRef}
          className="pointer-events-none absolute left-0 top-0 z-20 flex items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_0_0_6px_var(--background)]"
          style={{ width: BUB, height: BUB }}
          aria-hidden="true"
        >
          {HoleIcon && <HoleIcon className="h-5 w-5" />}
        </div>

        {/* Testata */}
        <Link href="/dashboard" className="absolute left-0 top-0 z-10 flex items-center" style={{ height: HEAD }} title="OPI Firesafe">
          <span className="flex shrink-0 items-center justify-center" style={{ width: W0 }}>
            <Image src="/icons/flame.png" alt="OPI Firesafe" width={34} height={34} className="h-[34px] w-[34px] object-contain" priority />
          </span>
          <span className={cn("whitespace-nowrap text-sm font-semibold text-white transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}>OPI Firesafe</span>
        </Link>

        {/* Voci */}
        <div
          ref={navRef}
          className="absolute inset-x-0 z-10 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ top: HEAD, bottom: FOOT }}
          onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
        >
          <div className="relative" style={{ height: listHeight }}>
            {items.map((it, i) => {
              const inHole = i === holeIdx
              return (
                <Link
                  key={it.key}
                  href={it.href}
                  prefetch={false}
                  title={expanded ? undefined : it.label}
                  aria-label={it.label}
                  aria-current={it.active ? "page" : undefined}
                  ref={el => { rowRefs.current[i] = el }}
                  className={cn(
                    "absolute left-0 flex origin-left items-center whitespace-nowrap text-sm outline-none",
                    inHole ? "font-semibold text-sidebar-accent" : it.active ? "font-semibold text-red-300" : "text-slate-300 hover:text-white"
                  )}
                  style={{ top: ys[i], height: rh, width: W1 }}
                >
                  <span className="flex shrink-0 items-center justify-center" style={{ width: W0 }}>
                    <it.icon className={cn("h-5 w-5 transition-opacity", inHole && "opacity-0")} />
                  </span>
                  <span className={cn("pr-4 transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}>{it.label}</span>
                </Link>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

// Barra in alto a destra: una linea sottile che da sinistra si allarga con una curva dolce
// fino a fare spazio a ora, campanella e profilo
const BAND_W = 250
const CURVE_W = 150
const BAND_H = 54
const LINE_H = 15
const CAP_R = CR + 5 // raggio dell'incavo che segue l'angolo del menu

function TopBar() {
  const pathname = usePathname()
  const { user, signOut, userRole, fullName, simulatedRole } = useAuth()
  const [now, setNow] = useState<Date | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  // Il punto di partenza della linea si sposta insieme al menu quando si apre e si chiude
  useEffect(() => {
    const f = (w: number) => { if (barRef.current) barRef.current.style.paddingLeft = `${w + 8 - CR}px` }
    railWListeners.add(f)
    f(railW)
    return () => { railWListeners.delete(f) }
  }, [])

  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Avvisi sulla voce Strumenti admin: articoli da verificare e anomalie
  const [alerts, setAlerts] = useState(0)
  useEffect(() => {
    if (userRole !== "admin") return
    let cancelled = false
    const check = () => {
      Promise.all([inventoryApi.getUnverifiedCount(), inventoryApi.getNegativeLotMovements(), inventoryApi.getOrphanedJobReferences(), countExpiredTrash(supabase)])
        .then(([unverified, negative, orphaned, expired]) => { if (!cancelled) setAlerts(unverified + negative.length + orphaned.length + expired) })
        .catch(err => console.error("Failed to load alerts", err))
    }
    check()
    const t = setInterval(check, 60000)
    return () => { cancelled = true; clearInterval(t) }
  }, [userRole])

  if (!user) return null

  const is = (...bases: string[]) => bases.some(b => pathname === b || pathname.startsWith(b + "/"))
  const inAdminPages = is("/settings", "/strumenti", "/analytics", "/anomalie", "/controllo-acquisti", "/schede-varianti", "/confezioni", "/cestino") || pathname === "/inventory/verifica"
  const time = now ? now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : ""
  const cw = CURVE_W
  // la curva è 2px più larga e si sovrappone alla linea e alla fascia: niente fessura chiara tra i pezzi
  const sw = cw + 2
  // Estremità sinistra della linea: un incavo che segue l'angolo in alto a destra del menu, senza sovrapporsi
  const capCy = 8 + CR
  const capDx = Math.sqrt(CAP_R ** 2 - (capCy - LINE_H) ** 2)
  const capTop = capCy - CAP_R
  const cap = `M0,0 H${CAP_R + 1} V${LINE_H} H${capDx} A${CAP_R},${CAP_R} 0 0 0 0,${capTop} Z`
  const curve = `M0,0 H${sw} V${BAND_H} C${sw * 0.55},${BAND_H} ${sw * 0.45},${LINE_H} 0,${LINE_H} Z`

  return (
    <div ref={barRef} className="pointer-events-none absolute left-0 right-0 z-40 hidden lg:block" style={{ top: simulatedRole ? 40 : 0, paddingLeft: railW + 8 - CR }}>
      <div className="flex items-start">
        <svg width={CAP_R + 1} height={LINE_H} className="shrink-0 fill-slate-800" aria-hidden="true"><path d={cap} /></svg>
        <div className="flex-1 bg-slate-800" style={{ height: LINE_H }} />
        <svg width={sw} height={BAND_H} className="shrink-0 fill-slate-800" style={{ marginLeft: -1, marginRight: -1 }} aria-hidden="true"><path d={curve} /></svg>
        <div className="pointer-events-auto flex shrink-0 items-center justify-end gap-4 bg-slate-800 pr-5 text-white" style={{ width: BAND_W, height: BAND_H }}>
          <div className="flex items-center gap-2" role="timer" aria-label={`Ore ${time}`}>
            <FlipPair value={time.slice(0, 2)} />
            <FlipPair value={time.slice(3, 5)} />
          </div>
          <span className="[&_button]:!text-slate-200"><NotificationBell /></span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" title={fullName || user.email || "Profilo"} className="relative rounded-full outline-none">
                <Avatar className={cn("h-9 w-9", inAdminPages && "ring-2 ring-sidebar-accent ring-offset-2 ring-offset-slate-800")}>
                  <AvatarImage src={`/avatars/${userRole || "user"}.png`} />
                  <AvatarFallback>{(fullName || user.email || "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                {alerts > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" sideOffset={8} className="w-60">
              <DropdownMenuLabel className="font-normal">
                <span className="block truncate text-sm font-medium">{fullName || user.email}</span>
                <span className="block truncate text-xs capitalize text-muted-foreground">{user.email} · {userRole || "User"}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link href="/settings/profile"><UserCircle className="mr-2 h-4 w-4" />Vai al profilo</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2 h-4 w-4" />Impostazioni</Link></DropdownMenuItem>
              {userRole === "admin" && (
                <DropdownMenuItem asChild>
                  <Link href="/strumenti">
                    <Wrench className="mr-2 h-4 w-4" />Strumenti admin
                    {alerts > 0 && <span className="ml-auto h-2 w-2 rounded-full bg-red-500" aria-label="Elementi da controllare" />}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Esci</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}

// ── Orologio a pannelli girevoli (stile tabellone di aeroporto) ──
function FlipPair({ value }: { value: string }) {
  const v = value.padEnd(2, "0")
  return (
    <div className="flex gap-[3px]">
      <FlipDigit value={v[0]} />
      <FlipDigit value={v[1]} />
    </div>
  )
}

function FlipHalf({ d, bottom, className, onAnimationEnd }: { d: string; bottom?: boolean; className?: string; onAnimationEnd?: () => void }) {
  return (
    <div onAnimationEnd={onAnimationEnd} className={cn("absolute inset-x-0 overflow-hidden", bottom ? "bottom-0 h-1/2 rounded-b-[4px] bg-neutral-800" : "top-0 h-1/2 rounded-t-[4px] border-b border-black bg-neutral-900", className)}>
      <div className={cn("absolute inset-x-0 flex h-[200%] items-center justify-center text-[22px] font-bold leading-none text-white", bottom ? "-top-full" : "top-0")}>{d}</div>
    </div>
  )
}

function FlipDigit({ value }: { value: string }) {
  const [prev, setPrev] = useState(value)
  const [cur, setCur] = useState(value)

  useEffect(() => {
    if (value !== cur) {
      setPrev(cur)
      setCur(value)
    }
  }, [value, cur])

  const flipping = prev !== cur
  return (
    <div className="relative h-9 w-6 [perspective:200px]" aria-hidden="true">
      <FlipHalf d={cur} />
      <FlipHalf d={prev} bottom />
      {flipping && (
        <>
          <FlipHalf key={`t${cur}`} d={prev} className="flip-leaf-top z-10 [backface-visibility:hidden]" />
          <FlipHalf key={`b${cur}`} d={cur} bottom onAnimationEnd={() => setPrev(cur)} className="flip-leaf-bottom z-10 [backface-visibility:hidden]" />
        </>
      )}
    </div>
  )
}

// Indicatore di scorrimento sovrapposto: linea sottile con una pillola che sale e scende
// e sparisce poco dopo lo scorrimento. La scrollbar vera è nascosta, così la pagina non "scatta".
function ScrollPill() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    const update = (show: boolean) => {
      const wrap = wrapRef.current
      const pill = pillRef.current
      if (!wrap || !pill) return
      const el = document.documentElement
      const max = el.scrollHeight - el.clientHeight
      if (max <= 2) { wrap.style.opacity = "0"; return }
      const track = wrap.clientHeight
      const h = Math.max(36, Math.round((el.clientHeight / el.scrollHeight) * track))
      const y = Math.round((window.scrollY / max) * (track - h))
      pill.style.height = `${h}px`
      pill.style.transform = `translateY(${y}px)`
      if (show) {
        wrap.style.opacity = "1"
        clearTimeout(hideTimer)
        hideTimer = setTimeout(() => { wrap.style.opacity = "0" }, 900)
      }
    }
    const onScroll = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => update(true)) }
    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      cancelAnimationFrame(frame)
      clearTimeout(hideTimer)
    }
  }, [])

  return (
    <div ref={wrapRef} className="pointer-events-none fixed bottom-3 right-1.5 top-16 z-[45] w-1.5 opacity-0 transition-opacity duration-300" aria-hidden="true">
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-400/40" />
      <div ref={pillRef} className="absolute inset-x-0 top-0 rounded-full bg-slate-700" />
    </div>
  )
}
