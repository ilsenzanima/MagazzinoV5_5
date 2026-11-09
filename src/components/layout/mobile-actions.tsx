"use client"

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { createPortal } from "react-dom"

// Un'azione della pagina che su telefono compare nel pannello «Azioni» della barra in basso
export interface MobileAction {
  id: string
  label: string
  href?: string
  onClick?: () => void
  icon?: ReactNode
}

// La ricerca della pagina corrente (barra di ricerca e filtri): su telefono vive nel pannello «Cerca»
export interface PageSearchInfo { title: string }

interface Registry {
  actions: MobileAction[]
  register: (action: MobileAction) => () => void
  searchInfo: PageSearchInfo | null
  registerSearch: (info: PageSearchInfo) => () => void
  // Spazio nel pannello «Cerca» dove la pagina mette la sua ricerca (esiste solo a pannello aperto)
  searchSlot: HTMLElement | null
  setSearchSlot: (el: HTMLElement | null) => void
}

const Ctx = createContext<Registry | null>(null)

export function MobileActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<MobileAction[]>([])
  const register = useCallback((action: MobileAction) => {
    setActions(prev => [...prev.filter(a => a.id !== action.id), action])
    return () => setActions(prev => prev.filter(a => a.id !== action.id))
  }, [])
  const [searchInfo, setSearchInfo] = useState<PageSearchInfo | null>(null)
  const [searchSlot, setSearchSlot] = useState<HTMLElement | null>(null)
  const registerSearch = useCallback((info: PageSearchInfo) => {
    setSearchInfo(info)
    return () => setSearchInfo(null)
  }, [])
  const value = useMemo(
    () => ({ actions, register, searchInfo, registerSearch, searchSlot, setSearchSlot }),
    [actions, register, searchInfo, registerSearch, searchSlot]
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMobileSearch() {
  return useContext(Ctx)
}

// Azioni registrate dalla pagina corrente (lette dalla barra in basso)
export function useRegisteredActions(): MobileAction[] {
  return useContext(Ctx)?.actions ?? []
}

// La pagina dichiara le sue azioni: restano registrate finché il componente è a schermo.
// Il gestore più recente viene sempre usato, quindi non serve ricreare le azioni a ogni render.
export function useMobileActions(list: Omit<MobileAction, "id">[]) {
  const ctx = useContext(Ctx)
  const register = ctx?.register
  const baseId = useId()
  const latest = useRef(list)
  latest.current = list
  const signature = list.map(a => `${a.label}|${a.href ?? ""}`).join("§")

  useEffect(() => {
    if (!register) return
    const cleanups = latest.current.map((a, i) =>
      register({
        id: `${baseId}-${i}`,
        label: a.label,
        href: a.href,
        icon: a.icon,
        onClick: () => latest.current[i]?.onClick?.(),
      })
    )
    return () => cleanups.forEach(c => c())
  }, [register, baseId, signature])
}

// Telefono: sotto i 768 px
const PHONE_QUERY = "(max-width: 767px)"
export function usePhone() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(PHONE_QUERY)
      mq.addEventListener("change", cb)
      return () => mq.removeEventListener("change", cb)
    },
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false
  )
}

// Su telefono porta il contenuto (ricerca, filtri) nel pannello «Cerca» della barra in basso e non lo mostra nella pagina.
// Da tablet in su non mostra nulla: la pagina ha gia' la sua ricerca nella fascia.
export function PhoneSearchPortal({ title, children }: { title: string; children: ReactNode }) {
  const phone = usePhone()
  const ctx = useContext(Ctx)
  const registerSearch = ctx?.registerSearch
  useEffect(() => {
    if (!phone || !registerSearch) return
    return registerSearch({ title })
  }, [phone, registerSearch, title])
  if (!phone || !ctx?.searchSlot) return null
  return createPortal(<div className="space-y-3">{children}</div>, ctx.searchSlot)
}
