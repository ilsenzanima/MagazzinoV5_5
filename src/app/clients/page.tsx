"use client"

import { useState, useEffect, useDeferredValue } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Search, 
  Plus, 
  Loader2,
  Building2,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import Link from "next/link";
import { Client, clientsApi, jobsApi } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

import { useAuth } from "@/components/auth-provider";

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

  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Edit state
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [shouldUpdateActiveJobs, setShouldUpdateActiveJobs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleUpdateClient = async () => {
    if (!clientToEdit || !editForm.name) return;
    
    try {
      setIsSaving(true);
      
      // Helper to construct address
      const constructAddress = (c: Partial<Client>) => {
        return `${c.street || ''} ${c.streetNumber || ''}, ${c.postalCode || ''} ${c.city || ''} ${c.province ? '(' + c.province + ')' : ''}`
          .trim()
          .replace(/^,/, '')
          .replace(/,$/, '')
          .trim();
      };

      // 1. Calculate new address
      const newAddress = constructAddress(editForm);
      
      // 2. Update Client
      await clientsApi.update(clientToEdit.id, {
        name: editForm.name,
        vatNumber: editForm.vatNumber,
        email: editForm.email,
        phone: editForm.phone,
        street: editForm.street,
        streetNumber: editForm.streetNumber,
        postalCode: editForm.postalCode,
        city: editForm.city,
        province: editForm.province,
        address: newAddress
      });

      // 3. Update Job Addresses if requested
      if (shouldUpdateActiveJobs && newAddress) {
        console.log('Updating active jobs to new address:', newAddress);
        // Fetch all jobs for this client
        const jobs = await jobsApi.getByClientId(clientToEdit.id);
        
        // Filter for active jobs
        const activeJobs = jobs.filter(job => job.status === 'active');
        console.log(`Found ${activeJobs.length} active jobs to update out of ${jobs.length} total`);
        
        // Update them
        const updatePromises = activeJobs.map(job => {
           console.log(`Updating job ${job.code} address to "${newAddress}"`);
           return jobsApi.update(job.id, { siteAddress: newAddress });
        });
        
        await Promise.all(updatePromises);
      }

      await loadClients();
      setIsEditDialogOpen(false);
      setClientToEdit(null);
    } catch (error) {
      console.error("Failed to update client:", error);
      alert("Errore durante l'aggiornamento del committente");
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (client: Client) => {
    setClientToEdit(client);
    setShouldUpdateActiveJobs(false);
    setEditForm({
      name: client.name,
      vatNumber: client.vatNumber,
      email: client.email,
      phone: client.phone,
      street: client.street,
      streetNumber: client.streetNumber,
      postalCode: client.postalCode,
      city: client.city,
      province: client.province
      // Don't include address string so it gets regenerated from components
    });
    setIsEditDialogOpen(true);
  };

  const totalPages = Math.ceil(totalItems / LIMIT);

  return (
    <DashboardLayout>
      <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestione Committenti</h1>
          {(userRole === 'admin' || userRole === 'operativo') && (
            <Link href="/clients/new">
              <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Committente
              </Button>
            </Link>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cerca Committente (Nome, P.IVA, Email...)" 
            className="pl-9 bg-slate-100 dark:bg-muted border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-500">Caricamento committenti...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
            <div className="bg-red-50 text-red-600 p-4 rounded-full mb-4">
                <Building2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Errore di Caricamento</h3>
            <p className="text-slate-500 mb-6 max-w-md">{error}</p>
            <Button onClick={loadClients} variant="outline">
                Riprova
            </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-400">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nessun committente trovato</p>
              </div>
            ) : (
              clients.map((client) => (
                <Card key={client.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{client.name}</span>
                      {(userRole === 'admin' || userRole === 'operativo') && (
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-400 hover:text-blue-600 h-8 w-8"
                            onClick={() => openEditDialog(client)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-400 hover:text-red-600 h-8 w-8"
                            onClick={() => {
                              setClientToDelete(client);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                    {client.vatNumber && (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold w-8">P.IVA</span>
                        <span>{client.vatNumber}</span>
                      </div>
                    )}
                    {(client.street || client.city) && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                        <span>
                          {client.street} {client.streetNumber}
                          {client.street && client.city && ", "}
                          {client.postalCode} {client.city} {client.province && `(${client.province})`}
                        </span>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0" />
                        <a href={`mailto:${client.email}`} className="hover:underline text-blue-600">
                          {client.email}
                        </a>
                      </div>
                    )}
                    {client.phone && (
                       <div className="flex items-center gap-2">
                         <Phone className="h-4 w-4 shrink-0" />
                         <a href={`tel:${client.phone}`} className="hover:underline">
                           {client.phone}
                         </a>
                       </div>
                     )}
                     <div className="pt-2 mt-2 border-t flex justify-end">
                        <Link href={`/jobs?clientId=${client.id}`}>
                           <Button variant="outline" size="sm">Vedi Commesse</Button>
                        </Link>
                     </div>
                   </CardContent>
                 </Card>
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

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Committente</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare il committente <strong>{clientToDelete?.name}</strong>?
              <br />
              Questa azione eliminerà anche tutte le commesse associate.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleDeleteClient}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Committente</DialogTitle>
            <DialogDescription>
              Modifica i dati del committente. Se cambi l'indirizzo, le commesse associate a questo indirizzo verranno aggiornate.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Ragione Sociale / Nome *</Label>
                <Input
                  id="name"
                  value={editForm.name || ""}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vatNumber">P.IVA / Codice Fiscale</Label>
                <Input
                  id="vatNumber"
                  value={editForm.vatNumber || ""}
                  onChange={(e) => setEditForm({...editForm, vatNumber: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editForm.email || ""}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefono</Label>
                <Input
                  id="phone"
                  value={editForm.phone || ""}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Indirizzo Sede Legale</Label>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-8">
                  <Input 
                    placeholder="Via/Piazza" 
                    value={editForm.street || ""} 
                    onChange={(e) => setEditForm({...editForm, street: e.target.value})}
                  />
                </div>
                <div className="col-span-4">
                  <Input 
                    placeholder="N. Civico" 
                    value={editForm.streetNumber || ""} 
                    onChange={(e) => setEditForm({...editForm, streetNumber: e.target.value})}
                  />
                </div>
                <div className="col-span-3">
                  <Input 
                    placeholder="CAP" 
                    value={editForm.postalCode || ""} 
                    onChange={(e) => setEditForm({...editForm, postalCode: e.target.value})}
                  />
                </div>
                <div className="col-span-6">
                  <Input 
                    placeholder="Città" 
                    value={editForm.city || ""} 
                    onChange={(e) => setEditForm({...editForm, city: e.target.value})}
                  />
                </div>
                <div className="col-span-3">
                  <Input 
                    placeholder="Prov" 
                    maxLength={2} 
                    className="uppercase"
                    value={editForm.province || ""} 
                    onChange={(e) => setEditForm({...editForm, province: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox 
                id="update-jobs" 
                checked={shouldUpdateActiveJobs} 
                onCheckedChange={(checked) => setShouldUpdateActiveJobs(checked as boolean)} 
              />
              <Label htmlFor="update-jobs" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                Aggiorna l'indirizzo anche nelle commesse attive associate
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isSaving}>Annulla</Button>
            <Button onClick={handleUpdateClient} disabled={isSaving || !editForm.name}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                "Salva Modifiche"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
