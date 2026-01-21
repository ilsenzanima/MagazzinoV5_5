"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    HardHat,
    Package,
    Menu,
    PlusCircle,
    QrCode,
    FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MobileNavBarProps {
    onOpenMenu: () => void;
}

export function MobileNavBar({ onOpenMenu }: MobileNavBarProps) {
    const pathname = usePathname();

    const isActive = (path: string) => pathname === path || pathname?.startsWith(path + "/");

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t dark:border-slate-800 z-50 flex items-center justify-around px-2 pb-safe-area-bottom shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
            {/* 1. Dashboard */}
            <Link
                href="/dashboard"
                className={cn(
                    "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                    isActive("/dashboard")
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
            >
                <LayoutDashboard className="h-5 w-5" />
                <span className="text-[10px] font-medium">Home</span>
            </Link>

            {/* 2. Commesse */}
            <Link
                href="/jobs"
                className={cn(
                    "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                    isActive("/jobs")
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
            >
                <HardHat className="h-5 w-5" />
                <span className="text-[10px] font-medium">Commesse</span>
            </Link>

            {/* 3. Azione Centrale (FAB) - Dropdown per azioni rapide */}
            <div className="relative -top-5">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            size="icon"
                            className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 border-4 border-slate-50 dark:border-background"
                        >
                            <PlusCircle className="h-6 w-6 text-white" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="center" side="top" className="mb-2">
                        <DropdownMenuItem asChild>
                            <Link href="/movements/new" className="flex items-center gap-2 cursor-pointer p-3">
                                <Package className="h-4 w-4" />
                                <span>Nuovo Movimento</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/inventory" className="flex items-center gap-2 cursor-pointer p-3">
                                <QrCode className="h-4 w-4" />
                                <span>Scansiona / Inventario</span>
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/load-notes/new" className="flex items-center gap-2 cursor-pointer p-3">
                                <FileText className="h-4 w-4" />
                                <span>Nuova Nota di Carico</span>
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 4. Inventario */}
            <Link
                href="/inventory"
                className={cn(
                    "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                    isActive("/inventory")
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                )}
            >
                <Package className="h-5 w-5" />
                <span className="text-[10px] font-medium">Inventario</span>
            </Link>

            {/* 5. Menu Altro */}
            <button
                onClick={onOpenMenu}
                className="flex flex-col items-center justify-center w-full h-full space-y-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
                <Menu className="h-5 w-5" />
                <span className="text-[10px] font-medium">Menu</span>
            </button>
        </div>
    );
}
