// Opzioni comuni di Sentry per browser, server ed edge.
// Senza NEXT_PUBLIC_SENTRY_DSN (es. in sviluppo locale) Sentry resta spento e non invia nulla.
export const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sharedSentryOptions = {
    dsn: sentryDsn,
    enabled: !!sentryDsn,
    // Distingue produzione da anteprime (NEXT_PUBLIC_VERCEL_ENV è visibile anche nel browser)
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || process.env.NODE_ENV,
    // Solo errori: nessun tracciamento delle prestazioni e nessuna registrazione delle sessioni
    tracesSampleRate: 0,
    // Non inviare dati personali degli utenti (IP, cookie, intestazioni)
    sendDefaultPii: false,
    // Rumore del browser che non indica un problema dell'app
    ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
        'AbortError',
    ],
};
