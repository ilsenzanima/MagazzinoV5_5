"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Trash2, Upload } from "lucide-react";
import { mockInventoryItems, InventoryItem } from "@/lib/mock-data";
import Link from "next/link";

export default function InventoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);

  // Load data (simulating API fetch)
  useEffect(() => {
    if (id) {
      const foundItem = mockInventoryItems.find((i) => i.id === id);
      if (foundItem) {
        setItem(foundItem);
      }
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-full items-center justify-center">
          <p>Caricamento...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!item) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
          <h2 className="text-2xl font-bold text-slate-900">Articolo non trovato</h2>
          <Link href="/inventory">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Torna all'Inventario
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
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
                {item.name}
              </h1>
              <p className="text-sm text-slate-500">Codice: {item.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" /> Elimina
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Save className="mr-2 h-4 w-4" /> Salva Modifiche
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Image & Status */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="aspect-square relative rounded-md overflow-hidden bg-slate-100 border flex items-center justify-center group">
                  <img
                    src={item.image || "/placeholder.svg"}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="secondary" size="sm">
                      <Upload className="mr-2 h-4 w-4" /> Cambia Foto
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Stato Stock</Label>
                  <select
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    defaultValue={item.status}
                  >
                    <option value="in_stock">Disponibile</option>
                    <option value="low_stock">Scarse Scorte</option>
                    <option value="out_of_stock">Esaurito</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Quantità</Label>
                  <Input 
                    type="number" 
                    defaultValue={item.quantity} 
                    className="text-lg font-bold"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Details Form */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Dettagli Articolo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Codice Articolo</Label>
                    <Input id="code" defaultValue={item.code} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input id="brand" defaultValue={item.brand} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome Prodotto</Label>
                  <Input id="name" defaultValue={item.name} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipologia</Label>
                    <Input id="type" defaultValue={item.type} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minStock">Scorta Minima</Label>
                    <Input id="minStock" type="number" defaultValue={item.minStock} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrizione</Label>
                  <Textarea 
                    id="description" 
                    defaultValue={item.description} 
                    className="min-h-[120px]"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
