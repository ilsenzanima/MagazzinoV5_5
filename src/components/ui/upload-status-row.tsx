import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import type { UploadItemState } from "@/hooks/useBatchUpload"

export function UploadStatusBar({ state }: { state?: UploadItemState }) {
    if (!state) return null
    return (
        <div className="flex flex-col gap-1 mt-1.5">
            <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all ${
                            state.status === "done"
                                ? "bg-green-500 w-full"
                                : state.status === "error"
                                ? "bg-red-500 w-full"
                                : state.status === "uploading"
                                ? "bg-blue-500 w-2/3 animate-pulse"
                                : "bg-slate-200 dark:bg-slate-700 w-0"
                        }`}
                    />
                </div>
                {state.status === "uploading" && <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />}
                {state.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                {state.status === "error" && <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
            </div>
            {state.status === "error" && state.error && (
                <span className="text-xs text-red-500 font-medium">{state.error}</span>
            )}
        </div>
    )
}
