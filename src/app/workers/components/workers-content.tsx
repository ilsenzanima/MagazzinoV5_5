"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Worker, workersApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, HardHat, Mail, Pencil, Calendar } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { WorkerDialog } from "./worker-dialog";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { ViewToggle } from "@/components/ui/view-toggle";
import { useViewMode } from "@/hooks/useViewMode";

interface WorkersContentProps {
    initialWorkers: Worker[];
}

export default function WorkersContent({ initialWorkers }: WorkersContentProps) {
    const router = useRouter();
    const [workers, setWorkers] = useState<Worker[]>(initialWorkers);
    const [search, setSearch] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const { userRole } = useAuth();
    const { toast } = useToast();

    const canCreate = userRole === 'admin' || userRole === 'operativo';
    const canEdit = userRole === 'admin' || userRole === 'operativo';
    const [viewMode, setViewMode] = useViewMode('operai');

    const filteredWorkers = workers.filter((worker) => {
        if (!search.trim()) return true;
        const words = search.trim().toLowerCase().split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return true;
        const searchTarget = `${worker.firstName} ${worker.lastName} ${worker.email || ''}`.toLowerCase();
        return words.every(word => searchTarget.includes(word));
    });

    const handleWorkerCreated = () => {
        window.location.reload();
    };

    const handleWorkerUpdated = () => {
        window.location.reload();
    };

    const handleToggleStatus = async (worker: Worker, checked: boolean, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            setTogglingId(worker.id);
            const updated = await workersApi.toggleStatus(worker.id, checked);
            setWorkers(prev => prev.map(w => w.id === worker.id ? updated : w));
            toast({
                title: "Stato aggiornato",
                description: `${worker.firstName} è ora ${checked ? 'Attivo' : 'Inattivo'}.`,
            });
        } catch {
            toast({
                variant: "destructive",
                title: "Errore",
                description: "Impossibile aggiornare lo stato.",
            });
        } finally {
            setTogglingId(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* Sticky Header */}
            <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <HardHat className="h-6 w-6 text-blue-600" />
                        Gestione Operai
                    </h1>
                    {canCreate && (
                        <Button onClick={() => setIsCreateOpen(true)} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                            <Plus className="mr-2 h-4 w-4" />
                            Nuovo Operaio
                        </Button>
                    )}
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Cerca Operaio (Nome, Email...)"
                            className="pl-9 bg-slate-100 dark:bg-muted border-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <ViewToggle mode={viewMode} onChange={setViewMode} />
                </div>
            </div>

            {viewMode === 'list' && (
                <div className="space-y-1.5 mb-4">
                    {filteredWorkers.length === 0 ? (
                        <div className="text-center py-10 text-slate-400">
                            <HardHat className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>Nessun operaio trovato</p>
                        </div>
                    ) : filteredWorkers.map((worker) => (
                        <div
                            key={worker.id}
                            className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-card border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-sm hover:border-blue-200 dark:hover:border-blue-800 transition-all cursor-pointer"
                            onClick={() => router.push(`/workers/${worker.id}`)}
                        >
                            <HardHat className="h-4 w-4 text-blue-600 shrink-0" />
                            <span className="font-semibold text-slate-900 dark:text-white text-sm w-40 shrink-0 truncate capitalize">
                                {worker.firstName} {worker.lastName}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400 text-xs flex-1 truncate hidden sm:block">
                                {worker.email || '—'}
                            </span>
                            <div className="flex items-center gap-2 ml-auto shrink-0" onClick={e => e.stopPropagation()}>
                                <Badge className={cn(
                                    "text-xs px-1.5 py-0 pointer-events-none",
                                    worker.isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-500"
                                )}>
                                    {worker.isActive ? "Attivo" : "Inattivo"}
                                </Badge>
                                {canEdit && (
                                    <Switch
                                        checked={worker.isActive}
                                        disabled={togglingId === worker.id}
                                        onCheckedChange={(checked) => {
                                            const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
                                            handleToggleStatus(worker, checked, fakeEvent);
                                        }}
                                    />
                                )}
                                {canEdit && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-slate-400 hover:text-blue-600"
                                        onClick={(e) => { e.stopPropagation(); setSelectedWorker(worker); setIsEditOpen(true); }}
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Grid Layout */}
            <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "hidden"}>
                {filteredWorkers.length === 0 ? (
                    <div className="col-span-full text-center py-10 text-slate-400">
                        <HardHat className="h-12 w-12 mx-auto mb-2 opacity-20" />
                        <p>Nessun operaio trovato</p>
                    </div>
                ) : (
                    filteredWorkers.map((worker) => (
                        <Card
                            key={worker.id}
                            className="hover:shadow-md transition-shadow cursor-pointer relative group"
                            onClick={() => router.push(`/workers/${worker.id}`)}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center justify-between">
                                    <span className="truncate capitalize">{worker.firstName} {worker.lastName}</span>
                                    {canEdit && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedWorker(worker);
                                                setIsEditOpen(true);
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    )}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                                {worker.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 shrink-0" />
                                        <a
                                            href={`mailto:${worker.email}`}
                                            className="hover:underline text-blue-600 truncate"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {worker.email}
                                        </a>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 shrink-0" />
                                    <span>Registrato il {new Date(worker.createdAt).toLocaleDateString('it-IT')}</span>
                                </div>

                                {/* Toggle attivo/inattivo direttamente sulla scheda */}
                                <div
                                    className="flex items-center justify-between pt-1 border-t dark:border-border"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Badge
                                        className={cn(
                                            "text-xs px-1.5 py-0 pointer-events-none",
                                            worker.isActive
                                                ? "bg-green-100 text-green-700 border-green-200"
                                                : "bg-slate-100 text-slate-500"
                                        )}
                                    >
                                        {worker.isActive ? "Attivo" : "Inattivo"}
                                    </Badge>
                                    {canEdit && (
                                        <Switch
                                            checked={worker.isActive}
                                            disabled={togglingId === worker.id}
                                            onCheckedChange={(checked) => {
                                                const fakeEvent = { stopPropagation: () => {} } as React.MouseEvent;
                                                handleToggleStatus(worker, checked, fakeEvent);
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Dialogs */}
            <WorkerDialog
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSuccess={handleWorkerCreated}
            />

            {selectedWorker && (
                <WorkerDialog
                    open={isEditOpen}
                    onOpenChange={setIsEditOpen}
                    workerToEdit={selectedWorker}
                    onSuccess={handleWorkerUpdated}
                />
            )}
        </div>
    );
}
