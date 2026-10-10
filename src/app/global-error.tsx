"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Ultima rete di sicurezza: se un errore rompe l'intera pagina lo segnala a Sentry
// e mostra un messaggio al posto della schermata bianca.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="it">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0 }}>
        <div style={{ textAlign: "center", padding: "1rem", maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Si è verificato un errore</h1>
          <p style={{ color: "#64748b", marginBottom: "1rem" }}>
            L&apos;errore è stato segnalato. Prova a ricaricare la pagina.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}
