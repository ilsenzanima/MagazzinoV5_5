"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { inventoryApi } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { InventoryItemForm, InventoryFormData } from "@/components/inventory/InventoryItemForm";

function NewInventoryItemContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneId = searchParams.get('cloneId');
  const { userRole } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [cloneData, setCloneData] = useState<Partial<InventoryFormData> | undefined>(undefined);
  const [loadingClone, setLoadingClone] = useState(!!cloneId);

  // Permission check
  if (userRole === 'user') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full py-20">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Accesso Negato</h2>
          <p className="text-slate-500 mb-6">Non hai i permessi necessari per creare nuovi articoli.</p>
          <Link href="/inventory">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna all'Inventario
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  // Handle Clone
  useEffect(() => {
    if (!cloneId) return;

    const loadCloneData = async () => {
      try {
        setLoadingClone(true);
        const item = await inventoryApi.getById(cloneId);
        if (item) {
          setCloneData({
            name: item.name,
            model: "", // Clear model as requested for variants
            brand: item.brand,
            type: item.type,
            supplierCode: item.supplierCode || "",
            minStock: item.minStock.toString(),
            unit: item.unit,
            coefficient: item.coefficient.toString(),
            description: item.description || "",
            image: item.image || ""
          });
        }
      } catch (error) {
        console.error("Failed to load clone data", error);
      } finally {
        setLoadingClone(false);
      }
    };

    loadCloneData();
  }, [cloneId]);

  const handleSubmit = async (data: InventoryFormData, imageFile: File | null) => {
    setIsLoading(true);
    try {
      const coeff = parseFloat(data.coefficient);
      const minStock = parseInt(data.minStock);

      if (isNaN(coeff) || coeff <= 0) {
        alert("Il coefficiente deve essere maggiore di 0");
        setIsLoading(false);
        return;
      }

      if (isNaN(minStock) || minStock < 0) {
        alert("La scorta minima non può essere negativa");
        setIsLoading(false);
        return;
      }

      let imageUrl = data.image;
      if (imageFile) {
        try {
          imageUrl = await inventoryApi.uploadImage(imageFile);
        } catch (uploadErr) {
          console.error("Image upload failed", uploadErr);
          alert("Errore caricamento immagine, l'articolo verrà creato senza immagine.");
        }
      }

      const newItem = {
        code: data.code,
        name: data.name,
        model: data.model,
        brand: data.brand,
        type: data.type,
        supplierCode: data.supplierCode,
        quantity: 0,
        minStock: minStock,
        unit: data.unit as any,
        coefficient: coeff,
        description: data.description,
        image: imageUrl,
      };

      await inventoryApi.create(newItem);
      router.push("/inventory");
    } catch (error) {
      console.error("Failed to create item", error);
      alert("Errore durante la creazione dell'articolo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/inventory");
  };

  if (loadingClone) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/inventory">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {cloneId ? "Crea Variante Articolo" : "Nuovo Articolo"}
              </h1>
              <p className="text-sm text-slate-500">
                {cloneId ? "Creazione variante da articolo esistente" : "Aggiungi un nuovo prodotto al magazzino"}
              </p>
            </div>
          </div>
        </div>

        <InventoryItemForm
          mode="create"
          initialData={cloneData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isLoading}
        />
      </div>
    </DashboardLayout>
  );
}

export default function NewInventoryItemPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </DashboardLayout>
    }>
      <NewInventoryItemContent />
    </Suspense>
  );
}
