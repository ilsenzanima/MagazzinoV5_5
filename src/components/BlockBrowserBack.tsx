"use client"

import { useEffect } from "react";
import { notify } from "@/lib/notify";

// Nelle pagine di creazione un clic accidentale sul tasto «indietro» del mouse (o il gesto indietro del telefono)
// farebbe perdere tutto quello che è stato inserito. Qui il tasto non fa nulla: si esce solo con i pulsanti a schermo.
export function BlockBrowserBack() {
    useEffect(() => {
        const keepHere = () => {
            // si conserva lo stato di Next.js, altrimenti ricaricherebbe la pagina
            window.history.pushState({ ...(window.history.state ?? {}), blockedBack: true }, "", window.location.href);
        };
        keepHere();

        let lastNotice = 0;
        const onPopState = () => {
            keepHere();
            const now = Date.now();
            if (now - lastNotice > 3000) {
                lastNotice = now;
                notify.info("Per uscire usa i pulsanti a schermo: così non perdi i dati inseriti.");
            }
        };

        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    return null;
}
