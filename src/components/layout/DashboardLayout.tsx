"use client"

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { 
  LayoutDashboard, 
  Package, 
  ClipboardList, 
  BarChart3, 
  Settings, 
  Menu,
  LogOut,
  Loader2
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

  const routes = [
    {
      label: "Dashboard",
      icon: LayoutDashboard,
      href: "/dashboard",
      active: pathname === "/dashboard",
    },
    {
      label: "Inventario",
      icon: Package,
      href: "/inventory",
      active: pathname === "/inventory",
    },
    {
      label: "Committenti",
      icon: Menu, // Temporary generic icon
      href: "/clients",
      active: pathname === "/clients",
    },
    {
      label: "Commesse",
      icon: ClipboardList,
      href: "/jobs",
      active: pathname === "/jobs",
    },
    {
      label: "Acquisti",
      icon: ClipboardList,
      href: "/purchases",
      active: pathname === "/purchases",
    },
    {
      label: "Report",
      icon: BarChart3,
      href: "/reports", // Placeholder
      active: pathname === "/reports",
    },
    {
      label: "Impostazioni",
      icon: Settings,
      href: "/settings", // Placeholder
      active: pathname === "/settings",
    },
  ];

  return (
    <div className={cn("pb-12 h-full bg-slate-900 text-white", className)}>
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight text-blue-400">
            Magazzino V5.5
          </h2>
          <div className="space-y-1">
            {routes.map((route) => (
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
          </div>
        </div>
      </div>
      <div className="absolute bottom-4 left-0 w-full px-3">
        {user && (
          <div className="mb-4 px-4 flex items-center space-x-3">
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
  const { session, loading } = useAuth();
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
      {/* Sidebar Desktop */}
      <div className="hidden md:flex h-screen w-64 flex-col fixed left-0 top-0 border-r border-slate-800 z-50">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        
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
