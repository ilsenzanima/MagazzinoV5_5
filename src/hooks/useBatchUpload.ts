import { useState } from "react"

export const MAX_BATCH_UPLOAD_FILES = 20

export type UploadItemStatus = "pending" | "uploading" | "done" | "error"

export interface UploadItemState {
    status: UploadItemStatus
    error?: string
}

export function useBatchUpload() {
    const [statuses, setStatuses] = useState<UploadItemState[]>([])
    const [running, setRunning] = useState(false)

    const setStatus = (index: number, state: UploadItemState) => {
        setStatuses(prev => prev.map((s, i) => (i === index ? state : s)))
    }

    const run = async <T,>(items: T[], uploadOne: (item: T, index: number) => Promise<void>) => {
        setRunning(true)
        setStatuses(items.map(() => ({ status: "pending" })))
        let okCount = 0
        for (let i = 0; i < items.length; i++) {
            setStatus(i, { status: "uploading" })
            try {
                await uploadOne(items[i], i)
                setStatus(i, { status: "done" })
                okCount++
            } catch (e: any) {
                setStatus(i, { status: "error", error: e?.message || "Errore" })
            }
        }
        setRunning(false)
        return { okCount, failedCount: items.length - okCount }
    }

    const reset = () => setStatuses([])

    return { statuses, running, run, reset }
}
