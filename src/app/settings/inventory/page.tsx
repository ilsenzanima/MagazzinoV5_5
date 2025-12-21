"use client";

import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, X, Loader2, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { suppliersApi, brandsApi, itemTypesApi, unitsApi, Supplier, Brand, ItemType, Unit } from "@/lib/api";

export default function SettingsInventoryPage() {
    // Units State
    const [units, setUnits] = useState<Unit[]>([]);
    const [loadingUnits, setLoadingUnits] = useState(true);
    const [newUnitName, setNewUnitName] = useState("");
    const [addingUnit, setAddingUnit] = useState(false);

    // Suppliers State
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [newSupplierName, setNewSupplierName] = useState("");
    const [addingSupplier, setAddingSupplier] = useState(false);

    // Brands State
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loadingBrands, setLoadingBrands] = useState(true);
    const [newBrandName, setNewBrandName] = useState("");
    const [addingBrand, setAddingBrand] = useState(false);

    // Types State
    const [types, setTypes] = useState<ItemType[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(true);
    const [newTypeName, setNewTypeName] = useState("");
    const [addingType, setAddingType] = useState(false);

    useEffect(() => {
        loadSuppliers();
        loadBrands();
        loadTypes();
        loadUnits();
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

    const loadBrands = async () => {
        try {
            setLoadingBrands(true);
            const data = await brandsApi.getAll();
            setBrands(data);
        } catch (error) {
            console.error("Failed to load brands", error);
        } finally {
            setLoadingBrands(false);
        }
    };

    const loadTypes = async () => {
        try {
            setLoadingTypes(true);
            const data = await itemTypesApi.getAll();
            setTypes(data);
        } catch (error) {
            console.error("Failed to load types", error);
        } finally {
            setLoadingTypes(false);
        }
    };

    const loadUnits = async () => {
        try {
            setLoadingUnits(true);
            const data = await unitsApi.getAll();
            setUnits(data);
        } catch (error) {
            console.error("Failed to load units", error);
        } finally {
            setLoadingUnits(false);
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

    const handleAddBrand = async () => {
        if (!newBrandName.trim()) return;
        try {
            setAddingBrand(true);
            const newBrand = await brandsApi.create(newBrandName);
            setBrands([...brands, newBrand]);
            setNewBrandName("");
        } catch (error) {
            console.error("Failed to add brand", error);
        } finally {
            setAddingBrand(false);
        }
    };

    const handleAddType = async () => {
        if (!newTypeName.trim()) return;
        try {
            setAddingType(true);
            const newType = await itemTypesApi.create(newTypeName);
            setTypes([...types, newType]);
            setNewTypeName("");
        } catch (error) {
            console.error("Failed to add type", error);
        } finally {
            setAddingType(false);
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

    const handleDeleteBrand = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questa marca?")) return;
        try {
            await brandsApi.delete(id);
            setBrands(brands.filter(b => b.id !== id));
        } catch (error) {
             console.error("Failed to delete brand", error);
        }
    };

    const handleDeleteType = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questa tipologia?")) return;
        try {
            await itemTypesApi.delete(id);
            setTypes(types.filter(t => t.id !== id));
        } catch (error) {
             console.error("Failed to delete type", error);
        }
    };

    const handleAddUnit = async () => {
        if (!newUnitName.trim()) return;
        try {
            setAddingUnit(true);
            const newUnit = await unitsApi.create(newUnitName);
            setUnits([...units, newUnit]);
            setNewUnitName("");
        } catch (error) {
            console.error("Failed to add unit", error);
        } finally {
            setAddingUnit(false);
        }
    };

    const handleDeleteUnit = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questa unità?")) return;
        try {
            await unitsApi.delete(id);
            setUnits(units.filter(u => u.id !== id));
        } catch (error) {
             console.error("Failed to delete unit", error);
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
                        <Input 
                            placeholder="Nuova Marca..." 
                            className="max-w-sm" 
                            value={newBrandName}
                            onChange={(e) => setNewBrandName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
                        />
                        <Button 
                            size="icon" 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={handleAddBrand}
                            disabled={addingBrand || !newBrandName.trim()}
                        >
                            {addingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                    </div>
                    {loadingBrands ? (
                        <div className="flex items-center gap-2 text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento marche...
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {brands.map(brand => (
                                <Badge key={brand.id} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-2 text-sm">
                                    {brand.name}
                                    <button 
                                        className="hover:bg-slate-200 rounded-full p-0.5 transition-colors" 
                                        onClick={() => handleDeleteBrand(brand.id)}
                                    >
                                        <X className="h-3 w-3 text-slate-500" />
                                    </button>
                                </Badge>
                            ))}
                            {brands.length === 0 && (
                                <p className="text-sm text-muted-foreground italic">Nessuna marca presente.</p>
                            )}
                        </div>
                    )}
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
                        <Input 
                            placeholder="Nuova Tipologia..." 
                            className="max-w-sm" 
                            value={newTypeName}
                            onChange={(e) => setNewTypeName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
                        />
                        <Button 
                            size="icon" 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={handleAddType}
                            disabled={addingType || !newTypeName.trim()}
                        >
                            {addingType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                    </div>
                    {loadingTypes ? (
                        <div className="flex items-center gap-2 text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento tipologie...
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {types.map(type => (
                                <Badge key={type.id} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-2 text-sm">
                                    {type.name}
                                    <button 
                                        className="hover:bg-slate-200 rounded-full p-0.5 transition-colors" 
                                        onClick={() => handleDeleteType(type.id)}
                                    >
                                        <X className="h-3 w-3 text-slate-500" />
                                    </button>
                                </Badge>
                            ))}
                            {types.length === 0 && (
                                <p className="text-sm text-muted-foreground italic">Nessuna tipologia presente.</p>
                            )}
                        </div>
                    )}
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
                        <Input 
                            placeholder="Nuova Unità..." 
                            className="max-w-sm" 
                            value={newUnitName}
                            onChange={(e) => setNewUnitName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddUnit()}
                        />
                        <Button 
                            size="icon" 
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={handleAddUnit}
                            disabled={addingUnit || !newUnitName.trim()}
                        >
                            {addingUnit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        </Button>
                    </div>
                    {loadingUnits ? (
                        <div className="flex items-center gap-2 text-slate-500">
                            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento unità...
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {units.map(unit => (
                                <Badge key={unit.id} variant="outline" className="pl-3 pr-1 py-1 flex items-center gap-2 text-sm">
                                    {unit.name}
                                    <button 
                                        className="hover:bg-slate-100 rounded-full p-0.5 transition-colors" 
                                        onClick={() => handleDeleteUnit(unit.id)}
                                    >
                                        <X className="h-3 w-3 text-slate-500" />
                                    </button>
                                </Badge>
                            ))}
                            {units.length === 0 && (
                                <p className="text-sm text-muted-foreground italic">Nessuna unità presente.</p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
