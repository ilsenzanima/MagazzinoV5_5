"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

interface CheckboxesProps {
    isOld: boolean
    isRev: boolean
    onOldChange: (v: boolean) => void
    onRevChange: (v: boolean) => void
    idPrefix: string
}

export function OldRevCheckboxes({ isOld, isRev, onOldChange, onRevChange, idPrefix }: CheckboxesProps) {
    return (
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
                <Checkbox
                    id={`${idPrefix}-old`}
                    checked={isOld}
                    onCheckedChange={v => onOldChange(v as boolean)}
                />
                <Label htmlFor={`${idPrefix}-old`} className="text-xs cursor-pointer font-normal">
                    Mostra banner &quot;OLD&quot;
                </Label>
            </div>
            <div className="flex items-center gap-1.5">
                <Checkbox
                    id={`${idPrefix}-rev`}
                    checked={isRev}
                    onCheckedChange={v => onRevChange(v as boolean)}
                />
                <Label htmlFor={`${idPrefix}-rev`} className="text-xs cursor-pointer font-normal">
                    Mostra banner &quot;REV&quot;
                </Label>
            </div>
        </div>
    )
}

export function OldRevBadges({ isOld, isRev }: { isOld?: boolean; isRev?: boolean }) {
    if (!isOld && !isRev) return null
    return (
        <>
            {isOld && (
                <span className="text-[10px] font-bold tracking-wide bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-red-700 dark:text-red-400">
                    OLD
                </span>
            )}
            {isRev && (
                <span className="text-[10px] font-bold tracking-wide bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-amber-700 dark:text-amber-400">
                    REV
                </span>
            )}
        </>
    )
}
