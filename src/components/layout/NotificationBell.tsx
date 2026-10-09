"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, CalendarClock, HeartPulse, Loader2, PackageMinus, PackageX, Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { notificationPreferencesApi, DEFAULT_NOTIFICATION_PREFERENCES } from "@/lib/services/notification-preferences";
import { AlertKind, AppAlert, notificationsApi } from "@/lib/services/notifications";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const KIND_ICON: Record<AlertKind, typeof Bell> = {
  out_of_stock: PackageX,
  low_stock: PackageMinus,
  course: CalendarClock,
  medical_exam: HeartPulse,
};

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
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const prefs = await notificationPreferencesApi.get(user.id).catch(() => DEFAULT_NOTIFICATION_PREFERENCES);
      setAlerts(await notificationsApi.getAlerts(prefs));
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

  if (!user) return null;

  const count = alerts.length;
  const hasCritical = alerts.some((a) => a.critical);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={count > 0 ? `Notifiche: ${count} avvisi` : "Notifiche"}
          className="relative shrink-0 p-2 rounded-md hover:bg-sidebar-accent/50 transition-colors text-sidebar-foreground"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white",
                hasCritical ? "bg-red-600" : "bg-amber-500"
              )}
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-semibold">Notifiche</p>
          <Link
            href="/settings/notifications"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Impostazioni notifiche"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!loading && failed && count === 0 && (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0" /> Impossibile caricare gli avvisi.
            </p>
          )}

          {!loading && !failed && count === 0 && (
            <p className="px-3 py-6 text-sm text-muted-foreground text-center">Nessun avviso. Tutto in ordine.</p>
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
                    return (
                      <Link
                        key={alert.id}
                        href={alert.href}
                        onClick={() => { setOpen(false); onNavigate?.(); }}
                        className="flex items-start gap-3 px-3 py-2 hover:bg-accent transition-colors"
                      >
                        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", alert.critical ? "text-red-600" : "text-amber-500")} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium truncate">{alert.title}</span>
                          <span className="block text-xs text-muted-foreground">{alert.detail}</span>
                        </span>
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
