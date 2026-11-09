"use client"

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { Search, Menu, Check } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { HelpTip } from "@/components/ui/help-tip"
import { PhoneSearchPortal, usePhone } from "@/components/layout/mobile-actions"

export interface NotchTabItem {
  value: string
  label: string
  icon: ReactNode
  // Colore della bolla quando la voce è attiva (default blu), es. "bg-amber-500"
  bubbleClass?: string
  // Pallino rosso di avviso sulla scheda
  dot?: boolean
}

interface NotchTabsProps {
  // Senza voci la striscia è una barra piatta con solo titolo, aiuto e pulsanti (pagine senza sotto-schede)
  items?: NotchTabItem[]
  value?: string
  onValueChange?: (value: string) => void
  // Nome della pagina, a sinistra nella striscia
  title?: ReactNode
  className?: string
  // Titolo sopra e tab centrati sotto (come in Strumenti admin), anche se ci sarebbe spazio per tenere tutto in una riga
  compact?: boolean
  // Larghezza massima di ogni voce (default 170)
  tabWidth?: number
  // Il contenuto delle schede: può mettere i pulsanti della scheda a destra nella striscia con <NotchActions>
  children?: ReactNode
}

// Geometria della barra (px)
const H = 68 // altezza della barra
const R = 38 // raggio della tacca
const CY = 4 // centro della tacca rispetto al bordo alto della barra
const FR = 14 // raggio del raccordo tra barra e tacca
const CR = 16 // raggio degli angoli della barra
const SPAN = Math.sqrt((R + FR) ** 2 - (FR - CY) ** 2) // distanza orizzontale centro tacca → inizio raccordo
const TAB_W = 170 // larghezza massima di ogni voce
const SIDE_MIN = 250 // spazio minimo a lato dei tab per titolo e pulsanti dentro la striscia

// Contorno della barra con la tacca centrata in x e i raccordi morbidi
function barGeometry(w: number, x: number) {
  const lo = CR + SPAN
  const hi = w - CR - SPAN
  const cx = Math.min(Math.max(x, lo), Math.max(lo, hi))
  const k = R / (R + FR)
  const ty = CY + k * (FR - CY)
  const tl = cx - k * SPAN
  const tr = cx + k * SPAN
  const large = ty < CY ? 1 : 0
  const d =
    `M${CR},0 H${cx - SPAN} A${FR},${FR} 0 0 1 ${tl},${ty} A${R},${R} 0 ${large} 0 ${tr},${ty} ` +
    `A${FR},${FR} 0 0 1 ${cx + SPAN},0 H${w - CR} A${CR},${CR} 0 0 1 ${w},${CR} V${H - CR} ` +
    `A${CR},${CR} 0 0 1 ${w - CR},${H} H${CR} A${CR},${CR} 0 0 1 0,${H - CR} V${CR} A${CR},${CR} 0 0 1 ${CR},0 Z`
  return { d, cx }
}

interface Slots { actions: HTMLElement | null; help: HTMLElement | null; title?: string }
const SlotsCtx = createContext<Slots>({ actions: null, help: null })
// Per le pagine che stanno dentro una pagina unita: leggono gli spazi della striscia (ricerca e pulsanti vanno lì)
export const useNotchSlots = () => useContext(SlotsCtx)
// Vero quando la pagina sta sotto la striscia di una pagina unita: la sua striscia piatta si avvicina a quella sopra
export const NestedStripCtx = createContext(false)

// Striscia di una pagina: se la pagina e' dentro un'altra striscia (embedded) ne usa la sua, mettendoci solo aiuto e pulsanti
export function PageStrip({ embedded, title, children }: { embedded?: boolean; title: ReactNode; children?: ReactNode }) {
  return embedded ? <>{children}</> : <NotchTabs title={title}>{children}</NotchTabs>
}

// Stile unico dei pulsanti nella striscia, uguale in ogni pagina
export function NotchButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      size="sm"
      variant="outline"
      className={cn("h-8 gap-1.5 rounded-full border-slate-300 bg-white px-4 text-slate-800 shadow-[0_3px_6px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-3px_4px_rgba(0,0,0,0.12)] transition-all hover:bg-slate-100 hover:text-slate-900 active:translate-y-px active:shadow-[0_1px_2px_rgba(0,0,0,0.35),inset_0_2px_4px_rgba(0,0,0,0.18)] [&_svg]:size-4 [&_svg]:text-blue-600", className)}
      {...props}
    />
  )
}

