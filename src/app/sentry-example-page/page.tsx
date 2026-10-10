"use client";

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";

// Pagina per verificare che Sentry riceva gli errori. Non compare nel menu.
export default function SentryExamplePage() {
  const { userRole, loading } = useAuth();
  const [serverResult, setServerResult] = useState<string | null>(null);
  const [browserSent, setBrowserSent] = useState(false);

  if (!loading && userRole !== "admin") {
    return (
      <DashboardLayout>
        <p className="py-10 text-center text-slate-500">Questa pagina è riservata agli amministratori.</p>
      </DashboardLayout>
    );
  }

  const triggerBrowserError = () => {
    setBrowserSent(true);
    // Errore non gestito dentro un evento: è il caso reale che Sentry deve catturare
    throw new Error("Test Sentry: errore di prova generato dal browser");
  };

  const triggerServerError = async () => {
    setServerResult("Invio in corso…");
    try {
      const res = await fetch("/api/sentry-test");
      setServerResult(res.status === 500 ? "Errore generato dal server (500). Controlla Sentry." : `Risposta inattesa dal server (${res.status}).`);
    } catch {
      setServerResult("Impossibile contattare il server.");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Test Sentry</h1>
          <p className="text-sm text-muted-foreground">
            Genera errori di prova per verificare che arrivino su Sentry. Entro un minuto dovrebbero comparire in Issues.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Errore dal browser</CardTitle>
            <CardDescription>Simula un errore nella pagina, come quelli che vedrebbe un utente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" onClick={triggerBrowserError}>Genera errore nel browser</Button>
            {browserSent && <p className="text-sm text-muted-foreground">Errore generato. Controlla Sentry.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Errore dal server</CardTitle>
            <CardDescription>Simula un errore in una richiesta gestita dal server.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" onClick={triggerServerError}>Genera errore sul server</Button>
            {serverResult && <p className="text-sm text-muted-foreground">{serverResult}</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
