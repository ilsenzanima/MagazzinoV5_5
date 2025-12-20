"use client";

import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

export default function SettingsProfilePage() {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profilo</h3>
        <p className="text-sm text-muted-foreground">
          Gestisci le tue informazioni personali.
        </p>
      </div>
      <Separator />

      <Card>
        <CardHeader>
            <CardTitle>Informazioni Utente</CardTitle>
            <CardDescription>
                Aggiorna la tua foto profilo e i dettagli personali.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={previewImage || "/placeholder-user.jpg"} />
                    <AvatarFallback className="text-lg bg-blue-100 text-blue-700">MR</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                    <Label htmlFor="avatar-upload" className="cursor-pointer">
                        <div className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                            Carica Nuova Foto
                        </div>
                        <Input 
                            id="avatar-upload" 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleImageUpload}
                        />
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        JPG, GIF o PNG. Max 1MB.
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input id="name" defaultValue="Mario Rossi" />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" defaultValue="admin@magazzino.it" disabled className="bg-slate-100" />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="role">Ruolo</Label>
                    <Input id="role" defaultValue="Amministratore" disabled className="bg-slate-100" />
                </div>
            </div>
            
            <div className="flex justify-end">
                <Button className="bg-blue-600 hover:bg-blue-700">Salva Modifiche</Button>
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Sicurezza</CardTitle>
            <CardDescription>
                Aggiorna la tua password.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
             <div className="grid gap-2">
                <Label htmlFor="current_password">Password Attuale</Label>
                <Input id="current_password" type="password" />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="new_password">Nuova Password</Label>
                <Input id="new_password" type="password" />
            </div>
            <div className="grid gap-2">
                <Label htmlFor="confirm_password">Conferma Nuova Password</Label>
                <Input id="confirm_password" type="password" />
            </div>
             <div className="flex justify-end">
                <Button variant="outline">Aggiorna Password</Button>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
