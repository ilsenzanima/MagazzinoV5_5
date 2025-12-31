import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, MapPin } from "lucide-react";

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
    children?: React.ReactNode; // For JobSelector
}

export function MovementHeader({
    numberPart, setNumberPart, yearSuffix,
    date, setDate,
    causal, setCausal,
    pickupLocation, setPickupLocation,
    deliveryLocation, setDeliveryLocation,
    children
}: MovementHeaderProps) {
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
