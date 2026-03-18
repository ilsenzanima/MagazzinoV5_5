"use client";

import React, { useState } from "react";
import { 
    Ruler, 
    ArrowLeft, 
    Plus, 
    Trash2, 
    Home, 
    DoorOpen, 
    Layers, 
    Save, 
    Search,
    ChevronDown,
    MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";

interface MeasurementItem {
    id: string;
    type: "room" | "wall" | "door" | "duct";
    label: string;
    width: number;
    height?: number;
    length?: number;
    depth?: number;
}

export default function SiteMeasurementTool({ projectId }: { projectId: string }) {
    const [items, setItems] = useState<MeasurementItem[]>([]);
    const [activeTab, setActiveTab] = useState("all");

    const addItem = (type: MeasurementItem["type"]) => {
        const newItem: MeasurementItem = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            label: `${type.charAt(0).toUpperCase() + type.slice(1)} ${items.filter(i => i.type === type).length + 1}`,
            width: 0,
            height: type === "duct" ? 0 : 2700,
            length: type === "room" ? 0 : undefined,
        };
        setItems([...items, newItem]);
    };

    const updateItem = (id: string, field: keyof MeasurementItem, value: any) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden select-none">
            {/* Mobile Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <Link href={`/disegno-taglio/${projectId}`}>
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-sm font-black text-slate-900 leading-none uppercase tracking-tight">
                            Rilievo Misure
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            Cantiere: {projectId === "demo" ? "Gorizia" : projectId}
                        </p>
                    </div>
                </div>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-9 px-4 rounded-full shadow-md active:scale-95 transition-all">
                    <Save className="h-4 w-4 mr-1.5" /> Salva
                </Button>
            </div>

            {/* Quick Filter Bar */}
            <div className="bg-white border-b border-slate-100 overflow-x-auto scrollbar-hide shrink-0">
                <div className="flex p-2 gap-2 min-w-max px-4">
                    <Button 
                        variant={activeTab === "all" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setActiveTab("all")}
                        className="rounded-full h-8 text-xs font-bold"
                    >
                        Tutti
                    </Button>
                    <Button 
                        variant={activeTab === "room" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setActiveTab("room")}
                        className="rounded-full h-8 text-xs font-bold gap-1.5"
                    >
                        <Home className="h-3.5 w-3.5" /> Stanze
                    </Button>
                    <Button 
                        variant={activeTab === "wall" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setActiveTab("wall")}
                        className="rounded-full h-8 text-xs font-bold gap-1.5"
                    >
                        <Layers className="h-3.5 w-3.5" /> Pareti
                    </Button>
                    <Button 
                        variant={activeTab === "duct" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setActiveTab("duct")}
                        className="rounded-full h-8 text-xs font-bold gap-1.5"
                    >
                        <MapPin className="h-3.5 w-3.5" /> Canale
                    </Button>
                </div>
            </div>

            {/* Scrollable Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                {items.filter(i => activeTab === "all" || i.type === activeTab).map((item) => (
                    <Card key={item.id} className="border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`p-1.5 rounded-md ${
                                    item.type === 'room' ? 'bg-blue-100 text-blue-600' :
                                    item.type === 'wall' ? 'bg-amber-100 text-amber-600' :
                                    item.type === 'duct' ? 'bg-emerald-100 text-emerald-600' :
                                    'bg-slate-100 text-slate-600'
                                }`}>
                                    {item.type === 'room' && <Home className="h-4 w-4" />}
                                    {item.type === 'wall' && <Layers className="h-4 w-4" />}
                                    {item.type === 'door' && <DoorOpen className="h-4 w-4" />}
                                    {item.type === 'duct' && <MapPin className="h-4 w-4" />}
                                </span>
                                <input 
                                    className="bg-transparent font-bold text-slate-800 text-sm focus:outline-none border-b border-transparent focus:border-blue-400 transition-colors py-0.5"
                                    value={item.label}
                                    onChange={(e) => updateItem(item.id, 'label', e.target.value)}
                                />
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-300 hover:text-red-500"
                                onClick={() => removeItem(item.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                        <CardContent className="p-4 bg-white grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Larghezza (mm)</Label>
                                <Input 
                                    type="number" 
                                    className="h-10 text-base font-bold text-slate-900 border-slate-100" 
                                    value={item.width || ""}
                                    placeholder="0"
                                    onChange={(e) => updateItem(item.id, 'width', Number(e.target.value))}
                                />
                            </div>
                            {item.type === "room" ? (
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Lunghezza (mm)</Label>
                                    <Input 
                                        type="number" 
                                        className="h-10 text-base font-bold text-slate-900 border-slate-100" 
                                        value={item.length || ""}
                                        placeholder="0"
                                        onChange={(e) => updateItem(item.id, 'length', Number(e.target.value))}
                                    />
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Altezza (mm)</Label>
                                    <Input 
                                        type="number" 
                                        className="h-10 text-base font-bold text-slate-900 border-slate-100" 
                                        value={item.height || ""}
                                        placeholder="0"
                                        onChange={(e) => updateItem(item.id, 'height', Number(e.target.value))}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {items.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 px-10">
                        <div className="bg-slate-100 p-6 rounded-full">
                            <Ruler className="h-12 w-12 text-slate-300" />
                        </div>
                        <div>
                            <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Nessuna misura salvata</p>
                            <p className="text-slate-300 text-xs mt-1 italic">Usa i pulsanti in basso per aggiungere elementi rilevati.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Fab Buttons / Action Bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white/80 backdrop-blur-md p-2 rounded-full shadow-2xl border border-slate-200 z-20">
                <Button 
                    onClick={() => addItem("room")}
                    className="h-12 w-12 rounded-full p-0 bg-blue-600 hover:bg-blue-700 shadow-lg active:scale-95 transition-all"
                    title="Aggiungi Stanza"
                >
                    <Home className="h-6 w-6" />
                </Button>
                <Button 
                    onClick={() => addItem("wall")}
                    className="h-12 w-12 rounded-full p-0 bg-amber-500 hover:bg-amber-600 shadow-lg active:scale-95 transition-all"
                    title="Aggiungi Parete"
                >
                    <Layers className="h-6 w-6" />
                </Button>
                <Button 
                    onClick={() => addItem("duct")}
                    className="h-12 w-12 rounded-full p-0 bg-emerald-500 hover:bg-emerald-600 shadow-lg active:scale-95 transition-all"
                    title="Aggiungi Canale"
                >
                    <MapPin className="h-6 w-6" />
                </Button>
                <Button 
                    onClick={() => addItem("door")}
                    className="h-12 w-12 rounded-full p-0 bg-slate-700 hover:bg-slate-800 shadow-lg active:scale-95 transition-all"
                    title="Altro"
                >
                    <Plus className="h-6 w-6" />
                </Button>
            </div>
        </div>
    );
}
