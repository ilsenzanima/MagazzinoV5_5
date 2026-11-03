import { NextRequest, NextResponse } from "next/server";
import { downloadFile } from "@/lib/google-drive";

// Serve i byte di un'immagine Google Drive dal nostro dominio, così la CSP
// (img-src 'self') resta invariata e non serve esporre link diretti a Drive.
// Nessuna autenticazione Supabase richiesta: usato dal portale ospiti, dove
// l'accesso è già stato verificato tramite passcode prima di ottenere il fileId,
// e il file è comunque già condiviso "chiunque abbia il link" (ensureFileLinkShareable).
export async function GET(req: NextRequest) {
    const fileId = req.nextUrl.searchParams.get("fileId");
    // Gli id Drive sono alfanumerici (con - e _): niente altro deve arrivare alla chiamata verso Drive
    if (fileId && !/^[A-Za-z0-9_-]{10,100}$/.test(fileId)) {
        return NextResponse.json({ error: "fileId non valido" }, { status: 400 });
    }
    if (!fileId) return NextResponse.json({ error: "fileId mancante" }, { status: 400 });

    try {
        const { buffer, mimeType } = await downloadFile(fileId, { onlyMimePrefix: "image/" });
        return new NextResponse(new Uint8Array(buffer), {
            headers: {
                "Content-Type": mimeType,
                "Cache-Control": "private, max-age=3600",
            },
        });
    } catch (err: any) {
        if (err?.code === "NOT_AN_IMAGE") return NextResponse.json({ error: "File non disponibile" }, { status: 404 });
        console.error("Errore proxy immagine ospiti:", err);
        return NextResponse.json({ error: "Errore caricamento immagine" }, { status: 500 });
    }
}
