"use client"

import { useState } from "react"
import { HelpCircle, Loader2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface HelpTipProps {
    title: string
    description?: string
    fetchItems?: () => Promise<string[]>
    emptyText?: string
}

export function HelpTip({ title, description, fetchItems, emptyText = "Nessun tipo configurato." }: HelpTipProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<string[] | null>(null)

    const handleOpenChange = async (next: boolean) => {
        setOpen(next)
        if (next && items === null && fetchItems) {
            try {
                setLoading(true)
                setItems(await fetchItems())
            } catch {
                setItems([])
            } finally {
                setLoading(false)
            }
        }
    }

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <span
                    role="button"
                    tabIndex={0}
                    onClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") e.stopPropagation() }}
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 ml-1 shrink-0"
                >
                    <HelpCircle className="h-3.5 w-3.5" />
                </span>
            </PopoverTrigger>
            <PopoverContent
                className="w-64 text-sm"
                onClick={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
            >
                <p className="font-medium mb-1">{title}</p>
                {description && <p className="text-xs text-slate-500 mb-2">{description}</p>}
                {fetchItems && (
                    loading ? (
                        <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
                    ) : items && items.length > 0 ? (
                        <ul className="space-y-1 list-disc pl-4">
                            {items.map((it, i) => <li key={i}>{it}</li>)}
                        </ul>
                    ) : (
                        <p className="text-xs text-slate-400 italic">{emptyText}</p>
                    )
                )}
            </PopoverContent>
        </Popover>
    )
}
