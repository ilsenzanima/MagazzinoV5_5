"use client";

import { Supplier } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Mail, MapPin, Trash2, Building2, ShoppingCart } from "lucide-react";
import Link from "next/link";

interface SupplierCardProps {
    supplier: Supplier;
    canEdit: boolean;
    onDelete: (supplier: Supplier) => void;
}

export function SupplierCard({ supplier, canEdit, onDelete }: SupplierCardProps) {
    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                    <span className="truncate">{supplier.name}</span>
                    <div className="flex gap-2">
                        <Link href={`/suppliers/${supplier.id}`}>
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600 h-8 w-8">
                                <Building2 className="h-4 w-4" />
                            </Button>
                        </Link>
                        {canEdit && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-400 hover:text-red-600 h-8 w-8"
                                onClick={() => onDelete(supplier)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-slate-600 dark:text-slate-400">
                {supplier.vatNumber && (
                    <div className="font-mono text-xs bg-slate-100 dark:bg-muted p-1 rounded w-fit">
                        P.IVA: {supplier.vatNumber}
                    </div>
                )}
                {supplier.address && (
                    <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{supplier.address}</span>
                    </div>
                )}
                {supplier.phone && (
                    <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" />
                        <span>{supplier.phone}</span>
                    </div>
                )}
                {supplier.email && (
                    <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0" />
                        <a href={`mailto:${supplier.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                            {supplier.email}
                        </a>
                    </div>
                )}
                <div className="pt-2 mt-2 border-t dark:border-slate-700 flex justify-end">
                    <Link href={`/purchases?supplierId=${supplier.id}`}>
                        <Button variant="outline" size="sm">
                            <ShoppingCart className="mr-2 h-3 w-3" />
                            Vedi Acquisti
                        </Button>
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
