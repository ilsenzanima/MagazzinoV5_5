import { NextRequest, NextResponse } from "next/server";
import { downloadFile } from "@/lib/google-drive";

// Serve i byte di un'immagine Google Drive dal nostro dominio, così la CSP
// (img-src 'self') resta invariata e non serve esporre link diretti a Drive.
// Nessuna autenticazione Supabase richiesta: usato dal portale ospiti, dove
// l'accesso è già stato verificato tramite passcode prima di ottenere il fileId,
// e il file è comunque già condiviso "chiunque abbia il link" (ensureFileLinkShareable).
export async function GET(req: NextRequest) {
    const fileId = req.nextUrl.searchParams.get("fileId");
    if (!fileId) return NextResponse.json({ error: "fileId mancante" }, { status: 400 });

    try {
        const { buffer, mimeType } = await downloadFile(fileId);
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": mimeType,
                "Cache-Control": "private, max-age=3600",
            },
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message ?? "Errore caricamento immagine da Google Drive" }, { status: 500 });
    }
}
