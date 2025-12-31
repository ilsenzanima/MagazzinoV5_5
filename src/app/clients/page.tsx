"use client"

import { useState, useEffect, useDeferredValue } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Plus,
  Loader2,
  Building2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { Client, clientsApi } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/components/auth-provider";
import { ClientCard, ClientEditDialog, ClientDeleteDialog } from "@/components/clients";

export default function ClientsPage() {
  const { userRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDeferredValue(searchTerm);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const LIMIT = 12;

  // Dialog State
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    loadClients();
  }, [page, debouncedSearch]);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, total } = await clientsApi.getPaginated({
        page,
        limit: LIMIT,
        search: debouncedSearch
      });
      setClients(data);
      setTotalItems(total);
    } catch (error: any) {
      console.error("Failed to load clients:", error);
      setError(error.message || "Errore sconosciuto durante il caricamento");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    try {
      await clientsApi.delete(clientToDelete.id);
      await loadClients();
      setIsDeleteDialogOpen(false);
      setClientToDelete(null);
    } catch (error) {
      console.error("Failed to delete client:", error);
      alert("Errore durante l'eliminazione del committente");
    }
  };

  const openEditDialog = (client: Client) => {
    setClientToEdit(client);
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (client: Client) => {
    setClientToDelete(client);
    setIsDeleteDialogOpen(true);
  };

  const canEdit = userRole === 'admin' || userRole === 'operativo';
  const totalPages = Math.ceil(totalItems / LIMIT);

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestione Committenti</h1>
          {canEdit && (
            <Link href="/clients/new">
              <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Committente
              </Button>
            </Link>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <Input
            placeholder="Cerca Committente (Nome, P.IVA, Email...)"
            className="pl-9 bg-slate-100 dark:bg-muted border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500 dark:text-slate-400">Caricamento committenti...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-full mb-4">
            <Building2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Errore di Caricamento</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">{error}</p>
          <Button onClick={loadClients} variant="outline">
            Riprova
          </Button>
        </div>
      ) : (
        <>
          {/* Client Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-400 dark:text-slate-500">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nessun committente trovato</p>
              </div>
            ) : (
              clients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  canEdit={canEdit}
                  onEdit={openEditDialog}
                  onDelete={openDeleteDialog}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Pagina {page} di {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <ClientDeleteDialog
        client={clientToDelete}
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteClient}
      />

      <ClientEditDialog
        client={clientToEdit}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSaved={loadClients}
      />
    </DashboardLayout>
  );
}
