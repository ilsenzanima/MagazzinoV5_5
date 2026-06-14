"use client";

import { Client } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import Link from "next/link";

interface ClientCardProps {
    client: Client;
}

export function ClientCard({ client }: ClientCardProps) {
    const addressLine = [
        client.street ? `${client.street}${client.streetNumber ? ' ' + client.streetNumber : ''}` : '',
        client.postalCode || '',
        client.city || '',
        client.province ? `(${client.province.toUpperCase()})` : '',
    ].filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/ ,/g, ',').trim();

    return (
        <Link href={`/clients/${client.id}`} className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-3">
                    <div className="font-semibold text-slate-800 dark:text-white text-sm leading-tight">{client.name}</div>
                    {addressLine && (
                        <div className="flex items-start gap-1.5 mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="leading-tight">{addressLine}</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
