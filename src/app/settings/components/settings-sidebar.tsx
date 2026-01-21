"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  User,
  Bell,
  Settings,
  Shield,
  Database,
  HardDrive
} from "lucide-react";

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

  return (
    <nav
      className={cn(
        "flex flex-wrap gap-2 overflow-x-auto pb-2",
        className
      )}
      {...props}
    >
      {sidebarNavItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            pathname === item.href
              ? "bg-slate-200 dark:bg-slate-700 text-foreground font-semibold"
              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground hover:text-foreground",
            "justify-start whitespace-nowrap transition-colors"
          )}
        >
          <item.icon className="mr-2 h-4 w-4" />
          {item.title}
        </Link>
      ))}
    </nav>
  );
}
