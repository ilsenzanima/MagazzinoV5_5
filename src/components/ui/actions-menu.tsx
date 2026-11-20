"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { NotchButton } from "@/components/ui/notch-tabs"
import { usePhone } from "@/components/layout/mobile-actions"

export interface ActionItem {
  label: string
  icon?: ReactNode
  onClick?: () => void
  href?: string
  disabled?: boolean
  // Azione pericolosa (elimina): in rosso e separata dalle altre
  danger?: boolean
  // Non mostrare (es. azione riservata a certi ruoli)
  hidden?: boolean
}

const DANGER_BTN = "border-red-700 bg-red-600 text-white hover:bg-red-700 hover:text-white [&_svg]:text-white"

// Menu «Azioni» standard delle pagine: su PC un solo pulsante con tutte le azioni, su telefono (dove i pulsanti
// della barra finiscono gia' nel pannello Azioni della barra in basso) un pulsante per azione.
// Va messo dentro <NotchActions>. Le azioni principali (Salva, Conferma…) restano fuori, sempre in vista.
export function ActionsMenu({ items, label = "Azioni" }: { items: ActionItem[]; label?: string }) {
  const phone = usePhone()
  const list = items.filter(i => !i.hidden)
  if (list.length === 0) return null

  if (phone) {
    return (
      <>
        {list.map(i => i.href ? (
          <Link key={i.label} href={i.href}>
            <NotchButton type="button" disabled={i.disabled} className={i.danger ? DANGER_BTN : undefined}>{i.icon}{i.label}</NotchButton>
          </Link>
        ) : (
          <NotchButton key={i.label} type="button" onClick={i.onClick} disabled={i.disabled} className={i.danger ? DANGER_BTN : undefined}>{i.icon}{i.label}</NotchButton>
        ))}
      </>
    )
  }

  const normal = list.filter(i => !i.danger)
  const danger = list.filter(i => i.danger)
  const row = (i: ActionItem) => {
    const inner = <>{i.icon && <span className="mr-2 flex h-4 w-4 items-center justify-center [&_svg]:h-4 [&_svg]:w-4">{i.icon}</span>}{i.label}</>
    return i.href ? (
      <DropdownMenuItem key={i.label} asChild disabled={i.disabled}>
        <Link href={i.href}>{inner}</Link>
      </DropdownMenuItem>
    ) : (
      <DropdownMenuItem key={i.label} onClick={i.onClick} disabled={i.disabled} className={i.danger ? "text-red-600 focus:text-red-600" : undefined}>{inner}</DropdownMenuItem>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <NotchButton type="button" aria-label={label}><Menu /> {label}</NotchButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {normal.map(row)}
        {normal.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
        {danger.map(row)}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
