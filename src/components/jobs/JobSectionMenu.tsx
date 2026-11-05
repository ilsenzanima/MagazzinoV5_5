"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown, Menu } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { HelpTip } from "@/components/ui/help-tip"

export interface SectionMenuItem {
    key: string
    label: string
    icon: ReactNode
    // Spiegazione sui tipi di documento disponibili (icona «?» accanto alla voce)
    help?: {
        title: string
        description: string
        fetchItems: () => Promise<string[]>
        emptyText: string
    }
}

export interface SectionMenuGroup {
    key: string
    label: string
    items: SectionMenuItem[]
}

interface JobSectionMenuProps {
    groups: SectionMenuGroup[]
    activeKey: string
    onSelect: (groupKey: string, itemKey: string) => void
}

// Un solo pulsante che dice dove ci si trova e apre l'elenco di tutte le pagine della commessa:
// le macro categorie affiancate su schermo largo, una sotto l'altra su telefono.
export function JobSectionMenu({ groups, activeKey, onSelect }: JobSectionMenuProps) {
    const [open, setOpen] = useState(false)
    const activeGroup = groups.find(g => g.items.some(i => i.key === activeKey))
    const activeItem = activeGroup?.items.find(i => i.key === activeKey)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Apri il menu delle pagine della commessa"
                    className="flex w-full items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 sm:w-auto"
                >
                    <Menu className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                        {activeGroup?.label}
                        <span className="mx-1.5 text-slate-400">›</span>
                        <span className="text-blue-600 dark:text-blue-400">{activeItem?.label}</span>
                    </span>
                    <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                collisionPadding={8}
                className="max-h-[80vh] w-[min(46rem,calc(100vw-1rem))] overflow-y-auto p-3"
            >
                <div className={`grid grid-cols-1 gap-4 ${groups.length === 3 ? "md:grid-cols-3" : groups.length === 2 ? "md:grid-cols-2" : ""}`}>
                    {groups.map(group => (
                        <div key={group.key}>
                            <p className="mb-1 border-b px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {group.label}
                            </p>
                            <ul className="space-y-0.5">
                                {group.items.map(item => {
                                    const active = item.key === activeKey
                                    return (
                                        <li key={item.key} className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={() => { onSelect(group.key, item.key); setOpen(false) }}
                                                className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                                                    active
                                                        ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                                                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                                }`}
                                            >
                                                <span className="shrink-0">{item.icon}</span>
                                                <span className="truncate">{item.label}</span>
                                            </button>
                                            {item.help && (
                                                <HelpTip
                                                    title={item.help.title}
                                                    description={item.help.description}
                                                    fetchItems={item.help.fetchItems}
                                                    emptyText={item.help.emptyText}
                                                />
                                            )}
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}
