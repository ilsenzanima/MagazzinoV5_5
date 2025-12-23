"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Upload, Loader2 } from "lucide-react";
import { brandsApi, itemTypesApi, inventoryApi, unitsApi, Brand, ItemType, Unit } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

export default function NewInventoryItemPage() {
  const router = useRouter();
  const { user, userRole } = useAuth();
  
  // Generate a random mock code
  const generateCode = () => {
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `PPA-E${randomSuffix}`;
  };

  const [code] = useState(generateCode());
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [types, setTypes] = useState<ItemType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [brandsData, typesData, unitsData] = await Promise.all([
          brandsApi.getAll(),
          itemTypesApi.getAll(),
          unitsApi.getAll()
        ]);
        setBrands(brandsData);
        setTypes(typesData);
        setUnits(unitsData);
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    brand: "",
    type: "",
    supplierCode: "",
    minStock: "5",
    unit: "PZ",
    coefficient: "1.0",
    description: "",
    image: ""
  });

  const [previewImage, setPreviewImage] = useState<string>("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreviewImage(result);
        setFormData({ ...formData, image: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    try {
        const coeff = parseFloat(formData.coefficient);
        if (isNaN(coeff) || coeff <= 0) {
            // Show simple alert or better UI feedback (using alert for now as requested for simplicity)
            alert("Il coefficiente deve essere maggiore di 0");
            setIsLoading(false);
            return;
        }

        const newItem = {
            code,
            name: formData.name,
            brand: formData.brand,
            type: formData.type,
            supplierCode: formData.supplierCode,
            quantity: 0,
            minStock: parseInt(formData.minStock) || 0,
            unit: formData.unit as any,
            coefficient: coeff,
            description: formData.description,
            image: formData.image,
        };
        
        await inventoryApi.create(newItem);
        router.push("/inventory");
    } catch (error) {
        console.error("Failed to create item", error);
        // Here we should probably show a toast error, but for now console error is fine
    } finally {
        setIsLoading(false);
    }
  };

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
                Nuovo Articolo
              </h1>
              <p className="text-sm text-slate-500">Aggiungi un nuovo prodotto al magazzino</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Image */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="aspect-square relative rounded-md overflow-hidden bg-slate-100 border flex items-center justify-center group">
                  {previewImage ? (
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-xs text-slate-500">Carica Immagine</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Label htmlFor="image-upload-new" className="cursor-pointer">
                        <div className="bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 rounded-md flex items-center text-sm font-medium shadow-sm">
                          Scegli File
                        </div>
                        <Input 
                            id="image-upload-new" 
                            type="file" 
                            accept="image/*" 
                            capture="environment"
                            className="hidden" 
                            onChange={handleImageUpload}
                        />
                    </Label>
                  </div>
                </div>
                
                <div className="space-y-2">
                    <Label>Stato Iniziale</Label>
                    <div className="flex items-center justify-center p-2 rounded-md border font-bold bg-slate-100 text-slate-500 border-slate-200">
                        In Attesa di Carico
                    </div>
                </div>

                <div className="space-y-2">
                  <Label>Quantità Iniziale</Label>
                  <Input 
                    type="number" 
                    value="0" 
                    readOnly
                    className="text-lg font-bold bg-slate-50 text-slate-600"
                  />
                  <p className="text-xs text-slate-400">La quantità sarà aggiornata col primo carico</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Form */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dettagli Articolo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Codice Articolo</Label>
                    <Input id="code" value={code} readOnly className="bg-slate-50 text-slate-500" />
                    <p className="text-[10px] text-slate-400">Generato Automaticamente</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Select onValueChange={(val) => setFormData({...formData, brand: val})}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingData ? "Caricamento..." : "Seleziona Marca"} />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.map((brand) => (
                          <SelectItem key={brand.id} value={brand.name}>{brand.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplierCode">Codice Fornitore / Originale</Label>
                  <Input 
                    id="supplierCode" 
                    placeholder="Es. Codice catalogo fornitore"
                    value={formData.supplierCode}
                    onChange={(e) => setFormData({...formData, supplierCode: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome Prodotto</Label>
                  <Input 
                    id="name" 
                    placeholder="Es. Trapano Avvitatore 18V"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipologia</Label>
                    <Select onValueChange={(val) => setFormData({...formData, type: val})}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingData ? "Caricamento..." : "Seleziona Tipologia"} />
                      </SelectTrigger>
                      <SelectContent>
                        {types.map((type) => (
                          <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minStock">Scorta Minima</Label>
                    <Input 
                        id="minStock" 
                        type="number" 
                        step="0.01"
                        value={formData.minStock}
                        onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                    />
                    <p className="text-[10px] text-slate-400">Soglia per avviso "Basse Scorte"</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <Label htmlFor="unit">Unità di Misura</Label>
                    <Select defaultValue="PZ" onValueChange={(val) => setFormData({...formData, unit: val})}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingData ? "Caricamento..." : "U.M."} />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((u) => (
                          <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coefficient">Coeff. Moltiplicazione</Label>
                    <Input 
                        id="coefficient" 
                        type="number" 
                        step="0.01" 
                        min="0.01"
                        value={formData.coefficient}
                        onChange={(e) => setFormData({...formData, coefficient: e.target.value})}
                        disabled={userRole !== 'admin'}
                        className={userRole !== 'admin' ? "opacity-50" : ""}
                    />
                    <p className="text-[10px] text-slate-400">
                        {userRole === 'admin' ? "Visibile solo admin" : "Modificabile solo da Admin"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrizione</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Inserisci dettagli aggiuntivi..."
                    className="min-h-[100px]"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>
                
                <div className="pt-4 flex justify-end">
                    <Button 
                        className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                        onClick={handleCreate}
                        disabled={!formData.name || !formData.brand || !formData.type || isLoading}
                    >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvataggio...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" /> Crea Articolo
                          </>
                        )}
                    </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
