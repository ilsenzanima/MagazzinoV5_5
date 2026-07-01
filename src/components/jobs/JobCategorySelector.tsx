"use client"

import { JobCategory, JOB_CATEGORY_LABELS } from "@/lib/types"
import { Label } from "@/components/ui/label"

const CATEGORY_DESCRIPTIONS: Record<JobCategory, string> = {
    fornitura_posa: "Commessa completa: materiali e manodopera",
    solo_fornitura: "Solo materiali, senza un vero cantiere",
    solo_posa: "Solo manodopera, senza fornitura di materiali",
}

const ORDER: JobCategory[] = ["fornitura_posa", "solo_fornitura", "solo_posa"]

interface Props {
    value: JobCategory
    onChange: (value: JobCategory) => void
}

export function JobCategorySelector({ value, onChange }: Props) {
    return (
        <div className="space-y-2">
            <Label>Tipologia Commessa *</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {ORDER.map(cat => (
                    <button
                        key={cat}
                        type="button"
                        onClick={() => onChange(cat)}
                        className={`text-left rounded-md border px-3 py-2 transition-colors ${
                            value === cat
                                ? "border-blue-600 bg-blue-50 dark:bg-blue-950/30 ring-1 ring-blue-600"
                                : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                    >
                        <p className={`text-sm font-medium ${value === cat ? "text-blue-700 dark:text-blue-400" : "text-slate-700 dark:text-slate-200"}`}>
                            {JOB_CATEGORY_LABELS[cat]}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{CATEGORY_DESCRIPTIONS[cat]}</p>
                    </button>
                ))}
            </div>
        </div>
    )
}
