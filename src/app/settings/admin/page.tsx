"use client";

import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { mockUsers } from "@/lib/mock-data";
import { Shield, ShieldAlert, Trash2, UserCog } from "lucide-react";

export default function SettingsAdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-red-600 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Area Amministrazione
        </h3>
        <p className="text-sm text-muted-foreground">
          Gestione utenti e permessi. Visibile solo agli amministratori.
        </p>
      </div>
      <Separator />

      <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle>Utenti Registrati</CardTitle>
                    <CardDescription>
                        Elenco degli utenti con accesso al sistema.
                    </CardDescription>
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Invita Utente</Button>
            </div>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                {mockUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50">
                        <div className="flex items-center gap-4">
                            <Avatar>
                                <AvatarFallback className="bg-slate-200 text-slate-700">{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium text-sm">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className={user.role === 'admin' ? "bg-slate-900" : ""}>
                                    {user.role === 'admin' ? 'Amministratore' : 'Utente'}
                                </Badge>
                                <Badge variant="outline" className={user.status === 'active' ? "text-green-600 border-green-200 bg-green-50" : "text-slate-400 bg-slate-50"}>
                                    {user.status === 'active' ? 'Attivo' : 'Inattivo'}
                                </Badge>
                            </div>
                            
                            <div className="flex gap-1">
                                <Button variant="ghost" size="icon" title="Modifica Ruolo">
                                    <Shield className="h-4 w-4 text-slate-500" />
                                </Button>
                                <Button variant="ghost" size="icon" title="Modifica Utente">
                                    <UserCog className="h-4 w-4 text-slate-500" />
                                </Button>
                                <Button variant="ghost" size="icon" title="Elimina" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
