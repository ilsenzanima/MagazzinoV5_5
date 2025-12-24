"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, Search, Loader2, FileText, Calendar, User, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { purchasesApi, Purchase } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

export default function PurchasesPage() {
  const searchParams = useSearchParams();
  const initialSupplierId = searchParams?.get("supplierId");

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const data = await purchasesApi.getAll();
      setPurchases(data);
    } catch (error) {
      console.error("Failed to load purchases", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = purchases.filter((purchase) => {
    // If supplierId param is present, strictly filter by it
    if (initialSupplierId && purchase.supplierId !== initialSupplierId) {
        return false;
    }

    return (
      purchase.deliveryNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      purchase.supplierName?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  return (
    <DashboardLayout>
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">
            {initialSupplierId ? "Acquisti Fornitore" : "Gestione Acquisti"}
          </h1>
          <div className="flex gap-2">
            {initialSupplierId && (
                <Link href="/purchases">
                    <Button variant="outline">Mostra Tutti</Button>
                </Link>
            )}
            <Link href="/purchases/new">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Acquisto
            </Button>
            </Link>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cerca Acquisto (Bolla, Fornitore...)" 
            className="pl-9 bg-slate-100 border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-500">Caricamento acquisti...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPurchases.length === 0 ? (
            <div className="col-span-full text-center py-10 text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nessun acquisto trovato</p>
            </div>
          ) : (
            filteredPurchases.map((purchase) => (
              <Link href={`/purchases/${purchase.id}`} key={purchase.id}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full border-slate-200">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                           <FileText className="h-4 w-4 text-blue-600" />
                           Bolla: {purchase.deliveryNoteNumber}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {purchase.supplierName || 'Fornitore Sconosciuto'}
                        </p>
                      </div>
                      <Badge variant={purchase.status === 'completed' ? 'default' : 'secondary'}>
                        {purchase.status === 'completed' ? 'Completato' : 'Bozza'}
                      </Badge>
                    </div>
                    
                    {purchase.items?.some(item => item.price === 0) && (
                      <div className="mb-4 flex items-center text-yellow-600 bg-yellow-50 p-2 rounded text-xs font-medium border border-yellow-100">
                        <AlertTriangle className="h-3 w-3 mr-1.5" />
                        Prezzi mancanti
                      </div>
                    )}

                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>Data: {new Date(purchase.deliveryNoteDate).toLocaleDateString('it-IT')}</span>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                        <span>Registrato da: {purchase.createdByName || 'N/D'}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
