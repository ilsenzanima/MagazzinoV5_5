"use client";

import { Client } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, MapPin } from "lucide-react";
import Link from "next/link";

interface ClientCardProps {
    client: Client;
}

export function ClientCard({ client }: ClientCardProps) {
    return (
        <Link href={`/clients/${client.id}`} className="block">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                    <CardTitle className="break-words">{client.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    {client.vatNumber && (
                        <div className="flex items-center gap-2">
                            <span className="font-semibold w-8">P.IVA</span>
                            <span>{client.vatNumber}</span>
                        </div>
                    )}
                    {(client.street || client.city) && (
                        <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>
                                {client.street} {client.streetNumber}
                                {client.street && client.city && ", "}
                                {client.postalCode} {client.city} {client.province && `(${client.province.toUpperCase()})`}
                            </span>
                        </div>
                    )}
                    {client.email && (
                        <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 shrink-0" />
                            <span className="text-blue-600 dark:text-blue-400">{client.email}</span>
                        </div>
                    )}
                    {client.phone && (
                        <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0" />
                            <span>{client.phone}</span>
                        </div>
                    )}
                </CardContent>
            </Card>
        </Link>
    );
}
