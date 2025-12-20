"use client";

import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { mockBrands, mockTypes, mockUnits } from "@/lib/mock-data";
import { Plus, X } from "lucide-react";
import { useState } from "react";

export default function SettingsInventoryPage() {
    const [brands, setBrands] = useState(mockBrands);
    const [types, setTypes] = useState(mockTypes);
    const [units, setUnits] = useState(mockUnits);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Impostazioni Inventario</h3>
        <p className="text-sm text-muted-foreground">
          Gestisci le liste predefinite per i prodotti.
        </p>
      </div>
      <Separator />

      <Tabs defaultValue="brands">
        <TabsList>
            <TabsTrigger value="brands">Marche</TabsTrigger>
            <TabsTrigger value="types">Tipologie</TabsTrigger>
            <TabsTrigger value="units">Unità di Misura</TabsTrigger>
        </TabsList>
        
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
