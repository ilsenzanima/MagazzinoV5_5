"use client";

import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { mockBrands, mockTypes, mockUnits } from "@/lib/mock-data";
import { Plus, X, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { suppliersApi, Supplier } from "@/lib/api";

export default function SettingsInventoryPage() {
    const [brands, setBrands] = useState(mockBrands);
    const [types, setTypes] = useState(mockTypes);
    const [units, setUnits] = useState(mockUnits);

    // Suppliers State
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [newSupplierName, setNewSupplierName] = useState("");
    const [addingSupplier, setAddingSupplier] = useState(false);

    useEffect(() => {
        loadSuppliers();
    }, []);

    const loadSuppliers = async () => {
        try {
            setLoadingSuppliers(true);
            const data = await suppliersApi.getAll();
            setSuppliers(data);
        } catch (error) {
            console.error("Failed to load suppliers", error);
        } finally {
            setLoadingSuppliers(false);
        }
    };

    const handleAddSupplier = async () => {
        if (!newSupplierName.trim()) return;
        try {
            setAddingSupplier(true);
            const newSupplier = await suppliersApi.create({ name: newSupplierName });
            setSuppliers([...suppliers, newSupplier]);
            setNewSupplierName("");
        } catch (error) {
            console.error("Failed to add supplier", error);
        } finally {
            setAddingSupplier(false);
        }
    };

    const handleDeleteSupplier = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo fornitore?")) return;
        try {
            await suppliersApi.delete(id);
            setSuppliers(suppliers.filter(s => s.id !== id));
        } catch (error) {
             console.error("Failed to delete supplier", error);
        }
    };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Impostazioni Inventario</h3>
        <p className="text-sm text-muted-foreground">
          Gestisci le liste predefinite per i prodotti e i fornitori.
        </p>
      </div>
      <Separator />

      <Tabs defaultValue="suppliers">
        <TabsList>
            <TabsTrigger value="suppliers">Fornitori</TabsTrigger>
            <TabsTrigger value="brands">Marche</TabsTrigger>
            <TabsTrigger value="types">Tipologie</TabsTrigger>
            <TabsTrigger value="units">Unità di Misura</TabsTrigger>
        </TabsList>
        
        <TabsContent value="suppliers" className="space-y-4 mt-4">
            <Card>
                <CardHeader>
                    <CardTitle>Gestione Fornitori</CardTitle>
                    <CardDescription>Gestisci l'elenco dei fornitori approvati.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="Nuovo Fornitore..." 
                            className="max-w-sm" 
                            value={newSupplierName}
                            onChange={(e) => setNewSupplierName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSupplier()}
                        />
                        <Button 
                            size="icon" 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={handleAddSupplier}
                            disabled={addingSupplier || !newSupplierName.trim()}
                        >
                            {addingSupplier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                    </div>
                    
                    {loadingSuppliers ? (
                        <div className="flex items-center gap-2 text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento fornitori...
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {suppliers.map(supplier => (
                                <Badge key={supplier.id} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-2 text-sm">
                                    {supplier.name}
                                    <button 
                                        className="hover:bg-slate-200 rounded-full p-0.5 transition-colors" 
                                        onClick={() => handleDeleteSupplier(supplier.id)}
                                    >
                                        <X className="h-3 w-3 text-slate-500" />
                                    </button>
                                </Badge>
                            ))}
                            {suppliers.length === 0 && (
                                <p className="text-sm text-muted-foreground italic">Nessun fornitore presente.</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="brands" className="space-y-4 mt-4">
            <Card>
                <CardHeader>
                    <CardTitle>Gestione Marche</CardTitle>
                    <CardDescription>Aggiungi o rimuovi le marche disponibili.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input placeholder="Nuova Marca..." className="max-w-sm" />
                        <Button size="icon" className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {brands.map(brand => (
                            <Badge key={brand} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-2 text-sm">
                                {brand}
                                <button className="hover:bg-slate-200 rounded-full p-0.5 transition-colors" onClick={() => setBrands(brands.filter(b => b !== brand))}>
                                    <X className="h-3 w-3 text-slate-500" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
        
        <TabsContent value="types" className="space-y-4 mt-4">
            <Card>
                <CardHeader>
                    <CardTitle>Gestione Tipologie</CardTitle>
                    <CardDescription>Categorie merceologiche dei prodotti.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input placeholder="Nuova Tipologia..." className="max-w-sm" />
                        <Button size="icon" className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {types.map(item => (
                            <Badge key={item} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-2 text-sm">
                                {item}
                                <button className="hover:bg-slate-200 rounded-full p-0.5 transition-colors" onClick={() => setTypes(types.filter(t => t !== item))}>
                                    <X className="h-3 w-3 text-slate-500" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
        
        <TabsContent value="units" className="space-y-4 mt-4">
            <Card>
                <CardHeader>
                    <CardTitle>Unità di Misura</CardTitle>
                    <CardDescription>Unità di misura disponibili per i prodotti.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input placeholder="Nuova Unità..." className="max-w-sm" />
                        <Button size="icon" className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {units.map(item => (
                            <Badge key={item} variant="outline" className="pl-3 pr-1 py-1 flex items-center gap-2 text-sm">
                                {item}
                                <button className="hover:bg-slate-100 rounded-full p-0.5 transition-colors" onClick={() => setUnits(units.filter(u => u !== item))}>
                                    <X className="h-3 w-3 text-slate-500" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
