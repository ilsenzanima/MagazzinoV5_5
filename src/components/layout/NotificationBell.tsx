"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CalendarClock, HeartPulse, Loader2, PackageMinus, PackageX, Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
  notificationPreferencesApi,
} from "@/lib/services/notification-preferences";
import { AlertKind, AppAlert, notificationsApi } from "@/lib/services/notifications";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const KIND_ICON: Record<AlertKind, typeof Bell> = {
  out_of_stock: PackageX,
  low_stock: PackageMinus,
  course: CalendarClock,
  medical_exam: HeartPulse,
};

// Etichette del riepilogo, con la preferenza che le attiva
const SUMMARY: { kind: AlertKind; label: string; pref: keyof NotificationPreferences }[] = [
  { kind: "out_of_stock", label: "Esauriti", pref: "outOfStock" },
  { kind: "low_stock", label: "Scorta bassa", pref: "lowStock" },
  { kind: "course", label: "Corsi", pref: "expiringCourses" },
  { kind: "medical_exam", label: "Visite mediche", pref: "expiringMedicalExams" },
];

const SECTIONS: { title: string; kinds: AlertKind[] }[] = [
  { title: "Magazzino", kinds: ["out_of_stock", "low_stock"] },
  { title: "Scadenze personale", kinds: ["course", "medical_exam"] },
];

interface NotificationBellProps {
  onNavigate?: () => void;
}

export function NotificationBell({ onNavigate }: NotificationBellProps) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<AppAlert[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  // Avvisi nuovi al momento dell'apertura: restano evidenziati finché il pannello è aperto
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const stored = await notificationPreferencesApi
        .getWithSeen(user.id)
        .catch(() => ({ prefs: DEFAULT_NOTIFICATION_PREFERENCES, seenAlertIds: [] as string[] }));
      const { alerts: loaded, complete } = await notificationsApi.getAlerts(stored.prefs);
      setPrefs(stored.prefs);
      setAlerts(loaded);

      // Un avviso risolto (es. articolo rifornito) esce dall'elenco dei "visti": se si ripresenta
      // in futuro è di nuovo nuovo. Si pulisce solo con dati completi, per non cancellare per errore.
      const currentIds = new Set(loaded.map((a) => a.id));
      let seen = stored.seenAlertIds;
      if (complete) {
        const pruned = seen.filter((id) => currentIds.has(id));
        if (pruned.length !== seen.length) {
          notificationPreferencesApi.saveSeenAlertIds(user.id, pruned).catch(() => { /* riproverà al prossimo giro */ });
          seen = pruned;
        }
      }
      // Se il pannello è aperto tutto ciò che si vede è già "visto"
      setSeenIds(openRef.current ? currentIds : new Set(seen));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    // Quando l'utente cambia le preferenze la lista si aggiorna subito
    window.addEventListener("notification-preferences-changed", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("notification-preferences-changed", load);
    };
  }, [load]);

  const unseen = useMemo(() => alerts.filter((a) => !seenIds.has(a.id)), [alerts, seenIds]);

  const counts = useMemo(() => {
    const result: Record<AlertKind, number> = { out_of_stock: 0, low_stock: 0, course: 0, medical_exam: 0 };
    alerts.forEach((a) => { result[a.kind] += 1; });
    return result;
  }, [alerts]);

  // Aprendo il pannello gli avvisi diventano "visti": il contatore si azzera
  // e viene salvato nel database, così vale anche sugli altri dispositivi.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    openRef.current = next;
    if (!next || !user) return;

    setHighlightIds(new Set(unseen.map((a) => a.id)));
    if (unseen.length > 0) {
      const allIds = alerts.map((a) => a.id);
      setSeenIds(new Set(allIds));
      notificationPreferencesApi.saveSeenAlertIds(user.id, allIds).catch(() => {
        /* se il salvataggio fallisce il contatore tornerà al prossimo aggiornamento */
      });
    }
  };

  if (!user) return null;

  const unseenCount = unseen.length;
  const hasCritical = unseen.some((a) => a.critical);
  const closeAndNavigate = () => { setOpen(false); openRef.current = false; onNavigate?.(); };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unseenCount > 0 ? `Notifiche: ${unseenCount} nuovi avvisi` : "Notifiche"}
          className="relative shrink-0 p-2 rounded-md hover:bg-sidebar-accent/50 transition-colors text-sidebar-foreground"
        >
          <Bell className="h-5 w-5" />
          {unseenCount > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white",
                hasCritical ? "bg-red-600" : "bg-amber-500"
              )}
            >
              {unseenCount > 99 ? "99+" : unseenCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div>
            <p className="text-sm font-semibold">Notifiche</p>
            {!loading && !failed && (
              <p className="text-xs text-muted-foreground">
                {alerts.length === 0 ? "Nessun avviso attivo" : `${alerts.length} ${alerts.length === 1 ? "avviso attivo" : "avvisi attivi"}`}
              </p>
            )}
          </div>
          <Link
            href="/settings/notifications"
            onClick={closeAndNavigate}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Impostazioni notifiche"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>

        {/* Riepilogo: mostra tutti i tipi di avviso controllati, anche quelli a zero */}
        {!loading && !failed && (
          <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b">
            {SUMMARY.filter((s) => prefs[s.pref]).map((s) => (
              <span
                key={s.kind}
                className={cn(
                  "text-xs rounded-full border px-2 py-0.5",
                  counts[s.kind] > 0 ? "bg-accent font-medium" : "text-muted-foreground"
                )}
              >
                {s.label}: {counts[s.kind]}
              </span>
            ))}
            {SUMMARY.every((s) => !prefs[s.pref]) && (
              <span className="text-xs text-muted-foreground">Tutti gli avvisi sono disattivati nelle impostazioni.</span>
            )}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!loading && failed && alerts.length === 0 && (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Impossibile caricare gli avvisi.
            </p>
          )}

          {!loading && !failed && alerts.length === 0 && (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">Tutto in ordine.</p>
          )}

          {!loading &&
            SECTIONS.map((section) => {
              const items = alerts.filter((a) => section.kinds.includes(a.kind));
              if (items.length === 0) return null;
              return (
                <div key={section.title}>
                  <p className="px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {section.title} ({items.length})
                  </p>
                  {items.map((alert) => {
                    const Icon = KIND_ICON[alert.kind];
                    const isNew = highlightIds.has(alert.id);
                    return (
                      <Link
                        key={alert.id}
                        href={alert.href}
                        onClick={closeAndNavigate}
                        className={cn(
                          "flex items-start gap-3 px-3 py-2 hover:bg-accent transition-colors",
                          isNew && "bg-accent/40"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", alert.critical ? "text-red-600" : "text-amber-500")} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium truncate">{alert.title}</span>
                          <span className="block text-xs text-muted-foreground">{alert.detail}</span>
                        </span>
                        {isNew && <span className="shrink-0 text-[10px] font-semibold text-blue-600">NUOVO</span>}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
