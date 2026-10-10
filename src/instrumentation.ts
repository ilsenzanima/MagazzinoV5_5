import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/sentry-options";

// Errori che avvengono sul server (pagine, API) e nel middleware.
// Next.js esegue questa funzione una volta all'avvio di ciascun ambiente.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init(sharedSentryOptions);
  }
}

// Segnala a Sentry gli errori delle richieste gestite dal server
export const onRequestError = Sentry.captureRequestError;
