"use client"

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  Plus, 
  Info,
  ChevronLeft,
  Package
} from "lucide-react";
import Link from "next/link";

// Tipi definiti per il mock data (futura tabella DB)
type Article = {
  id: string;
  code: string;
  name: string;
  type: string;
  brand: string;
  quantity: number;
  minStock: number;
  location: string;
  image: string;
};

// Dati Mock
const MOCK_INVENTORY: Article[] = [
  {
    id: "1",
    code: "TRP-12345",
    name: "Trapano a Percussione 18V",
    type: "Elettroutensili",
    brand: "Bosch",
    quantity: 25,
    minStock: 10,
    location: "Corsia 3, Scaffale B",
    image: "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=400&fit=crop",
  },
  {
    id: "2",
    code: "MRT-001",
    name: "Martello da Carpentiere",
    type: "Utensili Manuali",
    brand: "Stanley",
    quantity: 5,
    minStock: 8, // Basse scorte
    location: "Corsia 1, Scaffale A",
    image: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=400&h=400&fit=crop",
  },
  {
    id: "3",
    code: "VTI-500",
    name: "Set Viti 500pz",
    type: "Ferramenta",
    brand: "Wurth",
    quantity: 0, // Esaurito
    minStock: 20,
    location: "Corsia 2, Cassetto 4",
    image: "https://images.unsplash.com/photo-1585338676231-6b8026131c03?w=400&h=400&fit=crop",
  },
  {
    id: "4",
    code: "CSK-99",
    name: "Casco Protettivo Giallo",
    type: "DPI",
    brand: "3M",
    quantity: 15,
    minStock: 5,
    location: "Corsia 5, Scaffale C",
    image: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=400&h=400&fit=crop",
  },
   {
    id: "5",
    code: "FLX-20",
    name: "Flessibile 115mm",
    type: "Elettroutensili",
    brand: "Makita",
    quantity: 8,
    minStock: 10, // Basse scorte
    location: "Corsia 3, Scaffale B",
    image: "https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400&h=400&fit=crop",
  },
];

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  // Logica di Filtro
  const filteredItems = MOCK_INVENTORY.filter((item) => {
    // 1. Filtro Ricerca (Cerca su tutti i campi testuali)
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.type.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Filtro Tab
    let matchesTab = true;
    if (activeTab === "low_stock") {
      matchesTab = item.quantity > 0 && item.quantity <= item.minStock;
    } else if (activeTab === "out_of_stock") {
      matchesTab = item.quantity === 0;
    }

    return matchesSearch && matchesTab;
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      
      {/* Header Fisso */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="-ml-2">
              <ChevronLeft className="h-6 w-6 text-slate-600" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold text-slate-900">Gestione Inventario</h1>
          <Button variant="ghost" size="icon" className="ml-auto">
            <Filter className="h-5 w-5 text-slate-600" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cerca Articoli (Nome, Codice, Marca...)" 
            className="pl-9 bg-slate-100 border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-100">
            <TabsTrigger value="all">Tutti</TabsTrigger>
            <TabsTrigger value="low_stock" className="data-[state=active]:text-amber-600">Basse Scorte</TabsTrigger>
            <TabsTrigger value="out_of_stock" className="data-[state=active]:text-red-600">Esauriti</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Lista Articoli */}
      <div className="p-4 space-y-4 max-w-md mx-auto md:max-w-4xl">
        {filteredItems.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <Package className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Nessun articolo trovato</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-0 flex">
                {/* Immagine */}
                <div className="w-24 h-24 bg-slate-200 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={item.image} 
                    alt={item.name} 
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Dettagli */}
                <div className="flex-1 p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start">
                      <div>
                         <h3 className="font-bold text-slate-900 line-clamp-1">{item.name}</h3>
                         <p className="text-xs text-slate-500 font-mono">{item.code}</p>
                      </div>
                      <Badge variant="outline" className={
                        item.quantity === 0 ? "text-red-600 border-red-200 bg-red-50" :
                        item.quantity <= item.minStock ? "text-amber-600 border-amber-200 bg-amber-50" :
                        "text-slate-600"
                      }>
                        {item.quantity} in stock
                      </Badge>
                    </div>
                    
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal text-slate-600">
                        {item.brand}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal text-slate-600">
                        {item.type}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-end justify-between mt-2">
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      📍 {item.location}
                    </p>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <Info className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-20">
        <Button className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700">
          <Plus className="h-8 w-8" />
        </Button>
      </div>

    </div>
  );
}
