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

    const run = async <T,>(
        items: T[], 
        uploadOne: (item: T, index: number) => Promise<void>,
        concurrency = 2
    ) => {
        setRunning(true)
        setStatuses(items.map(() => ({ status: "pending" })))
        
        let okCount = 0
        let nextIndex = 0

        const worker = async () => {
            while (nextIndex < items.length) {
                const currentIndex = nextIndex++
                setStatus(currentIndex, { status: "uploading" })
                try {
                    await uploadOne(items[currentIndex], currentIndex)
                    setStatus(currentIndex, { status: "done" })
                    okCount++
                } catch (e: any) {
                    setStatus(currentIndex, { status: "error", error: e?.message || "Errore" })
                }
            }
        }

        const workers = Array.from(
            { length: Math.min(concurrency, items.length) }, 
            worker
        )
        await Promise.all(workers)

        setRunning(false)
        return { okCount, failedCount: items.length - okCount }
    }

    const reset = () => setStatuses([])

    return { statuses, running, run, reset }
}
