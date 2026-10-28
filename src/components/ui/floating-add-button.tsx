"use client"

import Link from "next/link";
import { Plus } from "lucide-react";

interface FloatingAddButtonProps {
    href: string;
    label: string;
}

// Pulsante «aggiungi» sempre visibile in basso a destra (solo da PC): tondo con il +,
// passandoci sopra si allarga e compare la scritta per intero
export function FloatingAddButton({ href, label }: FloatingAddButtonProps) {
    return (
        <Link
            href={href}
            aria-label={label}
            className="group fixed bottom-10 right-10 z-20 hidden h-14 w-14 items-center overflow-hidden rounded-full bg-blue-600 text-white shadow-lg transition-all duration-300 ease-out hover:w-56 hover:bg-blue-700 focus-visible:w-56 focus-visible:bg-blue-700 md:flex"
        >
            <span className="grid h-14 w-14 shrink-0 place-items-center">
                <Plus className="h-7 w-7" />
            </span>
            <span className="whitespace-nowrap pr-6 text-sm font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                {label}
            </span>
        </Link>
    );
}
