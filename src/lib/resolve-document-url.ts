import type { SupabaseClient } from "@supabase/supabase-js";

// Risolve l'URL da usare per visualizzare inline un documento (es. <img src>),
// sia per i file su Google Drive (proxy autenticato /api/drive/download, che
// serve i byte reali, non la pagina di anteprima) sia per i vecchi file su
// Supabase Storage (signed URL a scadenza). Uso interno/autenticato: per il
// portale ospiti pubblico si usa la logica lato server in compliance-site/route.ts.
export async function resolveDocumentDisplayUrl(supabase: SupabaseClient, fileUrl: string): Promise<string> {
    if (!fileUrl) return "";
    if (!fileUrl.includes("/")) {
        return `/api/drive/download?fileId=${encodeURIComponent(fileUrl)}`;
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
