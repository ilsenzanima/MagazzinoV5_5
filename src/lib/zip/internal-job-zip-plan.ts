import type { SupabaseClient } from "@supabase/supabase-js";
import { buildJobZipPlan } from "./guest-job-zip-plan";
import type { ZipPlan } from "./documentation-zip-types";

// Risolve l'URL da cui scaricare i byte reali di un documento per l'utente interno già
// autenticato: per i file Google Drive forza sempre il download dei byte (anche per i
// documenti Office, che /api/drive/download altrimenti reindirizzerebbe al viewer Drive),
// per i file Supabase Storage genera una signed URL.
async function resolveInternalDownloadUrl(supabase: SupabaseClient, fileUrl: string): Promise<string> {
    if (!fileUrl) return "";
    if (!fileUrl.includes("/")) {
        return `/api/drive/download?fileId=${encodeURIComponent(fileUrl)}&download=1`;
    }
    try {
        const path = fileUrl.split("/public/documents/")[1];
        if (!path) return fileUrl;
        const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) return fileUrl;
        return data.signedUrl;
    } catch {
        return fileUrl;
    }
}

async function fetchBlob(url: string): Promise<Blob> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.blob();
}

export function buildInternalJobZipPlan(job: { documents: any }, supabase: SupabaseClient): Promise<ZipPlan> {
    return buildJobZipPlan(job, async (doc) => {
        const url = await resolveInternalDownloadUrl(supabase, doc.fileUrl);
        return fetchBlob(url);
    });
}
