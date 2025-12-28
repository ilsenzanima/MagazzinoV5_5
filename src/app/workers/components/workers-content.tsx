"use client";

import { useState } from "react";
import { Worker } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"; // Added Card components
import { Badge } from "@/components/ui/badge";
import { Search, Plus, HardHat, Mail, Trash2, Pencil, Calendar, AlertCircle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { WorkerDialog } from "./worker-dialog";
import { WorkerDetailsDialog } from "./worker-details-dialog";
import { cn } from "@/lib/utils";

interface WorkersContentProps {
    initialWorkers: Worker[];
}

export default function WorkersContent({ initialWorkers }: WorkersContentProps) {
    const [workers] = useState<Worker[]>(initialWorkers);
    const [search, setSearch] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const { userRole } = useAuth(); // Ensure this hook is correctly imported

    const canCreate = userRole === 'admin' || userRole === 'operativo';

    // Filter logic
    const filteredWorkers = workers.filter((worker) => {
        const matchesSearch =
            worker.firstName.toLowerCase().includes(search.toLowerCase()) ||
            worker.lastName.toLowerCase().includes(search.toLowerCase()) ||
            (worker.email || "").toLowerCase().includes(search.toLowerCase());

        return matchesSearch;
    });

    const handleWorkerCreated = () => {
        window.location.reload();
    };

    const handleWorkerUpdated = () => {
        window.location.reload();
    };

    return (
        <div className="space-y-6">
            {/* Sticky Header - Matching Clients Page */}
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

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Cerca Operaio (Nome, Email...)"
                        className="pl-9 bg-slate-100 dark:bg-muted border-none"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Grid Layout - Matching Clients Page */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                            onClick={() => {
                                setSelectedWorker(worker);
                                setIsDetailsOpen(true);
                            }}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="truncate capitalize">{worker.firstName} {worker.lastName}</span>
                                        <Badge
                                            variant={worker.isActive ? "default" : "secondary"}
                                            className={cn(
                                                "text-xs px-1.5 py-0",
                                                worker.isActive
                                                    ? "bg-green-100 text-green-700 pointer-events-none border-green-200"
                                                    : "bg-slate-100 text-slate-500 pointer-events-none"
                                            )}
                                        >
                                            {worker.isActive ? "Attivo" : "Inattivo"}
                                        </Badge>
                                    </div>
                                    {canCreate && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
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
                            <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                {worker.email && (
                                    <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 shrink-0" />
                                        <a href={`mailto:${worker.email}`} className="hover:underline text-blue-600" onClick={(e) => e.stopPropagation()}>
                                            {worker.email}
                                        </a>
                                    </div>
                                )}
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 shrink-0" />
                                    <span>Registrato il {new Date(worker.createdAt).toLocaleDateString('it-IT')}</span>
                                </div>

                                {/* Placeholder for future certificates count/status */}
                                <div className="pt-2 mt-2 border-t flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Certificati</span>
                                    <Badge variant="outline" className="text-slate-400 border-slate-200">
                                        0 (Placeholder)
                                    </Badge>
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
                <>
                    <WorkerDetailsDialog
                        open={isDetailsOpen}
                        onOpenChange={setIsDetailsOpen}
                        worker={selectedWorker}
                        onUpdate={handleWorkerUpdated}
                        onEdit={(worker) => {
                            setIsDetailsOpen(false);
                            setIsEditOpen(true);
                        }}
                    />
                    <WorkerDialog
                        open={isEditOpen}
                        onOpenChange={setIsEditOpen}
                        workerToEdit={selectedWorker}
                        onSuccess={handleWorkerUpdated}
                    />
                </>
            )}
        </div>
    );
}
