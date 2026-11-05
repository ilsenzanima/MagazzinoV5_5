"use client"

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface NotchTabItem {
  value: string
  label: string
  icon: ReactNode
}

interface NotchTabsProps {
  items: NotchTabItem[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

// Geometria della barra (px)
const H = 68 // altezza della barra
const R = 38 // raggio della tacca
const CY = 4 // centro della tacca rispetto al bordo alto della barra
const FR = 14 // raggio del raccordo tra barra e tacca
const CR = 16 // raggio degli angoli della barra
const SPAN = Math.sqrt((R + FR) ** 2 - (FR - CY) ** 2) // distanza orizzontale centro tacca → inizio raccordo

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

// Barra di tab con una tacca circolare che scivola sul tab attivo. L'etichetta sta sotto l'icona;
// su telefono le voci non attive mostrano solo l'icona e l'etichetta resta solo su quella attiva.
export function NotchTabs({ items, value, onValueChange, className }: NotchTabsProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [x, setX] = useState(0)
  const xRef = useRef(0)
  const raf = useRef(0)
  const idx = Math.max(0, items.findIndex(i => i.value === value))
  const colW = items.length ? width / items.length : 0

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
    const target = (idx + 0.5) * colW
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
  }, [idx, width, colW])

  const { d, cx } = barGeometry(width, x)

  return (
    <div
      ref={wrapRef}
      role="tablist"
      className={cn("relative mx-auto w-full select-none", className)}
      style={{ height: H + 28, maxWidth: items.length * 200 }}
    >
      {width > 0 && (
        <>
          <svg className="absolute left-0 top-7 drop-shadow-md" width={width} height={H} aria-hidden="true">
            <path d={d} className="fill-slate-800 dark:fill-slate-700" />
          </svg>
          <div
            className="pointer-events-none absolute top-1 -ml-7 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg [&_svg]:size-6"
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
                onClick={() => onValueChange(it.value)}
                className={cn(
                  "absolute top-7 flex flex-col items-center justify-end px-1 pb-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400",
                  active ? "text-white" : "text-slate-300 hover:text-white"
                )}
                style={{ left: i * colW, width: colW, height: H }}
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
              </button>
            )
          })}
        </>
      )}
    </div>
  )
}
