"use client";

import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsNotificationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Notifiche</h3>
        <p className="text-sm text-muted-foreground">
          Scegli cosa vuoi ricevere via email o notifica push.
        </p>
      </div>
      <Separator />

      <Card>
         <CardHeader>
            <CardTitle>Avvisi Inventario</CardTitle>
            <CardDescription>
                Ricevi notifiche quando lo stato del magazzino cambia.
            </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="low_stock" className="flex flex-col space-y-1">
                    <span>Scorta Bassa</span>
                    <span className="font-normal text-xs text-muted-foreground">Avvisami quando un articolo scende sotto la soglia minima.</span>
                </Label>
                <Switch id="low_stock" defaultChecked />
            </div>
            <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="out_of_stock" className="flex flex-col space-y-1">
                    <span>Articolo Esaurito</span>
                    <span className="font-normal text-xs text-muted-foreground">Avvisami quando un articolo arriva a zero.</span>
                </Label>
                <Switch id="out_of_stock" defaultChecked />
            </div>
         </CardContent>
      </Card>

       <Card>
         <CardHeader>
            <CardTitle>Sistema</CardTitle>
            <CardDescription>
                Notifiche relative al sistema e alla sicurezza.
            </CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="security" className="flex flex-col space-y-1">
                    <span>Avvisi di Sicurezza</span>
                    <span className="font-normal text-xs text-muted-foreground">Nuovi accessi da dispositivi sconosciuti.</span>
                </Label>
                <Switch id="security" defaultChecked />
            </div>
            <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="updates" className="flex flex-col space-y-1">
                    <span>Aggiornamenti Sistema</span>
                    <span className="font-normal text-xs text-muted-foreground">Novità sulle funzionalità.</span>
                </Label>
                <Switch id="updates" />
            </div>
         </CardContent>
      </Card>
    </div>
  );
}
