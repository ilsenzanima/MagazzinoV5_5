"use client"

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"

// Un'azione della pagina che su telefono compare nel pannello «Azioni» della barra in basso
export interface MobileAction {
  id: string
  label: string
  href?: string
  onClick?: () => void
  icon?: ReactNode
}

interface Registry {
  actions: MobileAction[]
  register: (action: MobileAction) => () => void
}

const Ctx = createContext<Registry | null>(null)

export function MobileActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<MobileAction[]>([])
  const register = useCallback((action: MobileAction) => {
    setActions(prev => [...prev.filter(a => a.id !== action.id), action])
    return () => setActions(prev => prev.filter(a => a.id !== action.id))
  }, [])
  const value = useMemo(() => ({ actions, register }), [actions, register])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
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
