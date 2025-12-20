"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Trash2, Upload, QrCode } from "lucide-react";
import { 
  mockInventoryItems, 
  InventoryItem, 
  mockBrands, 
  mockTypes, 
  mockUnits,
  mockMovements,
  Movement
} from "@/lib/mock-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import QRCode from "react-qr-code";
import Barcode from "react-barcode";
import Link from "next/link";

export default function InventoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<Movement[]>([]);

  // Load data (simulating API fetch)
  useEffect(() => {
    if (id) {
      const foundItem = mockInventoryItems.find((i) => i.id === id);
      if (foundItem) {
        setItem(foundItem);
        // Load movements
        const itemMovements = mockMovements.filter(m => m.itemId === id);
        setMovements(itemMovements);
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

  // Logic for Stock Status
  const getStatus = (qty: number, min: number) => {
    if (qty === 0) return { label: "Esaurito", color: "bg-red-100 text-red-700 border-red-200" };
    if (qty <= min) return { label: "Basse Scorte", color: "bg-amber-100 text-amber-700 border-amber-200" };
    return { label: "Disponibile", color: "bg-green-100 text-green-700 border-green-200" };
  };

  const status = getStatus(item.quantity, item.minStock);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 pb-20">
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
              <p className="text-sm text-slate-500 font-mono">{item.code}</p>
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
          {/* Left Column: Image, QR & Status */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-4 space-y-4">
                {/* Image Section */}
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
                
                {/* Status Badge */}
                <div className="space-y-2">
                  <Label>Stato Stock (Calcolato)</Label>
                  <div className={`flex items-center justify-center p-2 rounded-md border font-bold ${status.color}`}>
                    {status.label}
                  </div>
                </div>

                {/* Quantity Read-Only */}
                <div className="space-y-2">
                  <Label>Quantità Attuale</Label>
                  <Input 
                    type="number" 
                    value={item.quantity} 
                    readOnly
                    className="text-lg font-bold bg-slate-50 text-slate-600"
                  />
                  <p className="text-xs text-slate-400">Aggiornato dai movimenti</p>
                </div>

                {/* QR Code & Barcode */}
                <div className="pt-4 border-t flex flex-col items-center gap-4">
                  <div className="w-full">
                    <Label className="mb-2 block text-center">Codice Identificativo</Label>
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-white p-2 rounded border">
                        <QRCode value={item.code} size={128} />
                      </div>
                      <div className="bg-white p-2 rounded border overflow-hidden max-w-full">
                        <Barcode value={item.code} width={1.5} height={50} fontSize={12} />
                      </div>
                    </div>
                  </div>
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
                    <Input id="code" value={item.code} readOnly className="bg-slate-50 text-slate-500" />
                    <p className="text-[10px] text-slate-400">Generato Automaticamente</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Select defaultValue={item.brand}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona Marca" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockBrands.map((brand) => (
                          <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Nome Prodotto</Label>
                  <Input id="name" defaultValue={item.name} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tipologia</Label>
                    <Select defaultValue={item.type}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona Tipologia" />
                      </SelectTrigger>
                      <SelectContent>
                        {mockTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minStock">Scorta Minima</Label>
                    <Input id="minStock" type="number" defaultValue={item.minStock} />
                    <p className="text-[10px] text-slate-400">Soglia per avviso "Basse Scorte"</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div className="space-y-2">
                    <Label htmlFor="unit">Unità di Misura</Label>
                    <Select defaultValue={item.unit}>
                      <SelectTrigger>
                        <SelectValue placeholder="U.M." />
                      </SelectTrigger>
                      <SelectContent>
                        {mockUnits.map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coefficient">Coeff. Moltiplicazione</Label>
                    <Input id="coefficient" type="number" step="0.01" defaultValue={item.coefficient} />
                    <p className="text-[10px] text-slate-400">Visibile solo admin</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrizione</Label>
                  <Textarea 
                    id="description" 
                    defaultValue={item.description} 
                    className="min-h-[100px]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Movements Section */}
            <Card>
              <CardHeader>
                <CardTitle>Storico Movimenti</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Riferimento</TableHead>
                      <TableHead className="text-right">Quantità</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-slate-400 py-6">
                          Nessun movimento registrato
                        </TableCell>
                      </TableRow>
                    ) : (
                      movements.map((move) => (
                        <TableRow key={move.id}>
                          <TableCell className="font-mono text-xs">{move.date}</TableCell>
                          <TableCell>
                            <Badge variant={move.type === 'load' ? 'default' : 'secondary'} className={move.type === 'load' ? 'bg-green-600' : ''}>
                              {move.type === 'load' ? 'Carico' : 'Scarico'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{move.reference}</TableCell>
                          <TableCell className="text-right font-bold">
                            {move.type === 'load' ? '+' : '-'}{move.quantity}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
