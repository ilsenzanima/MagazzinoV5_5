"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Worker, workersApi } from "@/lib/api";
import { attendanceApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
    ArrowLeft, Pencil, Trash2, HardHat, Save, Euro,
    Clock, Stethoscope, AlertTriangle, Umbrella, BookOpen,
    CalendarOff, Building2, UserX, Activity, Loader2,
} from "lucide-react";
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

interface YearlyStats {
    presenze: number; orePresenza: number;
    malattie: number; infortuni: number;
    ferie: number; permessi: number;
    corsi: number; visiteMediche: number;
    trasferimenti: number; assenze: number;
    oreRettifica: number; oreTotali: number;
}

function StatCard({ icon: Icon, label, value, colorClass }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | number;
    colorClass?: string;
}) {
    return (
        <Card className="border dark:border-border">
            <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", colorClass ?? "bg-slate-100 dark:bg-slate-800")}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function WorkerDetailContent({ worker: initialWorker }: WorkerDetailContentProps) {
    const router = useRouter();
    const { userRole } = useAuth();
    const { toast } = useToast();
    const [worker, setWorker] = useState<Worker>(initialWorker);
    const [loading, setLoading] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Stats state
    const [stats, setStats] = useState<YearlyStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    // Hourly rate edit state
    const [editingRate, setEditingRate] = useState(false);
    const [rateValue, setRateValue] = useState(String(initialWorker.hourlyRate ?? 25));
    const [savingRate, setSavingRate] = useState(false);

    // Trasferta rate edit state
    const [editingTrasferta, setEditingTrasferta] = useState(false);
    const [trasfertaValue, setTrasfertaValue] = useState(String(initialWorker.trasfertaRate ?? 50));
    const [savingTrasferta, setSavingTrasferta] = useState(false);

    const isAdmin = userRole === 'admin';
    const canEdit = userRole === 'admin' || userRole === 'operativo';
    const currentYear = new Date().getFullYear();

    useEffect(() => {
        attendanceApi.getYearlyStatsByWorker(worker.id).then(setStats).catch(console.error).finally(() => setStatsLoading(false));
    }, [worker.id]);

    const handleToggleStatus = async (checked: boolean) => {
        try {
            setLoading(true);
            const updated = await workersApi.toggleStatus(worker.id, checked);
            setWorker(updated);
            toast({ title: "Stato aggiornato", description: `L'operaio è ora ${checked ? 'Attivo' : 'Inattivo'}.` });
        } catch {
            toast({ variant: "destructive", title: "Errore", description: "Impossibile aggiornare lo stato." });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveRate = async () => {
        const rate = parseFloat(rateValue.replace(',', '.'));
        if (isNaN(rate) || rate < 0) {
            toast({ variant: "destructive", title: "Valore non valido", description: "Inserisci un costo orario valido." });
            return;
        }
        try {
            setSavingRate(true);
            const updated = await workersApi.update(worker.id, { hourlyRate: rate });
            setWorker(updated);
            setEditingRate(false);
            toast({ title: "Costo orario aggiornato" });
        } catch {
            toast({ variant: "destructive", title: "Errore", description: "Impossibile salvare il costo orario." });
        } finally {
            setSavingRate(false);
        }
    };

    const handleSaveTrasferta = async () => {
        const rate = parseFloat(trasfertaValue.replace(',', '.'));
        if (isNaN(rate) || rate < 0) {
            toast({ variant: "destructive", title: "Valore non valido", description: "Inserisci un costo trasferta valido." });
            return;
        }
        try {
            setSavingTrasferta(true);
            const updated = await workersApi.update(worker.id, { trasfertaRate: rate });
            setWorker(updated);
            setEditingTrasferta(false);
            toast({ title: "Costo trasferta aggiornato" });
        } catch {
            toast({ variant: "destructive", title: "Errore", description: "Impossibile salvare il costo trasferta." });
        } finally {
            setSavingTrasferta(false);
        }
    };

    const handleDelete = async () => {
        try {
            setLoading(true);
            await workersApi.delete(worker.id);
            toast({ title: "Operaio eliminato", description: "L'operaio è stato rimosso definitivamente." });
            router.push('/workers');
        } catch {
            toast({ variant: "destructive", title: "Errore", description: "Impossibile eliminare l'operaio." });
            setLoading(false);
        }
    };

    const handleWorkerUpdated = async () => {
        try {
            const updated = await workersApi.getById(worker.id);
            setWorker(updated);
        } catch {
            router.refresh();
        }
        setIsEditOpen(false);
    };

    const tabCount = canEdit ? 4 : 3;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white dark:bg-card p-4 shadow-sm rounded-lg border dark:border-border">
                <div className="flex items-center gap-3 mb-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push('/workers')} className="text-slate-500 hover:text-slate-900">
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Operai
                    </Button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <HardHat className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white capitalize">
                                {worker.firstName} {worker.lastName}
                            </h1>
                            <p className="text-sm text-slate-500">{worker.email || "Nessuna email"}</p>
                        </div>
                        <Badge className={cn("ml-2", worker.isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-500")}>
                            {worker.isActive ? "Attivo" : "Inattivo"}
                        </Badge>
                    </div>

                    {canEdit && (
                        <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Modifica Dati
                        </Button>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="info" className="w-full">
                <TabsList className={cn("grid w-full", tabCount === 4 ? "grid-cols-4" : "grid-cols-3")}>
                    <TabsTrigger value="info">Informazioni</TabsTrigger>
                    <TabsTrigger value="certs">Corsi</TabsTrigger>
                    <TabsTrigger value="medical">Visite Mediche</TabsTrigger>
                    {canEdit && <TabsTrigger value="settings">Impostazioni</TabsTrigger>}
                </TabsList>

                {/* ── INFO ── */}
                <TabsContent value="info" className="mt-4 space-y-4">
                    {/* Dati anagrafici */}
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
                                <div className="font-medium">{new Date(worker.createdAt).toLocaleDateString('it-IT')}</div>
                            </div>
                        </div>
                    </div>

                    {/* Statistiche anno corrente */}
                    <div className="bg-white dark:bg-card p-6 rounded-lg border dark:border-border space-y-4">
                        <h2 className="font-semibold text-slate-900 dark:text-white">
                            Statistiche {currentYear}
                        </h2>

                        {statsLoading ? (
                            <div className="flex justify-center py-6">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            </div>
                        ) : stats ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                <StatCard icon={Activity}      label="Presenze"      value={`${stats.presenze} gg`}                                             colorClass="bg-blue-100 text-blue-700 dark:bg-blue-900/30" />
                                <StatCard icon={Clock}         label="Ore lavorate"  value={`${(stats.orePresenza + stats.oreRettifica).toFixed(1)} h`}          colorClass="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30" />
                                <StatCard icon={Stethoscope}   label="Malattie"      value={`${stats.malattie} gg`}                                             colorClass="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30" />
                                <StatCard icon={AlertTriangle} label="Infortuni"     value={`${stats.infortuni} gg`}                                            colorClass="bg-red-100 text-red-700 dark:bg-red-900/30" />
                                <StatCard icon={Umbrella}      label="Ferie"         value={`${stats.ferie} gg`}                                               colorClass="bg-green-100 text-green-700 dark:bg-green-900/30" />
                                <StatCard icon={CalendarOff}   label="Permessi"      value={`${stats.permessi} gg`}                                             colorClass="bg-teal-100 text-teal-700 dark:bg-teal-900/30" />
                                <StatCard icon={BookOpen}      label="Corsi"         value={`${stats.corsi} gg`}                                               colorClass="bg-purple-100 text-purple-700 dark:bg-purple-900/30" />
                                <StatCard icon={Building2}     label="Trasferimenti" value={`${stats.trasferimenti} gg`}                                        colorClass="bg-orange-100 text-orange-700 dark:bg-orange-900/30" />
                                <StatCard icon={UserX}         label="Assenze"       value={`${stats.assenze} gg`}                                             colorClass="bg-slate-100 text-slate-700 dark:bg-slate-800" />
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">Nessun dato disponibile.</p>
                        )}
                    </div>
                </TabsContent>

                {/* ── CORSI ── */}
                <TabsContent value="certs" className="mt-4">
                    <div className="bg-white dark:bg-card p-6 rounded-lg border dark:border-border">
                        <WorkerCoursesList workerId={worker.id} workerName={worker.firstName} />
                    </div>
                </TabsContent>

                {/* ── VISITE MEDICHE ── */}
                <TabsContent value="medical" className="mt-4">
                    <div className="bg-white dark:bg-card p-6 rounded-lg border dark:border-border">
                        <WorkerMedicalExamsList workerId={worker.id} workerName={worker.firstName} />
                    </div>
                </TabsContent>

                {/* ── IMPOSTAZIONI (solo admin/operativo) ── */}
                {canEdit && (
                    <TabsContent value="settings" className="mt-4 space-y-4">
                        {/* Costo orario */}
                        <div className="bg-white dark:bg-card p-6 rounded-lg border dark:border-border space-y-4">
                            <h2 className="font-semibold text-slate-900 dark:text-white">Costo Orario</h2>
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Costo orario (€/h)</Label>
                                    <div className="text-sm text-muted-foreground">
                                        Utilizzato per il calcolo dei costi di commessa.
                                    </div>
                                </div>
                                {editingRate ? (
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Euro className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                className="pl-8 w-28 text-right"
                                                value={rateValue}
                                                onChange={(e) => setRateValue(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRate(); if (e.key === 'Escape') setEditingRate(false); }}
                                                autoFocus
                                            />
                                        </div>
                                        <Button size="sm" onClick={handleSaveRate} disabled={savingRate}>
                                            {savingRate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => { setEditingRate(false); setRateValue(String(worker.hourlyRate)); }}>
                                            Annulla
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                                            € {worker.hourlyRate.toFixed(2)}/h
                                        </span>
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingRate(true); setRateValue(String(worker.hourlyRate)); }}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Costo trasferta */}
                        <div className="bg-white dark:bg-card p-6 rounded-lg border dark:border-border space-y-4">
                            <h2 className="font-semibold text-slate-900 dark:text-white">Costo Trasferta</h2>
                            <div className="flex items-center justify-between p-4 border rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Costo trasferta (€/h)</Label>
                                    <div className="text-sm text-muted-foreground">
                                        Tariffa oraria applicata durante le trasferte.
                                    </div>
                                </div>
                                {editingTrasferta ? (
                                    <div className="flex items-center gap-2">
                                        <div className="relative">
                                            <Euro className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                            <Input
                                                className="pl-8 w-28 text-right"
                                                value={trasfertaValue}
                                                onChange={(e) => setTrasfertaValue(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTrasferta(); if (e.key === 'Escape') setEditingTrasferta(false); }}
                                                autoFocus
                                            />
                                        </div>
                                        <Button size="sm" onClick={handleSaveTrasferta} disabled={savingTrasferta}>
                                            {savingTrasferta ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => { setEditingTrasferta(false); setTrasfertaValue(String(worker.trasfertaRate)); }}>
                                            Annulla
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                                            € {worker.trasfertaRate.toFixed(2)}/h
                                        </span>
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingTrasferta(true); setTrasfertaValue(String(worker.trasfertaRate)); }}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Stato operativo */}
                        <div className="bg-white dark:bg-card p-6 rounded-lg border dark:border-border space-y-4">
                            <h2 className="font-semibold text-slate-900 dark:text-white">Stato</h2>
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
                        </div>

                        {/* Zona pericolo – solo admin */}
                        {isAdmin && (
                            <div className="bg-white dark:bg-card p-6 rounded-lg border dark:border-border space-y-4">
                                <h2 className="font-semibold text-red-600 dark:text-red-400">Zona Pericolo</h2>
                                <Separator />
                                <div className="flex items-center justify-between p-4 border border-red-200 bg-red-50 rounded-lg dark:bg-red-900/10 dark:border-red-900/50">
                                    <div className="space-y-0.5">
                                        <Label className="text-base text-red-600 dark:text-red-400">Elimina Operaio</Label>
                                        <div className="text-sm text-red-600/80 dark:text-red-400/80">
                                            Eliminazione definitiva dal database e di tutti i dati associati.
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
                            </div>
                        )}
                    </TabsContent>
                )}
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
