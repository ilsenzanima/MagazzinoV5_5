"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState, type ComponentType } from "react"
import {
  LayoutDashboard, Package, ClipboardList, BarChart3, Settings, ShoppingCart, Truck, Users, Building2, HardHat,
  Calendar, FileText, ShieldCheck, GanttChartSquare, UserCircle, LogOut, Wrench, Briefcase,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/components/auth-provider"
import { NotificationBell } from "./NotificationBell"
import { inventoryApi } from "@/lib/services/inventory"
import { cn } from "@/lib/utils"

// Geometria del menu (px)
const W0 = 72 // larghezza a riposo: sole icone
const W1 = 264 // larghezza aperta
const HEAD = 64 // testata con il logo
const FOOT = 112 // piede con campanella e profilo
const RH = 38 // altezza di una voce
const GAP = 10 // spazio tra gruppi di voci
const R = 26 // raggio dello scavo attorno alla voce attiva
const FR = 12 // raggio dei raccordi
const CR = 18 // raggio degli angoli del menu
const BUB = 40 // diametro della bolla

interface Item {
  key: string
  label: string
  icon: ComponentType<{ className?: string }>
  href: string
  active: boolean
  badge?: boolean
}

// Contorno del menu con lo scavo a capsula centrato in cy: da cx verso il bordo destro.
// A riposo cx è vicino al bordo (lo scavo diventa una tacca tonda), aperto arriva fino all'icona.
function panelPath(w: number, h: number, cx: number, cy: number | null) {
  if (cy === null) return `M${CR},0 H${w - CR} A${CR},${CR} 0 0 1 ${w},${CR} V${h - CR} A${CR},${CR} 0 0 1 ${w - CR},${h} H${CR} A${CR},${CR} 0 0 1 0,${h - CR} V${CR} A${CR},${CR} 0 0 1 ${CR},0 Z`
  const top = cy - R
  const bot = cy + R
  return (
    `M${CR},0 H${w - CR} A${CR},${CR} 0 0 1 ${w},${CR} V${top - FR} ` +
    `A${FR},${FR} 0 0 1 ${w - FR},${top} H${cx} A${R},${R} 0 0 0 ${cx},${bot} H${w - FR} ` +
    `A${FR},${FR} 0 0 1 ${w},${bot + FR} V${h - CR} A${CR},${CR} 0 0 1 ${w - CR},${h} H${CR} ` +
    `A${CR},${CR} 0 0 1 0,${h - CR} V${CR} A${CR},${CR} 0 0 1 ${CR},0 Z`
  )
}

export function RailSidebar() {
  const pathname = usePathname()
  const { user, signOut, userRole, fullName } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const locked = useRef(false)

  // Avvisi sulla voce Strumenti admin: articoli da verificare e anomalie
  const [alerts, setAlerts] = useState(0)
  useEffect(() => {
    if (userRole !== "admin") return
    let cancelled = false
    const check = () => {
      Promise.all([inventoryApi.getUnverifiedCount(), inventoryApi.getNegativeLotMovements(), inventoryApi.getOrphanedJobReferences()])
        .then(([unverified, negative, orphaned]) => { if (!cancelled) setAlerts(unverified + negative.length + orphaned.length) })
        .catch(err => console.error("Failed to load alerts", err))
    }
    check()
    const t = setInterval(check, 60000)
    return () => { cancelled = true; clearInterval(t) }
  }, [userRole])

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
    [{ key: "report", label: "Report e analisi", icon: BarChart3, href: "/report-analisi", active: is("/report-analisi", "/reports", "/analytics") }],
    ...(userRole === "admin" ? [[
      {
        key: "strumenti", label: "Strumenti admin", icon: Wrench, href: "/strumenti", badge: alerts > 0,
        active: is("/strumenti", "/anomalie", "/controllo-acquisti", "/schede-varianti", "/confezioni", "/cestino") || pathname === "/inventory/verifica",
      },
    ]] : []),
    [{ key: "settings", label: "Impostazioni", icon: Settings, href: "/settings", active: is("/settings") }],
  ]
  const items = groups.flat()
  const ys: number[] = []
  let acc = 0
  groups.forEach((g, gi) => {
    g.forEach(() => { ys.push(acc); acc += RH })
    if (gi < groups.length - 1) acc += GAP
  })
  const listHeight = acc
  const activeIdx = items.findIndex(i => i.active)
  const ActiveIcon = activeIdx >= 0 ? items[activeIdx].icon : null

  const panelRef = useRef<HTMLDivElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const anim = useRef({ w: W0, cx: W0 - FR, cy: -200, my: -999 })
  const target = useRef({ w: W0, cx: W0 - FR, cy: -200 })

  // Dove sta lo scavo (coordinate del menu), tenendo conto dello scorrimento dell'elenco
  const activeY = activeIdx >= 0 ? HEAD + ys[activeIdx] + RH / 2 - scrollTop : null
  target.current.w = expanded ? W1 : W0
  target.current.cx = expanded ? BUB / 2 + 16 : W0 - FR
  if (activeY !== null) target.current.cy = activeY

  useEffect(() => {
    let raf = 0
    const frame = () => {
      const a = anim.current
      const t = target.current
      a.w += (t.w - a.w) * 0.2
      a.cx += (t.cx - a.cx) * 0.2
      a.cy += (t.cy - a.cy) * (a.cy < -100 ? 1 : 0.28)
      if (Math.abs(t.w - a.w) < 0.3) a.w = t.w
      if (Math.abs(t.cx - a.cx) < 0.3) a.cx = t.cx
      if (Math.abs(t.cy - a.cy) < 0.3) a.cy = t.cy
      const panel = panelRef.current
      if (panel && pathRef.current && svgRef.current && bubbleRef.current) {
        const h = panel.clientHeight
        const lo = HEAD - 6 + R
        const hi = h - FOOT + 6 - R
        const hasActive = target.current.cy > -100
        const cy = Math.min(Math.max(a.cy, lo), hi)
        panel.style.width = `${a.w}px`
        svgRef.current.setAttribute("width", String(a.w))
        svgRef.current.setAttribute("height", String(h))
        pathRef.current.setAttribute("d", panelPath(a.w, h, a.cx, hasActive ? cy : null))
        bubbleRef.current.style.transform = `translate(${a.cx - BUB / 2}px, ${cy - BUB / 2}px)`
        bubbleRef.current.style.opacity = hasActive ? "1" : "0"
        // Effetto zoom: le voci vicine al mouse crescono, quelle lontane si rimpiccioliscono
        const open = a.w > 140
        rowRefs.current.forEach((row, i) => {
          if (!row) return
          let s = 1
          if (open && a.my > -900) {
            const rowY = HEAD + ys[i] + RH / 2 - (navRef.current?.scrollTop ?? 0)
            const d = (rowY - a.my) / 75
            s = 0.88 + 0.3 * Math.exp(-d * d)
          }
          row.style.transform = `scale(${s.toFixed(3)})`
        })
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const open = () => { if (!locked.current) setExpanded(true) }
  const close = () => { setExpanded(false); locked.current = false; anim.current.my = -999 }
  const pick = () => { locked.current = true; setExpanded(false); anim.current.my = -999 }

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-50 hidden h-screen w-20 lg:block">
      <div
        ref={panelRef}
        className="pointer-events-auto absolute bottom-2 left-2 top-2"
        style={{ width: W0 }}
        onMouseEnter={open}
        onMouseLeave={close}
        onMouseMove={e => { anim.current.my = e.clientY - e.currentTarget.getBoundingClientRect().top }}
        onFocus={open}
        onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close() }}
      >
        <svg ref={svgRef} className="absolute left-0 top-0 overflow-visible drop-shadow-[0_4px_14px_rgba(15,23,42,0.18)]" aria-hidden="true">
          <path ref={pathRef} className="fill-sidebar" />
        </svg>

        {/* Bolla della voce attiva */}
        <div
          ref={bubbleRef}
          className="pointer-events-none absolute left-0 top-0 z-20 flex items-center justify-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground shadow-md"
          style={{ width: BUB, height: BUB }}
          aria-hidden="true"
        >
          {ActiveIcon && <ActiveIcon className="h-5 w-5" />}
        </div>

        {/* Testata */}
        <Link href="/dashboard" onClick={pick} className="absolute left-0 top-0 z-10 flex items-center" style={{ height: HEAD }} title="OPI Firesafe">
          <span className="flex items-center justify-center" style={{ width: W0 }}>
            <Image src="/icons/flame.png" alt="OPI Firesafe" width={34} height={34} className="h-[34px] w-[34px] object-contain" priority />
          </span>
          <span className={cn("whitespace-nowrap text-sm font-semibold text-sidebar-foreground transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}>OPI Firesafe</span>
        </Link>

        {/* Voci */}
        <div
          ref={navRef}
          className="absolute inset-x-0 z-10 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ top: HEAD, bottom: FOOT }}
          onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
        >
          <div className="relative" style={{ height: listHeight }}>
            {items.map((it, i) => (
              <Link
                key={it.key}
                href={it.href}
                prefetch={false}
                onClick={pick}
                title={expanded ? undefined : it.label}
                aria-label={it.label}
                aria-current={it.active ? "page" : undefined}
                ref={el => { rowRefs.current[i] = el }}
                className={cn(
                  "absolute left-0 flex origin-left items-center whitespace-nowrap text-sm outline-none will-change-transform",
                  it.active ? "font-semibold text-sidebar-accent" : "text-sidebar-foreground/75 hover:text-sidebar-foreground"
                )}
                style={{ top: ys[i], height: RH, width: W1 }}
              >
                <span className="relative flex shrink-0 items-center justify-center" style={{ width: W0 }}>
                  <it.icon className={cn("h-5 w-5 transition-opacity", it.active && "opacity-0")} />
                  {it.badge && <span className="absolute right-5 top-0 h-2 w-2 rounded-full bg-red-500" aria-hidden="true" />}
                </span>
                <span className={cn("pr-4 transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}>{it.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Piede: campanella e profilo */}
        {user && (
          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end pb-2" style={{ height: FOOT }}>
            <div className="flex items-center" style={{ height: 44 }}>
              <span className="flex items-center justify-center" style={{ width: W0 }}><NotificationBell onNavigate={pick} /></span>
              <span className={cn("whitespace-nowrap text-sm text-sidebar-foreground/75 transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}>Notifiche</span>
            </div>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              title={expanded ? undefined : (fullName || user.email || "Profilo")}
              className="flex items-center text-left outline-none"
              style={{ height: 48 }}
            >
              <span className="flex items-center justify-center" style={{ width: W0 }}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`/avatars/${userRole || "user"}.png`} />
                  <AvatarFallback>{(fullName || user.email || "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </span>
              <span className={cn("min-w-0 pr-3 transition-opacity duration-200", expanded ? "opacity-100" : "opacity-0")}>
                <span className="block max-w-[170px] truncate text-sm font-medium text-sidebar-foreground">{fullName || user.email}</span>
                <span className="block text-xs capitalize text-sidebar-foreground/60">{userRole || "User"}</span>
              </span>
            </button>
          </div>
        )}
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="pointer-events-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={`/avatars/${userRole || "user"}.png`} />
                <AvatarFallback>{(fullName || user?.email || "?").charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="flex flex-col">
                <span>{fullName || user?.email}</span>
                <span className="text-xs font-normal capitalize text-muted-foreground">{userRole || "User"}</span>
              </span>
            </DialogTitle>
            <DialogDescription>{user?.email}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Link href="/settings/profile" onClick={() => setProfileOpen(false)} className="w-full">
              <Button variant="outline" className="w-full justify-start"><UserCircle className="mr-2 h-4 w-4" />Vai al profilo</Button>
            </Link>
            <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={() => { setProfileOpen(false); signOut() }}>
              <LogOut className="mr-2 h-4 w-4" />Esci
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
