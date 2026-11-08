"use client"

import { useCallback } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

// Scheda interna di una pagina di Strumenti admin: resta nell'indirizzo (?s=) accanto alla sezione scelta (?v=)
export function useSubTab(keys: string[], fallback: string): [string, (key: string) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const raw = params.get("s")
  const current = raw && keys.includes(raw) ? raw : fallback

  const set = useCallback((key: string) => {
    const next = new URLSearchParams(window.location.search)
    next.set("s", key)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }, [router, pathname])

  return [current, set]
}
