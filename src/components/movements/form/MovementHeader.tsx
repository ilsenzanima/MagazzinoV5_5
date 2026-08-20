import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, MapPin, Warehouse as WarehouseIcon } from "lucide-react";
import type { Warehouse } from "@/lib/types";

interface MovementHeaderProps {
    numberPart: string;
    setNumberPart: (v: string) => void;
    yearSuffix: string;
    date: string;
    setDate: (v: string) => void;
    causal: string;
    setCausal: (v: string) => void;
    pickupLocation: string;
    setPickupLocation: (v: string) => void;
    deliveryLocation: string;
    setDeliveryLocation: (v: string) => void;
    warehouses: Warehouse[];
    activeTab: "entry" | "exit" | "sale" | "waste" | "transfer";
    fromWarehouseId: string;
    toWarehouseId: string;
    onFromWarehouseSelect: (id: string) => void;
    onToWarehouseSelect: (id: string) => void;
    children?: React.ReactNode; // For JobSelector
}

export function MovementHeader({
    numberPart, setNumberPart, yearSuffix,
    date, setDate,
    causal, setCausal,
    pickupLocation, setPickupLocation,
    deliveryLocation, setDeliveryLocation,
    warehouses, activeTab, fromWarehouseId, toWarehouseId, onFromWarehouseSelect, onToWarehouseSelect,
    children
}: MovementHeaderProps) {
    const showFrom = activeTab === "exit" || activeTab === "sale" || activeTab === "transfer";
    const showTo = activeTab === "entry" || activeTab === "transfer" || activeTab === "waste";
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Testata Documento
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label>Numero</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="N."
                                value={numberPart}
                                onChange={e => setNumberPart(e.target.value)}
                                className="w-24"
                            />
                            <span className="text-slate-500 font-mono text-sm">/PP{yearSuffix}</span>
                        </div>
                    </div>
                    <div>
                        <Label>Data</Label>
                        <Input
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>
                </div>

                {/* Job Selector Slot */}
                {children}

                {(showFrom || showTo) && (
                    <div className={`grid grid-cols-1 gap-4 ${showFrom && showTo ? "md:grid-cols-2" : ""}`}>
                        {showFrom && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">
                                    <WarehouseIcon className="h-3 w-3" />
                                    {activeTab === "transfer" ? "Da (magazzino)" : "Magazzino"}
                                </Label>
                                <Select value={fromWarehouseId} onValueChange={onFromWarehouseSelect}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Scegli magazzino..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses.map(w => (
                                            <SelectItem key={w.id} value={w.id}>
                                                {w.name}{w.isPrimary ? " (principale)" : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {showTo && (
                            <div className="space-y-2">
                                <Label className="flex items-center gap-1">
                                    <WarehouseIcon className="h-3 w-3" />
                                    {activeTab === "transfer" ? "A (magazzino)" : activeTab === "waste" ? "Deposito temporaneo" : "Magazzino"}
                                </Label>
                                <Select value={toWarehouseId} onValueChange={onToWarehouseSelect}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Scegli magazzino..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {warehouses.map(w => (
                                            <SelectItem key={w.id} value={w.id}>
                                                {w.name}{w.isPrimary ? " (principale)" : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "transfer" && fromWarehouseId && toWarehouseId && fromWarehouseId === toWarehouseId && (
                    <p className="text-xs text-red-600 dark:text-red-400 -mt-2">
                        Il magazzino di partenza e di destinazione coincidono: scegli due magazzini diversi.
                    </p>
                )}

                <div className="space-y-2">
                    <Label>Causale</Label>
                    <Input
                        value={causal}
                        onChange={e => setCausal(e.target.value)}
                        placeholder="Es. Rifornimento cantiere, Reso, Vendita..."
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Luogo Ritiro
                        </Label>
                        <Textarea
                            value={pickupLocation}
                            onChange={e => setPickupLocation(e.target.value)}
                            rows={3}
                            className="text-xs"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            Destinazione
                        </Label>
                        <Textarea
                            value={deliveryLocation}
                            onChange={e => setDeliveryLocation(e.target.value)}
                            rows={3}
                            className="text-xs"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
