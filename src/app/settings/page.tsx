"use client";

import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Impostazioni Generali</h3>
                <p className="text-sm text-muted-foreground">
                    Configura l&apos;aspetto e il comportamento dell&apos;applicazione.
                </p>
            </div>
            <Separator />

            <Card>
                <CardHeader>
                    <CardTitle>Aspetto</CardTitle>
                    <CardDescription>
                        Tema e carattere sono uguali per tutti gli utenti.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-16 items-center justify-center rounded-md border bg-[#E8E8E8]">
                            <div className="h-5 w-5 rounded bg-[#C00016]" />
                        </div>
                        <div>
                            <p className="font-medium">Grigio OPI</p>
                            <p className="text-muted-foreground">Sfondo grigio chiaro con accento rosso OPI.</p>
                        </div>
                    </div>
                    <p>
                        Carattere: <span className="font-medium">Lexend</span>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
