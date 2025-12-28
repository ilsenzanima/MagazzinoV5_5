"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Trash2, FileText, Award } from "lucide-react";
import { Worker, workersApi } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface WorkerDetailsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    worker: Worker | null;
    onUpdate: () => void;
    onEdit: (worker: Worker) => void;
}

export function WorkerDetailsDialog({
    open,
    onOpenChange,
    worker,
    onUpdate,
    onEdit,
}: WorkerDetailsDialogProps) {
    const { userRole } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const isAdmin = userRole === 'admin';
    const canEdit = userRole === 'admin' || userRole === 'operativo';

    if (!worker) return null;

    const handleToggleStatus = async (checked: boolean) => {
        try {
            setLoading(true);
            await workersApi.toggleStatus(worker.id, checked);
            toast({
                title: "Stato aggiornato",
                description: `L'operaio è ora ${checked ? 'Attivo' : 'Inattivo'}.`,
            });
            onUpdate();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Impossibile aggiornare lo stato.",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        try {
            setLoading(true);
            await workersApi.delete(worker.id);
            toast({
                title: "Operaio eliminato",
                description: "L'operaio è stato rimosso definitivamente.",
            });
            onUpdate();
            onOpenChange(false);
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Impossibile eliminare l'operaio.",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-xl">
                                {worker.firstName} {worker.lastName}
                            </DialogTitle>
                            <DialogDescription className="text-sm mt-1">
                                {worker.email}
                            </DialogDescription>
                        </div>
                        <Badge variant={worker.isActive ? "default" : "secondary"}>
                            {worker.isActive ? "Attivo" : "Inattivo"}
                        </Badge>
                    </div>
                </DialogHeader>

                <Tabs defaultValue="info" className="w-full mt-4">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="info">Informazioni</TabsTrigger>
                        <TabsTrigger value="certs">Corsi & Certificati</TabsTrigger>
                    </TabsList>

                    <TabsContent value="info" className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-muted-foreground">Nome</Label>
                                <div className="font-medium">{worker.firstName}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-muted-foreground">Cognome</Label>
                                <div className="font-medium">{worker.lastName}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-muted-foreground">Email</Label>
                                <div className="font-medium">{worker.email || "-"}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-muted-foreground">Data Registrazione</Label>
                                <div className="font-medium">
                                    {new Date(worker.createdAt).toLocaleDateString('it-IT')}
                                </div>
                            </div>
                        </div>

                        {canEdit && (
                            <>
                                <Separator className="my-4" />
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between p-4 border rounded-lg">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Stato Operativo</Label>
                                            <div className="text-sm text-muted-foreground">
                                                Disattiva per nascondere dalle liste operative senza eliminare.
                                            </div>
                                        </div>
                                        <Switch
                                            checked={worker.isActive}
                                            onCheckedChange={handleToggleStatus}
                                            disabled={loading}
                                        />
                                    </div>

                                    {isAdmin && (
                                        <div className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg dark:bg-red-900/10 dark:border-red-900/50">
                                            <div className="space-y-0.5">
                                                <Label className="text-base text-red-600 dark:text-red-400">Zona Pericolo</Label>
                                                <div className="text-sm text-red-600/80 dark:text-red-400/80">
                                                    Eliminazione definitiva dal database.
                                                </div>
                                            </div>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm" disabled={loading}>
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Elimina
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Sei assolutamente sicuro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Questa azione non può essere annullata. Eliminerà definitivamente
                                                            l'operaio <strong>{worker.firstName} {worker.lastName}</strong> e tutti i dati associati.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                                            Elimina Definitivamente
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="certs" className="py-4">
                        <div className="flex flex-col items-center justify-center py-8 text-center border-2 border-dashed rounded-lg bg-slate-50 dark:bg-slate-900/50">
                            <Award className="h-12 w-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                                Sezione in Sviluppo
                            </h3>
                            <p className="text-sm text-slate-500 max-w-sm mt-2">
                                Qui sarà possibile gestire i corsi di formazione, le scadenze e i certificati caricati per {worker.firstName}.
                            </p>
                            <Button variant="outline" className="mt-6" disabled>
                                <FileText className="mr-2 h-4 w-4" />
                                Carica Certificato
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter className="sm:justify-between">
                    <div /> {/* Spacer */}
                    {canEdit && (
                        <Button type="button" onClick={() => {
                            onEdit(worker);
                        }}>
                            Modifica Dati
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
