import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MovementFooterProps {
    transportMean: string;
    setTransportMean: (v: string) => void;
    transportTime: string;
    setTransportTime: (v: string) => void;
    appearance: string;
    setAppearance: (v: string) => void;
    packagesCount: string;
    setPackagesCount: (v: string) => void;
    notes: string;
    setNotes: (v: string) => void;
    linesCount?: number; // For auto N. Colli
}

const TRANSPORT_MEANS = [
    { value: "Mittente", label: "Mittente" },
    { value: "Destinatario", label: "Destinatario" },
    { value: "Vettore", label: "Vettore" },
];

export function MovementFooter({
    transportMean, setTransportMean,
    transportTime, setTransportTime,
    appearance, setAppearance,
    packagesCount, setPackagesCount,
    notes, setNotes,
    linesCount = 1
}: MovementFooterProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Trasporto</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Mezzo</Label>
                        <Select value={transportMean} onValueChange={setTransportMean}>
                            <SelectTrigger>
                                <SelectValue placeholder="Seleziona mezzo..." />
                            </SelectTrigger>
                            <SelectContent>
                                {TRANSPORT_MEANS.map(m => (
                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Ora Trasporto</Label>
                        <Input
                            type="time"
                            value={transportTime}
                            onChange={e => setTransportTime(e.target.value)}
                        />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Aspetto Beni</Label>
                        <Input value={appearance} onChange={e => setAppearance(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>N. Colli</Label>
                        <Input
                            type="number"
                            min="1"
                            value={linesCount.toString()}
                            readOnly
                            className="bg-slate-100 dark:bg-slate-800 cursor-not-allowed"
                        />
                        <p className="text-xs text-muted-foreground">Calcolato automaticamente</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Note</h3>
                <Textarea
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={5}
                    placeholder="Note aggiuntive..."
                />
            </div>
        </div>
    );
}

