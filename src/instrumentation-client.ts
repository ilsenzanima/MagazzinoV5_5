import * as Sentry from "@sentry/nextjs";
import { sharedSentryOptions } from "@/lib/sentry-options";

// Errori che avvengono nel browser dell'utente
Sentry.init(sharedSentryOptions);

// Segnala a Sentry anche le navigazioni tra pagine
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
