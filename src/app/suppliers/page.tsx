"use client"

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
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
  ShoppingCart
} from "lucide-react";
import Link from "next/link";
import { Supplier, suppliersApi } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-provider";

export default function SuppliersPage() {
  const { userRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Initial load
  useEffect(() => {
    loadSuppliers(1, "");
  }, []);

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadSuppliers(1, searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadSuppliers = async (page: number, search: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data, total } = await suppliersApi.getPaginated({
        page,
        limit: ITEMS_PER_PAGE,
        search
      });
      setSuppliers(data);
      setTotalPages(Math.ceil(total / ITEMS_PER_PAGE));
      setCurrentPage(page);
    } catch (error: any) {
      console.error("Failed to load suppliers:", error);
      setError(error.message || "Errore sconosciuto durante il caricamento");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierToDelete) return;
    try {
      await suppliersApi.delete(supplierToDelete.id);
      // Reload current page
      await loadSuppliers(currentPage, searchTerm);
      setIsDeleteDialogOpen(false);
      setSupplierToDelete(null);
    } catch (error) {
      console.error("Failed to delete supplier:", error);
      alert("Errore durante l'eliminazione del fornitore. Verifica che non abbia acquisti associati.");
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      loadSuppliers(newPage, searchTerm);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-white dark:bg-card p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6 border dark:border-border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Gestione Fornitori</h1>
          {(userRole === 'admin' || userRole === 'operativo') && (
            <Link href="/suppliers/new">
              <Button className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Nuovo Fornitore
              </Button>
            </Link>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cerca Fornitore (Nome, P.IVA, Email...)"
            className="pl-9 bg-slate-100 dark:bg-muted border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500">Caricamento fornitori...</span>
        </div>
      ) : error ? (
        <div className="flex flex-col justify-center items-center py-12 text-center">
          <div className="bg-red-50 text-red-600 p-4 rounded-full mb-4">
            <Building2 className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Errore di Caricamento</h3>
          <p className="text-slate-500 mb-6 max-w-md">{error}</p>
          <Button onClick={() => loadSuppliers(currentPage, searchTerm)} variant="outline">
            Riprova
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {suppliers.length === 0 ? (
              <div className="col-span-full text-center py-10 text-slate-400">
                <Building2 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>Nessun fornitore trovato</p>
              </div>
            ) : (
              suppliers.map((supplier) => (
                <Card key={supplier.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between">
                      <span className="truncate">{supplier.name}</span>
                      <div className="flex gap-2">
                        <Link href={`/suppliers/${supplier.id}`}>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-600 h-8 w-8">
                            <Building2 className="h-4 w-4" />
                          </Button>
                        </Link>
                        {(userRole === 'admin' || userRole === 'operativo') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-slate-400 hover:text-red-600 h-8 w-8"
                            onClick={() => {
                              setSupplierToDelete(supplier);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2 text-slate-600">
                    {supplier.vatNumber && (
                      <div className="font-mono text-xs bg-slate-100 p-1 rounded w-fit">
                        P.IVA: {supplier.vatNumber}
                      </div>
                    )}
                    {supplier.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{supplier.address}</span>
                      </div>
                    )}
                    {supplier.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" />
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0" />
                        <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">
                          {supplier.email}
                        </a>
                      </div>
                    )}
                    <div className="pt-2 mt-2 border-t flex justify-end">
                      <Link href={`/purchases?supplierId=${supplier.id}`}>
                        <Button variant="outline" size="sm">
                          <ShoppingCart className="mr-2 h-3 w-3" />
                          Vedi Acquisti
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 pb-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Precedente
              </Button>
              <span className="text-sm text-slate-600">
                Pagina {currentPage} di {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Successiva
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Fornitore</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare il fornitore <strong>{supplierToDelete?.name}</strong>?
              <br />
              Se ci sono acquisti collegati, l'operazione verrà bloccata.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleDeleteSupplier}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
