"use client";

import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { inventoryApi, usersApi } from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { User } from "@/lib/mock-data";

export default function SettingsAdminPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    
    const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
    
    // Connection State
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);

    // Seed State
    const [seedLoading, setSeedLoading] = useState(false);
    const [seedResult, setSeedResult] = useState<{success: boolean, message: string} | null>(null);
    
    const supabase = createClient();

    useEffect(() => {
        checkConnection();
    }, [currentUser]);

    useEffect(() => {
        if (userRole === 'admin') {
            fetchUsers();
        }
    }, [userRole]);

    const checkConnection = async () => {
        try {
            setConnectionStatus('checking');
            const { error } = await supabase
                .from('inventory')
                .select('id')
                .limit(1);
            
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

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const data = await usersApi.getAll();
            setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const handleUpdateRole = async () => {
        if (!selectedUser) return;
        
        try {
            await usersApi.updateRole(selectedUser.id, newRole);
            
            setUsers(users.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u));
            setIsEditRoleOpen(false);
        } catch (error: any) {
            console.error("Error updating role:", error);
            alert("Errore nell'aggiornamento del ruolo: " + error.message);
        }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo utente?")) return;

        try {
            await usersApi.delete(userId);
            setUsers(users.filter(u => u.id !== userId));
        } catch (error: any) {
            console.error("Error deleting user:", error);
            alert("Errore nell'eliminazione dell'utente: " + error.message);
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

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Amministrazione</h3>
                <p className="text-sm text-muted-foreground">
                    Gestisci utenti, ruoli e impostazioni globali del sistema.
                </p>
            </div>

            <Separator />

            {/* Connection Status */}
            <Card className={connectionStatus === 'connected' ? "border-green-500" : connectionStatus === 'error' ? "border-red-500" : ""}>
                 <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center">
                        {connectionStatus === 'checking' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {connectionStatus === 'connected' && <Shield className="mr-2 h-4 w-4 text-green-500" />}
                        {connectionStatus === 'error' && <ShieldAlert className="mr-2 h-4 w-4 text-red-500" />}
                        Stato Connessione Supabase
                    </CardTitle>
                 </CardHeader>
                 <CardContent>
                    <div className="text-sm">
                        {connectionStatus === 'checking' && "Verifica connessione in corso..."}
                        {connectionStatus === 'connected' && (
                            <div className="flex justify-between items-center">
                                <span>Connesso al database.</span>
                                <Badge variant={userRole === 'admin' ? "default" : "secondary"}>
                                    Ruolo attuale: {userRole?.toUpperCase()}
                                </Badge>
                            </div>
                        )}
                        {connectionStatus === 'error' && (
                            <div className="text-red-500">
                                {errorMessage}
                            </div>
                        )}
                    </div>
                 </CardContent>
            </Card>

            {userRole === 'admin' ? (
                <>
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Gestione Utenti</CardTitle>
                                    <CardDescription>
                                        Visualizza e modifica i ruoli degli utenti registrati.
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {loadingUsers ? (
                                    <div className="flex justify-center p-4">
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                ) : (
                                    users.map((user) => (
                                        <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                                            <div className="flex items-center space-x-4">
                                                <Avatar>
                                                    <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-medium leading-none">{user.name}</p>
                                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                                    {user.role}
                                                </Badge>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedUser(user);
                                                        setNewRole(user.role);
                                                        setIsEditRoleOpen(true);
                                                    }}
                                                >
                                                    <UserCog className="h-4 w-4" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => handleDeleteUser(user.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                         <CardHeader>
                            <CardTitle>Operazioni Database</CardTitle>
                            <CardDescription>
                                Azioni di manutenzione e setup iniziale.
                            </CardDescription>
                         </CardHeader>
                         <CardContent>
                            <Button 
                                onClick={handleSeedData} 
                                disabled={seedLoading}
                                variant="outline"
                            >
                                {seedLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Popola Database con Dati di Prova
                            </Button>
                            
                            {seedResult && (
                                <Alert className={`mt-4 ${seedResult.success ? "border-green-500 text-green-700 bg-green-50" : "border-red-500 text-red-700 bg-red-50"}`}>
                                    <AlertTitle>{seedResult.success ? "Successo" : "Errore"}</AlertTitle>
                                    <AlertDescription>
                                        {seedResult.message}
                                    </AlertDescription>
                                </Alert>
                            )}
                         </CardContent>
                    </Card>
                </>
            ) : (
                <Alert>
                    <ShieldAlert className="h-4 w-4" />
                    <AlertTitle>Accesso Limitato</AlertTitle>
                    <AlertDescription>
                        Non hai i permessi di amministratore per visualizzare questa sezione.
                    </AlertDescription>
                </Alert>
            )}

            <Dialog open={isEditRoleOpen} onOpenChange={setIsEditRoleOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Modifica Ruolo Utente</DialogTitle>
                        <DialogDescription>
                            Cambia il ruolo per {selectedUser?.email}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="role" className="text-right">
                                Ruolo
                            </Label>
                            <Select 
                                value={newRole} 
                                onValueChange={(value: 'admin' | 'user') => setNewRole(value)}
                            >
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Seleziona un ruolo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditRoleOpen(false)}>Annulla</Button>
                        <Button onClick={handleUpdateRole}>Salva Modifiche</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
