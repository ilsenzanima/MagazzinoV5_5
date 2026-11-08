"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NotchTabs } from "@/components/ui/notch-tabs";
import { useRouter } from "next/navigation";
import {
  User,
  Bell,
  Settings,
  Database,
  HardDrive
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";

const sidebarNavItems = [
  {
    title: "Generale",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "Profilo",
    href: "/settings/profile",
    icon: User,
  },
  {
    title: "Notifiche",
    href: "/settings/notifications",
    icon: Bell,
  },
  {
    title: "Dati",
    href: "/settings/data",
    icon: Database,
  },
  {
    title: "Backup",
    href: "/settings/backup",
    icon: HardDrive,
  },
];

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> { }

export function SidebarNav({ className, ...props }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { userRole, realRole } = useAuth();

  const items = sidebarNavItems
    .filter(item => {
      if (item.href === "/settings/backup") {
        // Show if effectively admin OR real admin (so they can disable simulation)
        return userRole === 'admin' || realRole === 'admin';
      }
      // Dati (tipi, unita', magazzini...) solo per admin e operativi
      if (item.href === "/settings/data") return userRole === 'admin' || userRole === 'operativo';
      return true;
    })
    .map(item => ({ value: item.href, label: item.title, icon: <item.icon /> }));

  return (
    <div className={className}>
      <NotchTabs title="Impostazioni" items={items} value={pathname} onValueChange={(href) => router.push(href)} />
    </div>
  );
}

// Impedisce di aprire dall'indirizzo le pagine delle impostazioni riservate
export function SettingsGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { userRole, realRole } = useAuth();
  const adminOnly = pathname.startsWith("/settings/backup");
  const staffOnly = pathname.startsWith("/settings/data");
  const allowed = adminOnly
    ? userRole === 'admin' || realRole === 'admin'
    : staffOnly
      ? userRole === 'admin' || userRole === 'operativo'
      : true;
  const blocked = !!userRole && !allowed;

  useEffect(() => {
    if (blocked) router.replace("/settings");
  }, [blocked, router]);

  return blocked ? null : <>{children}</>;
}
