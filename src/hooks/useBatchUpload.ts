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
        const finalStatuses: UploadItemState[] = items.map(() => ({ status: "pending" }))
        setStatuses(finalStatuses.map(s => ({ ...s })))

        let okCount = 0
        let nextIndex = 0

        const worker = async () => {
            while (nextIndex < items.length) {
                const currentIndex = nextIndex++
                setStatus(currentIndex, { status: "uploading" })
                try {
                    await uploadOne(items[currentIndex], currentIndex)
                    finalStatuses[currentIndex] = { status: "done" }
                    setStatus(currentIndex, finalStatuses[currentIndex])
                    okCount++
                } catch (e: any) {
                    console.error('Errore upload file', e)
                    finalStatuses[currentIndex] = { status: "error", error: e?.message || "Errore" }
                    setStatus(currentIndex, finalStatuses[currentIndex])
                }
            }
        }

        const workers = Array.from(
            { length: Math.min(concurrency, items.length) },
            worker
        )
        await Promise.all(workers)

        setRunning(false)
        return { okCount, failedCount: items.length - okCount, statuses: finalStatuses }
    }

    const reset = () => setStatuses([])

    return { statuses, running, run, reset }
}
