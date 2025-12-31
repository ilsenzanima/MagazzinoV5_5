"use client";

import { Client } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

interface ClientCardProps {
    client: Client;
    canEdit: boolean;
    onEdit: (client: Client) => void;
    onDelete: (client: Client) => void;
}

export function ClientCard({ client, canEdit, onEdit, onDelete }: ClientCardProps) {
    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{client.name}</span>
                    {canEdit && (
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-blue-600 h-8 w-8"
                                onClick={() => onEdit(client)}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-red-600 h-8 w-8"
                                onClick={() => onDelete(client)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </CardTitle>
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
                            {client.postalCode} {client.city} {client.province && `(${client.province})`}
                        </span>
                    </div>
                )}
                {client.email && (
                    <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0" />
                        <a href={`mailto:${client.email}`} className="hover:underline text-blue-600 dark:text-blue-400">
                            {client.email}
                        </a>
                    </div>
                )}
                {client.phone && (
                    <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" />
                        <a href={`tel:${client.phone}`} className="hover:underline">
                            {client.phone}
                        </a>
                    </div>
                )}
                <div className="pt-2 mt-2 border-t dark:border-slate-700 flex justify-end">
                    <Link href={`/jobs?clientId=${client.id}`}>
                        <Button variant="outline" size="sm">Vedi Commesse</Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
