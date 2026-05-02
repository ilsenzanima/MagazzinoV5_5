"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Worker, workersApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Pencil, Trash2, HardHat } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/ui/use-toast";
import { WorkerCoursesList } from "@/app/workers/components/worker-courses-list";
import { WorkerMedicalExamsList } from "@/app/workers/components/worker-medical-exams-list";
import { WorkerDialog } from "@/app/workers/components/worker-dialog";
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
import { cn } from "@/lib/utils";

interface WorkerDetailContentProps {
    worker: Worker;
}

export default function WorkerDetailContent({ worker: initialWorker }: WorkerDetailContentProps) {
    const router = useRouter();
    const { userRole } = useAuth();
    const { toast } = useToast();
    const [worker, setWorker] = useState<Worker>(initialWorker);
    const [loading, setLoading] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const isAdmin = userRole === 'admin';
    const canEdit = userRole === 'admin' || userRole === 'operativo';

    const handleToggleStatus = async (checked: boolean) => {
        try {
            setLoading(true);
            const updated = await workersApi.toggleStatus(worker.id, checked);
            setWorker(updated);
            toast({
                title: "Stato aggiornato",
                description: `L'operaio è ora ${checked ? 'Attivo' : 'Inattivo'}.`,
            });
        } catch {
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
            router.push('/workers');
        } catch {
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Impossibile eliminare l'operaio.",
            });
            setLoading(false);
        }
    };

    const handleWorkerUpdated = async () => {
        try {
            const updated = await workersApi.getById(worker.id);
            setWorker(updated);
        } catch {
            // fallback to page refresh if reload fails
            router.refresh();
        }
        setIsEditOpen(false);
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white dark:bg-card p-4 shadow-sm rounded-lg border dark:border-border">
                <div className="flex items-center gap-3 mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push('/workers')}
                        className="text-slate-500 hover:text-slate-900"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Operai
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <HardHat className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
                                {worker.firstName} {worker.lastName}
                            </h1>
                            <p className="text-sm text-slate-500">{worker.email || "Nessuna email"}</p>
                        </div>
                        <Badge
                            className={cn(
                                "ml-2",
                                worker.isActive
                                    ? "bg-green-100 text-green-700 border-green-200"
                                    : "bg-slate-100 text-slate-500"
                            )}
                        >
                            {worker.isActive ? "Attivo" : "Inattivo"}
                        </Badge>
                    </div>

                    {canEdit && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsEditOpen(true)}
                        >
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifica Dati
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="info">Informazioni</TabsTrigger>
                    <TabsTrigger value="certs">Corsi</TabsTrigger>
                    <TabsTrigger value="medical">Visite Mediche</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-4 space-y-4">
                    <div className="bg-white dark:bg-card p-6 rounded-lg border dark:border-border space-y-4">
                        <h2 className="font-semibold text-slate-900 dark:text-white">Dati Anagrafici</h2>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-1">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Nome</Label>
                                <div className="font-medium capitalize">{worker.firstName}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Cognome</Label>
                                <div className="font-medium capitalize">{worker.lastName}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Email</Label>
                                <div className="font-medium">{worker.email || "-"}</div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Data Registrazione</Label>
                                <div className="font-medium">
                                    {new Date(worker.createdAt).toLocaleDateString('it-IT')}
                                </div>
                            </div>
                        </div>
                    </div>

                    {canEdit && (
                        <div className="bg-white dark:bg-card p-6 rounded-lg border dark:border-border space-y-4">
                            <h2 className="font-semibold text-slate-900 dark:text-white">Impostazioni</h2>

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
                                <>
                                    <Separator />
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
                                </>
                            )}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="certs" className="mt-4">
                    <div className="bg-white dark:bg-card p-6 rounded-lg border dark:border-border">
                        <WorkerCoursesList workerId={worker.id} workerName={worker.firstName} />
                    </div>
                </TabsContent>

                <TabsContent value="medical" className="mt-4">
                    <div className="bg-white dark:bg-card p-6 rounded-lg border dark:border-border">
                        <WorkerMedicalExamsList workerId={worker.id} workerName={worker.firstName} />
                    </div>
                </TabsContent>
            </Tabs>

            <WorkerDialog
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                workerToEdit={worker}
                onSuccess={handleWorkerUpdated}
            />
        </div>
    );
}
