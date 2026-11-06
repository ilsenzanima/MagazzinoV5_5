"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NotchTabs } from "@/components/ui/notch-tabs";
import { useRouter } from "next/navigation";
import {
  User,
  Bell,
  Settings,
  Shield,
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
  {
    title: "Amministrazione",
    href: "/settings/admin",
    icon: Shield,
  },
];

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> { }

export function SidebarNav({ className, ...props }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { userRole, realRole } = useAuth();

  const items = sidebarNavItems
    .filter(item => {
      if (item.href === "/settings/admin" || item.href === "/settings/backup") {
        // Show if effectively admin OR real admin (so they can disable simulation)
        return userRole === 'admin' || realRole === 'admin';
      }
      return true;
    })
    .map(item => ({ value: item.href, label: item.title, icon: <item.icon /> }));

  return (
    <div className={className}>
      <NotchTabs title="Impostazioni" items={items} value={pathname} onValueChange={(href) => router.push(href)} />
    </div>
  );
}
