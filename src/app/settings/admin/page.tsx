"use client";

import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { mockUsers, User } from "@/lib/mock-data";
import { Shield, ShieldAlert, Trash2, UserCog, UserPlus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inventoryApi } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";

export default function SettingsAdminPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>(mockUsers);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    
    // Connection State
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    // Seed State
    const [seedLoading, setSeedLoading] = useState(false);
    const [seedResult, setSeedResult] = useState<{success: boolean, message: string} | null>(null);

    // Mock form state
    const [newUser, setNewUser] = useState({ name: "", email: "", role: "user" });

    useEffect(() => {
        checkConnection();
    }, [currentUser]);

    const checkConnection = async () => {
        try {
            setConnectionStatus('checking');
            // Check basic connection by querying a public table or just ensuring client is ready
            // We use inventory count as a simple check
            const { count, error } = await supabase
                .from('inventory')
                .select('*', { count: 'exact', head: true });
            
            if (error) throw error;
            
            setConnectionStatus('connected');
            
            if (currentUser) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', currentUser.id)
                    .single();
                setUserRole(profile?.role || 'user');
            }
        } catch (err: any) {
            console.error("Connection error:", err);
            setConnectionStatus('error');
            setErrorMessage(err.message || "Impossibile connettersi a Supabase");
        }
    };

    const handleSeedData = async () => {
        setSeedLoading(true);
        setSeedResult(null);
        try {
            await inventoryApi.seed();
            setSeedResult({ success: true, message: "Database popolato con successo!" });
        } catch (error: any) {
            setSeedResult({ success: false, message: error.message || "Errore durante il popolamento." });
        } finally {
            setSeedLoading(false);
        }
    };

    const handleCreateUser = () => {
        const id = Math.random().toString(36).substring(7);
        const user: User = {
            id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role as 'admin' | 'user',
            status: 'active',
            lastLogin: '-'
        };
        setUsers([...users, user]);
        setIsCreateOpen(false);
        setNewUser({ name: "", email: "", role: "user" });
    };

    const handleDeleteUser = () => {
        if (selectedUser) {
            setUsers(users.filter(u => u.id !== selectedUser.id));
            setIsDeleteOpen(false);
            setSelectedUser(null);
        }
    };

    const handleUpdateRole = (role: string) => {
        if (selectedUser) {
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, role: role as 'admin' | 'user' } : u));
            setIsEditRoleOpen(false);
            setSelectedUser(null);
        }
    };

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

      {/* Connection Status & Debug Info */}
      <Card className="mb-6">
        <CardHeader>
            <CardTitle className="text-sm font-medium">Stato Connessione</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' : 
                    connectionStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <span className="text-sm font-medium">
                    {connectionStatus === 'connected' ? 'Supabase Connesso' : 
                     connectionStatus === 'error' ? 'Errore Connessione' : 'Verifica in corso...'}
                </span>
            </div>
            {errorMessage && (
                <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
            )}
            {currentUser && (
                <div className="mt-2 text-xs text-slate-500">
                    <p>User ID: {currentUser.id}</p>
                    <p>Role: {userRole || 'Loading...'}</p>
                    {userRole === 'user' && (
                        <p className="text-amber-600 font-bold mt-1">
                            Attenzione: Sei un utente standard. Non puoi modificare il database.
                            Chiedi all'amministratore di promuoverti o usa SQL Editor.
                        </p>
                    )}
                </div>
            )}
        </CardContent>
      </Card>

      <Card className="mb-6 border-amber-200 bg-amber-50">
        <CardHeader>
            <CardTitle>Popolamento Database</CardTitle>
            <CardDescription>
                Carica dati di esempio nel database. Utile per il primo avvio.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-4">
                <Button 
                    variant="outline" 
                    className="border-amber-600 text-amber-700 hover:bg-amber-100"
                    onClick={handleSeedData}
                    disabled={seedLoading}
                >
                    {seedLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Popola Dati di Esempio
                </Button>
                {seedResult && (
                    <span className={`text-sm ${seedResult.success ? 'text-green-600' : 'text-red-600'}`}>
                        {seedResult.message}
                    </span>
                )}
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle>Utenti Registrati</CardTitle>
                    <CardDescription>
                        Elenco degli utenti con accesso al sistema.
                    </CardDescription>
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setIsCreateOpen(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Crea Utente
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                {users.map((user) => (
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
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    title="Modifica Ruolo"
                                    onClick={() => { setSelectedUser(user); setIsEditRoleOpen(true); }}
                                >
                                    <Shield className="h-4 w-4 text-slate-500" />
                                </Button>
                                <Button variant="ghost" size="icon" title="Modifica Utente">
                                    <UserCog className="h-4 w-4 text-slate-500" />
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    title="Elimina" 
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={() => { setSelectedUser(user); setIsDeleteOpen(true); }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Crea Nuovo Utente</DialogTitle>
                <DialogDescription>Aggiungi un nuovo utente al sistema.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nome</Label>
                    <Input id="name" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role">Ruolo</Label>
                    <Select value={newUser.role} onValueChange={(val) => setNewUser({...newUser, role: val})}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="user">Utente Standard</SelectItem>
                            <SelectItem value="admin">Amministratore</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annulla</Button>
                <Button onClick={handleCreateUser} className="bg-blue-600 hover:bg-blue-700">Crea Utente</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditRoleOpen} onOpenChange={setIsEditRoleOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Modifica Ruolo</DialogTitle>
                <DialogDescription>Cambia i permessi per {selectedUser?.name}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Select defaultValue={selectedUser?.role} onValueChange={handleUpdateRole}>
                    <SelectTrigger>
                        <SelectValue placeholder="Seleziona ruolo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="user">Utente Standard</SelectItem>
                        <SelectItem value="admin">Amministratore</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Elimina Utente</DialogTitle>
                <DialogDescription>
                    Sei sicuro di voler eliminare l'utente <strong>{selectedUser?.name}</strong>? 
                    Questa azione non può essere annullata.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Annulla</Button>
                <Button variant="destructive" onClick={handleDeleteUser}>Elimina</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
