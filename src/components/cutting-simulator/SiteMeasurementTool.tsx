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
    MapPin
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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

const TYPE_CONFIG = {
    room:  { label: "Stanza",  icon: Home,      color: "text-blue-500",   bg: "bg-blue-500/10",   fabBg: "bg-blue-600 hover:bg-blue-700" },
    wall:  { label: "Parete",  icon: Layers,    color: "text-amber-500",  bg: "bg-amber-500/10",  fabBg: "bg-amber-500 hover:bg-amber-600" },
    duct:  { label: "Canale",  icon: MapPin,    color: "text-emerald-500",bg: "bg-emerald-500/10",fabBg: "bg-emerald-600 hover:bg-emerald-700" },
    door:  { label: "Porta",   icon: DoorOpen,  color: "text-purple-500", bg: "bg-purple-500/10", fabBg: "bg-muted hover:bg-muted/80" },
};

export default function SiteMeasurementTool({ projectId }: { projectId: string }) {
    const [items, setItems] = useState<MeasurementItem[]>([]);
    const [activeTab, setActiveTab] = useState("all");

    const addItem = (type: MeasurementItem["type"]) => {
        const conf = TYPE_CONFIG[type];
        const newItem: MeasurementItem = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            label: `${conf.label} ${items.filter(i => i.type === type).length + 1}`,
            width: 0,
            height: type === "duct" ? 0 : 2700,
            length: type === "room" ? 0 : undefined,
        };
        setItems([...items, newItem]);
    };

    const updateItem = (id: string, field: keyof MeasurementItem, value: string | number) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const tabs = [
        { id: "all",  label: "Tutti" },
        { id: "room", label: "Stanze" },
        { id: "wall", label: "Pareti" },
        { id: "duct", label: "Canale" },
    ];

    const filtered = items.filter(i => activeTab === "all" || i.type === activeTab);

    return (
        <div className="flex flex-col h-screen bg-background overflow-hidden select-none">
            {/* Header */}
            <div className="bg-background border-b px-4 py-3 flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-3">
                    <Link href={`/disegno-taglio/${projectId}`}>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-sm font-black text-foreground leading-none uppercase tracking-tight">
                            Rilievo Misure
                        </h1>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">
                            Cantiere: {projectId === "demo" ? "Gorizia" : projectId}
                        </p>
                    </div>
                </div>
                <Button size="sm" className="font-bold h-9 px-4 rounded-full">
                    <Save className="h-4 w-4 mr-1.5" /> Salva
                </Button>
            </div>

            {/* Filter Tabs */}
            <div className="bg-background border-b overflow-x-auto scrollbar-hide shrink-0">
                <div className="flex p-2 gap-2 min-w-max px-4">
                    {tabs.map(tab => (
                        <Button
                            key={tab.id}
                            variant={activeTab === tab.id ? "default" : "outline"}
                            size="sm"
                            onClick={() => setActiveTab(tab.id)}
                            className="rounded-full h-8 text-xs font-bold"
                        >
                            {tab.label}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
                {filtered.map((item) => {
                    const conf = TYPE_CONFIG[item.type];
                    const Icon = conf.icon;
                    return (
                        <Card key={item.id} className="overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="bg-muted/30 px-4 py-3 border-b flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`p-1.5 rounded-md ${conf.bg} ${conf.color}`}>
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <input 
                                        className="bg-transparent font-bold text-foreground text-sm focus:outline-none border-b border-transparent focus:border-primary transition-colors py-0.5"
                                        value={item.label}
                                        onChange={(e) => updateItem(item.id, 'label', e.target.value)}
                                    />
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-muted-foreground/40 hover:text-destructive"
                                    onClick={() => removeItem(item.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                            <CardContent className="p-4 grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Larghezza (mm)</Label>
                                    <Input 
                                        type="number" 
                                        className="h-10 text-base font-bold" 
                                        value={item.width || ""}
                                        placeholder="0"
                                        onChange={(e) => updateItem(item.id, 'width', Number(e.target.value))}
                                    />
                                </div>
                                {item.type === "room" ? (
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Lunghezza (mm)</Label>
                                        <Input 
                                            type="number" 
                                            className="h-10 text-base font-bold" 
                                            value={item.length || ""}
                                            placeholder="0"
                                            onChange={(e) => updateItem(item.id, 'length', Number(e.target.value))}
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Altezza (mm)</Label>
                                        <Input 
                                            type="number" 
                                            className="h-10 text-base font-bold" 
                                            value={item.height || ""}
                                            placeholder="0"
                                            onChange={(e) => updateItem(item.id, 'height', Number(e.target.value))}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 px-10">
                        <div className="bg-muted p-6 rounded-full">
                            <Ruler className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                        <div>
                            <p className="font-bold text-muted-foreground uppercase tracking-widest text-xs">Nessuna misura salvata</p>
                            <p className="text-muted-foreground/60 text-xs mt-1 italic">Usa i pulsanti in basso per aggiungere elementi rilevati.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* FAB Bar */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-background/80 backdrop-blur-md p-2 rounded-full shadow-2xl border z-20">
                {(["room", "wall", "duct", "door"] as const).map((type) => {
                    const conf = TYPE_CONFIG[type];
                    const Icon = conf.icon;
                    return (
                        <Button
                            key={type}
                            onClick={() => addItem(type)}
                            className={`h-12 w-12 rounded-full p-0 shadow-lg active:scale-95 transition-all text-white ${conf.fabBg}`}
                            title={`Aggiungi ${conf.label}`}
                        >
                            <Icon className="h-5 w-5" />
                        </Button>
                    );
                })}
            </div>

            {/* Item count badge */}
            {items.length > 0 && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                    {items.length} elemento{items.length !== 1 ? "i" : ""} rilevat{items.length !== 1 ? "i" : "o"}
                </div>
            )}
        </div>
    );
}
