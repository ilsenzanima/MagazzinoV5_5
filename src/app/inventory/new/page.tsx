"use client"

import { notify } from "@/lib/notify";;

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Wand2 } from "lucide-react";
import { inventoryApi } from "@/lib/api";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { InventoryItemForm, InventoryFormData, InventoryItemFormHandle } from "@/components/inventory/InventoryItemForm";
import { NewItemWizard, NewItemWizardHandle, WizardDraft, draftFromItem } from "@/components/inventory/NewItemWizard";
import { BlockBrowserBack } from "@/components/BlockBrowserBack";

// Dati della procedura guidata -> campi della scheda
const draftToFormData = (d: WizardDraft): Partial<InventoryFormData> => ({
  name: d.name,
  model: d.model,
  brand: d.brand,
  type: d.type,
  supplierCode: d.hasSupplierCode ? d.supplierCode : "",
  minStock: d.wantsMinStock ? d.minStock : "0",
  unit: d.unit,
  coefficient: d.coefficient,
  packQuantity: d.packQuantity,
  description: d.description,
  image: d.imageUrl,
  variantAttributes: d.customModel ? {} : d.variantAttributes,
});

function NewInventoryItemContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cloneId = searchParams.get('cloneId');
  const { userRole } = useAuth();

  const [isLoading, setIsLoading] = useState(false);
  const [cloneData, setCloneData] = useState<Partial<InventoryFormData> | undefined>(undefined);
  const [loadingClone, setLoadingClone] = useState(!!cloneId);

  // Procedura guidata: modale sopra la scheda, che si riempie man mano
  const formRef = useRef<InventoryItemFormHandle>(null);
  const wizardRef = useRef<NewItemWizardHandle>(null);
  const [wizardOpen, setWizardOpen] = useState(true);
  const [wizardData, setWizardData] = useState<Partial<InventoryFormData> | undefined>(undefined);
  const [wizardImage, setWizardImage] = useState<File | null>(null);
  const [cloneDraft, setCloneDraft] = useState<WizardDraft | undefined>(undefined);

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
            minStock: "0", // un articolo nuovo parte senza scorta minima, anche se copiato da un altro
            unit: item.unit,
            coefficient: item.coefficient.toString(),
            packQuantity: item.packQuantity != null ? String(item.packQuantity) : "",
            description: item.description || "",
            image: item.image || ""
          });
          setCloneDraft(draftFromItem(item));
        }
      } catch (error) {
        console.error("Failed to load clone data", error);
        notify.error("Errore nel caricamento dei dati dell'articolo da duplicare");
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
      const minStock = parseFloat(String(data.minStock).replace(",", ".")) || 0;

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
          notify.error("Errore caricamento immagine, l'articolo verrà creato senza immagine.");
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
        packQuantity: data.packQuantity && data.packQuantity.trim() !== "" ? parseFloat(data.packQuantity.replace(",", ".")) : null,
        description: data.description,
        image: imageUrl,
        variantAttributes:
          data.variantAttributes && Object.keys(data.variantAttributes).length > 0 ? data.variantAttributes : null,
      };

      const created = await inventoryApi.create(newItem);
      router.push(`/inventory/${created.id}`);
    } catch (error) {
      console.error("Failed to create item", error);
      notify.error("Errore durante la creazione dell'articolo");
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
      <BlockBrowserBack />
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
          {!wizardOpen && (
            <Button variant="outline" onClick={() => {
              // Riporta nel modale i valori attuali della scheda, anche quelli modificati a mano
              const current = formRef.current?.getValues();
              if (current) {
                wizardRef.current?.syncFrom(
                  {
                    name: current.data.name,
                    model: current.data.model,
                    description: current.data.description,
                    brand: current.data.brand,
                    type: current.data.type,
                    unit: current.data.unit,
                    supplierCode: current.data.supplierCode,
                    minStock: current.data.minStock,
                    coefficient: current.data.coefficient,
                    packQuantity: current.data.packQuantity,
                    image: current.data.image,
                  },
                  current.imageFile
                );
              }
              setWizardOpen(true);
            }}>
              <Wand2 className="mr-2 h-4 w-4" />
              Procedura guidata
            </Button>
          )}
        </div>

        <InventoryItemForm
          ref={formRef}
          mode="create"
          initialData={wizardData ?? cloneData}
          presetImageFile={wizardImage}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isLoading}
        />

        {/* Sempre montata: chiudendo il modale lo stato (passo, ricerche, dati) resta */}
        {(
          <NewItemWizard
            ref={wizardRef}
            open={wizardOpen}
            initialDraft={cloneDraft}
            startStep={cloneDraft ? 1 : 0}
            onClose={() => setWizardOpen(false)}
            onChange={(draft) => {
              setWizardData(draftToFormData(draft));
              setWizardImage(draft.imageFile);
            }}
            onCreate={async (draft) =>
              (await formRef.current?.submitWith(draftToFormData(draft), draft.imageFile ?? null)) ?? false
            }
          />
        )}
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