// Barra di ricerca a destra nella striscia. Fuori da <NotchTabs> resta una normale casella di ricerca nella pagina.
export function NotchSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { actions, title } = useContext(SlotsCtx)
  const phone = usePhone()
  // Telefono: la ricerca sta nel pannello «Cerca» della barra in basso, non nella pagina
  if (phone) {
    return (
      <PhoneSearchPortal title={title ?? "Questa pagina"}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-11 w-full rounded-full border border-slate-300 bg-white pl-10 pr-4 text-base text-slate-800 outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </PhoneSearchPortal>
    )
  }
  const field = (
    <div className={actions ? "relative w-52 max-w-full" : "relative min-w-[12rem] flex-1 sm:max-w-xs"}>
      <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        title={placeholder}
        className="h-9 w-full rounded-full border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-blue-400"
      />
    </div>
  )
  return actions ? createPortal(field, actions) : field
}

// Punto di domanda con l'elenco dei tipi inseribili: sta a sinistra, dopo il nome della pagina
export function NotchHelp(props: React.ComponentProps<typeof HelpTip>) {
  const { help } = useContext(SlotsCtx)
  return help ? createPortal(<HelpTip {...props} tone="inherit" />, help) : <HelpTip {...props} />
}

// Menu a tendina (hamburger) nella striscia, dopo il nome della pagina: una voce per ogni sotto-pagina
export function NotchMenu({ items, value, onValueChange, prefix, disabled, title, inline }: { items: { value: string; label: string; icon: ReactNode }[]; value: string; onValueChange: (v: string) => void; prefix?: string; disabled?: boolean; title?: string; inline?: boolean }) {
  const { help } = useContext(SlotsCtx)
  const current = items.find(i => i.value === value)
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={disabled} title={title} className={cn("inline-flex max-w-[18rem] items-center gap-2 rounded-full font-medium normal-case tracking-normal outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50", inline ? "h-10 bg-white px-4 text-sm text-slate-800 shadow-sm hover:bg-slate-50 dark:bg-card dark:text-white" : "ml-2 h-8 bg-white/10 px-3 text-xs text-white hover:bg-white/20")}>
          <Menu className="h-4 w-4 shrink-0" />
          <span className="truncate">{prefix && <span className={inline ? "text-slate-500" : "text-slate-300"}>{prefix} </span>}{current?.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {items.map(it => (
          <DropdownMenuItem key={it.value} onClick={() => onValueChange(it.value)} className="gap-2">
            <span className="[&_svg]:size-4">{it.icon}</span>
            <span className="flex-1">{it.label}</span>
            {it.value === value && <Check className="h-4 w-4 text-blue-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
  return help && !inline ? createPortal(menu, help) : menu
}

// Pulsanti della scheda mostrati a destra nella striscia dei tab. Fuori da <NotchTabs> si vedono dove sono scritti.
export function NotchActions({ children }: { children: ReactNode }) {
  const { actions } = useContext(SlotsCtx)
  return actions ? createPortal(children, actions) : <>{children}</>
}

// Striscia unica: nome della pagina a sinistra, tab con tacca animata al centro, pulsanti a destra.
// Se lo spazio non basta, titolo e pulsanti passano sopra la barra. Su telefono le voci non attive mostrano solo l'icona.
export function NotchTabs({ items = [], value = "", onValueChange, title, className, tabWidth = TAB_W, compact, children }: NotchTabsProps) {
  const nested = useContext(NestedStripCtx)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null)
  const [helpEl, setHelpEl] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState(0)
  const [x, setX] = useState(0)
  const xRef = useRef(0)
  const raf = useRef(0)
  const idx = Math.max(0, items.findIndex(i => i.value === value))

  const tw = Math.min(items.length * tabWidth, width)
  const sideRoom = (width - tw) / 2
  const inline = !compact && sideRoom >= SIDE_MIN
  const barW = inline ? width : tw
  const ox = inline ? sideRoom : 0
  const colW = items.length ? tw / items.length : 0

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!width) return
    const target = ox + (idx + 0.5) * colW
    if (xRef.current === 0) {
      xRef.current = target
      setX(target)
      return
    }
    cancelAnimationFrame(raf.current)
    const tick = () => {
      const d = target - xRef.current
      if (Math.abs(d) < 0.4) {
        xRef.current = target
        setX(target)
        return
      }
      xRef.current += d * 0.18
      setX(xRef.current)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [idx, width, colW, ox])

  const sideMax = inline ? Math.max(0, sideRoom - 24) : undefined
  const { d, cx } = barGeometry(barW, x)
  const slots: Slots = { actions: actionsEl, help: helpEl, title: typeof title === "string" ? title : undefined }
  const titleBlock = (
    <div className="pointer-events-auto flex min-w-0 items-center gap-1" style={{ maxWidth: items.length ? sideMax : undefined }}>
      <span className="truncate text-sm font-semibold uppercase tracking-wide">{title}</span>
      <span ref={setHelpEl} className="flex shrink-0 items-center empty:hidden" />
    </div>
  )
  const actionsBlock = (
    <div
      ref={setActionsEl}
      className="pointer-events-auto flex shrink-0 flex-wrap items-center justify-end gap-2 empty:hidden"
      style={{ maxWidth: items.length ? sideMax : undefined }}
    />
  )

  if (items.length === 0) {
    return (
      <SlotsCtx.Provider value={slots}>
        <div style={{ minHeight: H }} className={cn("flex items-center justify-between gap-3 rounded-2xl bg-slate-800 px-4 text-white shadow-md dark:bg-slate-700", nested ? "mt-0" : "mt-1 lg:mt-7", className)}>
          {titleBlock}
          {actionsBlock}
        </div>
        {children}
      </SlotsCtx.Provider>
    )
  }

  return (
    <SlotsCtx.Provider value={slots}>
      <div ref={wrapRef} role="tablist" className={cn("relative w-full select-none", className)}>
        <div
          className={cn(
            "flex items-center justify-between gap-2",
            inline ? "pointer-events-none absolute inset-x-4 top-7 z-20 text-white" : "mb-1 text-slate-800 dark:text-slate-100"
          )}
          style={inline ? { height: H } : undefined}
        >
          {titleBlock}
          {actionsBlock}
        </div>

        <div className="relative mx-auto" style={{ height: H + 28, width: barW || undefined }}>
          {width > 0 && (
            <>
              <svg className="absolute left-0 top-7 drop-shadow-md" width={barW} height={H} aria-hidden="true">
                <path d={d} className="fill-slate-800 dark:fill-slate-700" />
              </svg>
              <div
                className={cn("pointer-events-none absolute top-1 -ml-7 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_6px_10px_rgba(0,0,0,0.4),inset_0_2px_3px_rgba(255,255,255,0.5),inset_0_-6px_9px_rgba(0,0,0,0.32)] [background-image:radial-gradient(circle_at_32%_24%,rgba(255,255,255,0.45),rgba(255,255,255,0)_58%)] transition-colors [&_svg]:size-6 [&_svg]:drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)]", items[idx]?.bubbleClass ?? "bg-blue-600")}
                style={{ left: cx }}
                aria-hidden="true"
              >
                {items[idx]?.icon}
              </div>
              {items.map((it, i) => {
                const active = i === idx
                return (
                  <button
                    key={it.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    title={it.label}
                    onClick={() => onValueChange?.(it.value)}
                    className={cn(
                      "absolute top-7 flex flex-col items-center justify-end px-1 pb-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400",
                      active ? "text-white" : "text-slate-300 hover:text-white"
                    )}
                    style={{ left: ox + i * colW, width: colW, height: H }}
                  >
                    <span
                      className={cn(
                        "absolute top-[14px] transition-opacity max-sm:top-1/2 max-sm:-translate-y-1/2 [&_svg]:size-5",
                        active && "opacity-0"
                      )}
                      aria-hidden="true"
                    >
                      {it.icon}
                    </span>
                    <span className={cn("max-w-full truncate", !active && "max-sm:hidden")}>{it.label}</span>
                    {it.dot && <span className="absolute right-[18%] top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-slate-800" aria-label="Da controllare" />}
                  </button>
                )
              })}
            </>
          )}
        </div>
      </div>
      {children}
    </SlotsCtx.Provider>
  )
}

// Piccola etichetta con un numero, per i totali nella striscia
export function NotchStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium normal-case tracking-normal text-slate-300">
      {label} <b className="text-sm font-semibold text-white">{value}</b>
    </span>
  )
}
