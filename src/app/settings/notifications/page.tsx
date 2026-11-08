"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PushState, disablePush, enablePush, getPushState, sendTestPush } from "@/lib/push-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-provider";
import { notify } from "@/lib/notify";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
  notificationPreferencesApi,
} from "@/lib/services/notification-preferences";

interface PreferenceRowProps {
  id: keyof NotificationPreferences;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (key: keyof NotificationPreferences, value: boolean) => void;
}

function PreferenceRow({ id, title, description, checked, disabled, onChange }: PreferenceRowProps) {
  return (
    <div className="flex items-center justify-between space-x-2">
      <Label htmlFor={id} className="flex flex-col space-y-1">
        <span>{title}</span>
        <span className="font-normal text-xs text-muted-foreground">{description}</span>
      </Label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={(value) => onChange(id, value)} />
    </div>
  );
}

const PUSH_MESSAGES: Record<string, string> = {
  unsupported: "Questo browser non supporta le notifiche sul telefono.",
  "needs-install": "Su iPhone e iPad le notifiche funzionano solo dall'app installata: apri il sito in Safari, tocca Condividi e scegli «Aggiungi a Home», poi apri l'app dalla Home e torna qui.",
  denied: "Le notifiche sono bloccate per questo sito: riattivale dalle impostazioni del browser o del telefono.",
  "not-configured": "Le notifiche sul telefono non sono ancora attivate sul server.",
};

function PushCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPushState().then(setState); }, []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) await enablePush(); else await disablePush();
      setState(await getPushState());
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Operazione non riuscita");
      setState(await getPushState());
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    try { await sendTestPush(); notify.success("Notifica di prova inviata"); }
    catch (e) { notify.error(e instanceof Error ? e.message : "Invio non riuscito"); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifiche sul telefono</CardTitle>
        <CardDescription>
          Ogni mattina ricevi un riepilogo (voci dell&apos;Agenda da ricordare, corsi e visite in scadenza, articoli esauriti, giorni di presenze da segnare) e, subito, ogni nuova richiesta di permesso. Funziona anche con l&apos;app chiusa e vale solo per questo dispositivo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state === null ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : state === "on" || state === "off" ? (
          <>
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="push-toggle" className="flex flex-col space-y-1">
                <span>Ricevi le notifiche su questo dispositivo</span>
                <span className="font-normal text-xs text-muted-foreground">{state === "on" ? "Attive" : "Disattivate"}</span>
              </Label>
              <Switch id="push-toggle" checked={state === "on"} disabled={busy} onCheckedChange={toggle} />
            </div>
            {state === "on" && (
              <Button variant="outline" size="sm" onClick={test} disabled={busy}>Invia una notifica di prova</Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{PUSH_MESSAGES[state]}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsNotificationsPage() {
  const { user, userRole } = useAuth();
  const canSeeJobPrices = userRole === "admin" || userRole === "operativo";
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    notificationPreferencesApi
      .get(user.id)
      .then((loaded) => { if (!cancelled) setPrefs(loaded); })
      .catch(() => notify.error("Impossibile caricare le preferenze di notifica."))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  // Salva subito a ogni modifica; se il salvataggio fallisce torna al valore precedente
  const handleChange = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user) return;
    const previous = prefs;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    try {
      await notificationPreferencesApi.save(user.id, next);
      // Avvisa la campanella in sidebar di ricalcolare gli avvisi
      window.dispatchEvent(new Event("notification-preferences-changed"));
    } catch {
      setPrefs(previous);
      notify.error("Salvataggio non riuscito. Riprova.");
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving || !user;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium flex items-center gap-2">
          Notifiche
          {(loading || saving) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </h3>
        <p className="text-sm text-muted-foreground">
          Scegli quali avvisi vuoi vedere nella campanella in basso a sinistra. Le preferenze valgono solo per il tuo utente.
        </p>
      </div>
      <Separator />

      {canSeeJobPrices && <PushCard />}

      <Card>
        <CardHeader>
          <CardTitle>Avvisi Inventario</CardTitle>
          <CardDescription>
            Valgono per gli articoli che hanno una scorta minima impostata.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PreferenceRow
            id="lowStock"
            title="Scorta Bassa"
            description="Avvisami quando un articolo scende sotto la soglia minima."
            checked={prefs.lowStock}
            disabled={disabled}
            onChange={handleChange}
          />
          <PreferenceRow
            id="outOfStock"
            title="Articolo Esaurito"
            description="Avvisami quando un articolo arriva a zero."
            checked={prefs.outOfStock}
            disabled={disabled}
            onChange={handleChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scadenze Personale</CardTitle>
          <CardDescription>
            Avviso nei 60 giorni prima della scadenza e dopo che è scaduta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <PreferenceRow
            id="expiringCourses"
            title="Corsi di Formazione"
            description="Avvisami quando un corso di un operaio sta per scadere."
            checked={prefs.expiringCourses}
            disabled={disabled}
            onChange={handleChange}
          />
          <PreferenceRow
            id="expiringMedicalExams"
            title="Visite Mediche"
            description="Avvisami quando la visita medica di un operaio sta per scadere."
            checked={prefs.expiringMedicalExams}
            disabled={disabled}
            onChange={handleChange}
          />
        </CardContent>
      </Card>

      {canSeeJobPrices && (
        <Card>
          <CardHeader>
            <CardTitle>Prezzi Commesse</CardTitle>
            <CardDescription>
              Per le commesse attive: righe dell&apos;analisi costi per cui non si può risalire a un prezzo affidabile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PreferenceRow
              id="jobPriceMissing"
              title="Prezzo da definire"
              description="Avvisami quando un articolo di una commessa non ha un prezzo affidabile e serve una decisione."
              checked={prefs.jobPriceMissing}
              disabled={disabled}
              onChange={handleChange}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
