"use client";

import { useState } from "react";
import { Worker } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, HardHat } from "lucide-react";
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
    const { userRole } = useAuth();

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
            {/* Header and Search */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <HardHat className="h-8 w-8 text-blue-600" />
                        Operai
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Gestione anagrafica e certificazioni
                    </p>
                </div>
                {canCreate && (
                    <Button onClick={() => setIsCreateOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Nuovo Operaio
                    </Button>
                )}
            </div>

            <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 p-2 rounded-md border shadow-sm max-w-sm">
                <Search className="h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Cerca per nome o email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
            </div>

            {/* List */}
            <div className="rounded-md border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-800">
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Cognome</TableHead>
                            <TableHead className="hidden md:table-cell">Email</TableHead>
                            <TableHead>Stato</TableHead>
                            <TableHead className="hidden sm:table-cell">Registrato il</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredWorkers.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Nessun operaio trovato.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredWorkers.map((worker) => (
                                <TableRow
                                    key={worker.id}
                                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    onClick={() => {
                                        setSelectedWorker(worker);
                                        setIsDetailsOpen(true);
                                    }}
                                >
                                    <TableCell className="font-medium capitalize">{worker.firstName}</TableCell>
                                    <TableCell className="capitalize">{worker.lastName}</TableCell>
                                    <TableCell className="hidden md:table-cell text-muted-foreground">{worker.email || "-"}</TableCell>
                                    <TableCell>
                                        <Badge
                                            variant={worker.isActive ? "default" : "secondary"}
                                            className={cn(
                                                worker.isActive
                                                    ? "bg-green-100 text-green-700 hover:bg-green-100 border-green-200 shadow-none font-normal"
                                                    : "font-normal bg-slate-100 text-slate-500"
                                            )}
                                        >
                                            {worker.isActive ? "Attivo" : "Inattivo"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                                        {new Date(worker.createdAt).toLocaleDateString('it-IT')}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
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
