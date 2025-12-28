"use client"

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription, SheetHeader } from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  BarChart3,
  Settings,
  Menu,
  LogOut,
  Loader2,
  ShoppingCart,
  Truck,
  Users,
  Building2
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/components/auth-provider";
import { useEffect, useState } from "react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  onLinkClick?: () => void;
}

export function Sidebar({ className, onLinkClick }: SidebarProps) {
  const pathname = usePathname();
  const { user, signOut, userRole } = useAuth();

  const routeGroups = [
    {
      items: [
        {
          label: "Dashboard",
          icon: LayoutDashboard,
          href: "/dashboard",
          active: pathname === "/dashboard",
        },
      ]
    },
    {
      items: [
        {
          label: "Inventario",
          icon: Package,
          href: "/inventory",
          active: pathname === "/inventory" || pathname.startsWith("/inventory/"),
        },
        {
          label: "Acquisti",
          icon: ShoppingCart,
          href: "/purchases",
          active: pathname === "/purchases" || pathname.startsWith("/purchases/"),
        },
        {
          label: "Fornitori",
          icon: Building2,
          href: "/suppliers",
          active: pathname === "/suppliers" || pathname.startsWith("/suppliers/"),
        },
        {
          label: "Movimentazione",
          icon: Truck,
          href: "/movements",
          active: pathname === "/movements" || pathname.startsWith("/movements/"),
        },
      ]
    },
    {
      items: [
        {
          label: "Commesse",
          icon: ClipboardList,
          href: "/jobs",
          active: pathname === "/jobs" || pathname.startsWith("/jobs/"),
        },
        {
          label: "Committenti",
          icon: Users,
          href: "/clients",
          active: pathname === "/clients" || pathname.startsWith("/clients/"),
        },
      ]
    },
    {
      items: [
        {
          label: "Report",
          icon: BarChart3,
          href: "/reports",
          active: pathname === "/reports",
        },
      ]
    }
  ];

  return (
    <div className={cn("pb-12 h-full bg-slate-900 text-white flex flex-col", className)}>
      <div className="space-y-4 py-4 flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <h2 className="mb-6 px-4 text-lg font-semibold tracking-tight text-blue-400">
            Magazzino V5.5
          </h2>

          <div className="space-y-4">
            {routeGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-1">
                {group.items.map((route) => (
                  <Link key={route.href} href={route.href} onClick={onLinkClick}>
                    <Button
                      variant={route.active ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start",
                        route.active ? "bg-slate-800 text-white hover:bg-slate-800" : "text-slate-400 hover:text-white hover:bg-slate-800"
                      )}
                    >
                      <route.icon className="mr-2 h-4 w-4" />
                      {route.label}
                    </Button>
                  </Link>
                ))}
                {groupIndex < routeGroups.length - 1 && (
                  <div className="my-2 border-t border-slate-800 mx-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-900 border-t border-slate-800">
        <Link href="/settings" onClick={onLinkClick}>
          <Button
            variant={pathname === "/settings" ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start mb-2",
              pathname === "/settings" ? "bg-slate-800 text-white hover:bg-slate-800" : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <Settings className="mr-2 h-4 w-4" />
            Impostazioni
          </Button>
        </Link>

        {user && (
          <div className="mb-4 px-2 flex items-center space-x-3 bg-slate-800/50 p-2 rounded-md">
            <Avatar className="h-8 w-8">
              <AvatarImage src={`/avatars/${userRole || 'user'}.png`} />
              <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{user.email}</p>
              <p className="text-xs text-slate-400 capitalize">{userRole || 'User'}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-slate-800"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Esci
        </Button>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, loading, userRole, realRole, simulatedRole, setSimulatedRole } = useAuth();
  const router = useRouter();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      router.push("/login");
    }
  }, [loading, session, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-background">
      {/* Simulation Banner */}
      {simulatedRole && (
        <div className="fixed top-0 left-0 right-0 h-10 bg-amber-500 text-white z-[60] flex items-center justify-center px-4 font-bold shadow-md">
          <span className="mr-4">
            MODALITÀ SIMULAZIONE: Stai vedendo il sito come {simulatedRole.toUpperCase()}
          </span>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs bg-white text-amber-600 hover:bg-amber-50"
            onClick={() => setSimulatedRole(null)}
          >
            ESCI DALLA SIMULAZIONE
          </Button>
        </div>
      )}

      {/* Sidebar Desktop */}
      <div className={cn(
        "hidden md:flex h-screen w-64 flex-col fixed left-0 border-r border-slate-800 z-50 transition-all",
        simulatedRole ? "top-10 h-[calc(100vh-40px)]" : "top-0"
      )}>
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className={cn(
        "flex-1 md:pl-64 flex flex-col min-h-screen transition-all",
        simulatedRole ? "pt-10" : ""
      )}>

        {/* Mobile Header with Hamburger */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm">
          <div className="font-bold text-lg text-slate-900 dark:text-white">Magazzino V5.5</div>
          <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-slate-900 border-r-slate-800 text-white w-64">
              <SheetHeader className="sr-only">
                <SheetTitle>Menu di Navigazione</SheetTitle>
                <SheetDescription>Navigazione principale dell'applicazione</SheetDescription>
              </SheetHeader>
              <Sidebar onLinkClick={() => setIsSheetOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
