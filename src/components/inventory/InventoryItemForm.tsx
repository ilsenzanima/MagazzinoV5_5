"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, Upload, Loader2 } from "lucide-react";
import { brandsApi, itemTypesApi, inventoryApi, unitsApi, Brand, ItemType, Unit } from "@/lib/api";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/auth-provider";

export interface InventoryFormData {
    code: string;
    name: string;
    model: string;
    brand: string;
    type: string;
    supplierCode: string;
    minStock: string;
    unit: string;
    coefficient: string;
    description: string;
    image: string;
}

interface InventoryItemFormProps {
    mode: 'create' | 'edit';
    initialData?: Partial<InventoryFormData>;
    initialCode?: string;
    onSubmit: (data: InventoryFormData, imageFile: File | null) => Promise<void>;
    onCancel: () => void;
    isSubmitting?: boolean;
}

export function InventoryItemForm({
    mode,
    initialData,
    initialCode,
    onSubmit,
    onCancel,
    isSubmitting = false
}: InventoryItemFormProps) {
    const { userRole } = useAuth();

    // Reference data
    const [brands, setBrands] = useState<Brand[]>([]);
    const [types, setTypes] = useState<ItemType[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Form state
    const [code, setCode] = useState(initialCode || "");
    const [formData, setFormData] = useState<Omit<InventoryFormData, 'code'>>({
        name: initialData?.name || "",
        model: initialData?.model || "",
        brand: initialData?.brand || "",
        type: initialData?.type || "",
        supplierCode: initialData?.supplierCode || "",
        minStock: initialData?.minStock || "5",
        unit: initialData?.unit || "PZ",
        coefficient: initialData?.coefficient || "1.0",
        description: initialData?.description || "",
        image: initialData?.image || ""
    });

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [previewImage, setPreviewImage] = useState<string>(initialData?.image || "");

    // Load reference data
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

                // Generate code for new items
                if (mode === 'create' && !initialCode) {
                    try {
                        const nextCode = await inventoryApi.getNextCode();
                        setCode(nextCode);
                    } catch (err) {
                        console.error("Failed to generate code", err);
                        const randomSuffix = crypto.randomUUID().split('-')[0].toUpperCase();
                        setCode(`PPA-${randomSuffix}`);
                    }
                }
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setLoadingData(false);
            }
        };
        loadData();
    }, [mode, initialCode]);

    // Update form when initial data changes
    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || "",
                model: initialData.model || "",
                brand: initialData.brand || "",
                type: initialData.type || "",
                supplierCode: initialData.supplierCode || "",
                minStock: initialData.minStock || "5",
                unit: initialData.unit || "PZ",
                coefficient: initialData.coefficient || "1.0",
                description: initialData.description || "",
                image: initialData.image || ""
            });
            if (initialData.image) {
                setPreviewImage(initialData.image);
            }
        }
    }, [initialData]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                setPreviewImage(result);
            };
            reader.readAsDataURL(file);
        }
    };

    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

    const handleSubmit = async () => {
        if (!isFormValid) return;

        // Check duplicates
        setIsCheckingDuplicate(true);
        try {
            // Solo se stiamo creando o se i campi chiave sono cambiati (difficile da tracciare qui, facciamo sempre check per sicurezza se non è troppo pesante, ma meglio solo in create per ora come richiesto per "protezione se creiamo")
            // Se siamo in edit, potremmo star salvando lo stesso articolo, quindi il check tornerebbe true.
            // La RPC check_inventory_duplicate non esclude l'ID corrente, quindi restituirà true per se stesso in edit.
            // Per ora lo implemento SOLO per CREATE come richiesto ("se creiamo un articolo gia presente").

            if (mode === 'create') {
                const isDuplicate = await inventoryApi.checkDuplicate({
                    name: formData.name,
                    brand: formData.brand,
                    type: formData.type,
                    model: formData.model
                });

                if (isDuplicate) {
                    alert("Articolo già presente! Specificare la variante per differenziarlo.");
                    setIsCheckingDuplicate(false);
                    return;
                }
            }

            await onSubmit({ ...formData, code }, imageFile);
        } catch (error) {
            console.error("Error checking duplicate or submitting", error);
            alert("Si è verificato un errore durante il salvataggio.");
        } finally {
            setIsCheckingDuplicate(false);
        }
    };

    const isFormValid = formData.name && formData.brand && formData.type;

    return (
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
                                <Label htmlFor="image-upload" className="cursor-pointer">
                                    <div className="bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-3 rounded-md flex items-center text-sm font-medium shadow-sm">
                                        Scegli File
                                    </div>
                                    <Input
                                        id="image-upload"
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="hidden"
                                        onChange={handleImageUpload}
                                    />
                                </Label>
                            </div>
                        </div>

                        {mode === 'create' && (
                            <>
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
                            </>
                        )}
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
                                <Input
                                    id="code"
                                    value={code}
                                    readOnly
                                    className="bg-slate-50 text-slate-500"
                                />
                                <p className="text-[10px] text-slate-400">Generato Automaticamente</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="brand">Marca</Label>
                                <Select
                                    value={formData.brand}
                                    onValueChange={(val) => setFormData({ ...formData, brand: val })}
                                >
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
                                onChange={(e) => setFormData({ ...formData, supplierCode: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="name">Nome Prodotto</Label>
                            <Input
                                id="name"
                                placeholder="Es. Trapano Avvitatore 18V"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="model">Modello / Variante / Dimensioni</Label>
                            <Input
                                id="model"
                                placeholder="Es. DN 50, 10mm, XL..."
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                            />
                            <p className="text-[10px] text-slate-400">Opzionale: Utile per distinguere articoli con lo stesso nome ma dimensioni diverse.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="type">Tipologia</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(val) => setFormData({ ...formData, type: val })}
                                >
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
                                    onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                                />
                                <p className="text-[10px] text-slate-400">Soglia per avviso "Basse Scorte"</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="unit">Unità di Misura</Label>
                                <Select
                                    value={formData.unit}
                                    onValueChange={(val) => setFormData({ ...formData, unit: val })}
                                >
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
                                    onChange={(e) => setFormData({ ...formData, coefficient: e.target.value })}
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
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="pt-4 flex justify-end gap-2">
                            <Button variant="outline" onClick={onCancel}>
                                Annulla
                            </Button>
                            <Button
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={handleSubmit}
                                disabled={!isFormValid || isSubmitting || isCheckingDuplicate}
                            >
                                {isSubmitting || isCheckingDuplicate ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {isCheckingDuplicate ? "Verifica..." : "Salvataggio..."}
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        {mode === 'create' ? 'Crea Articolo' : 'Salva Modifiche'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
