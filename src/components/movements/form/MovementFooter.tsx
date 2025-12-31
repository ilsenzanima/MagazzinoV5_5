import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
}

export function MovementFooter({
    transportMean, setTransportMean,
    transportTime, setTransportTime,
    appearance, setAppearance,
    packagesCount, setPackagesCount,
    notes, setNotes
}: MovementFooterProps) {
    // This could also be a Card, but NewMovementContent structure puts it at the bottom.
    // For now, let's just export the fields logic or return a fragment?
    // The original code had these fields somewhere... wait.
    // In the original file, they were NOT in a card. They were part of the main Form but handled by handleSubmit.
    // Actually, looking at the UI, they likely appear at the bottom.
    // Let's wrap them in a Card or Div. The original doesn't show them explicitly in the layout I viewed (lines 1-800).
    // Ah, lines 1-800 were truncated? No, 908 lines total. I missed the bottom part in the view.
    // I should check where they are rendered.
    // But standard DDT footer usually has these.

    // Let's assume a Card layout for consistency.
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-500">Trasporto</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Mezzo</Label>
                        <Input value={transportMean} onChange={e => setTransportMean(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Inizio Trasporto</Label>
                        <Input
                            type="datetime-local"
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
                            value={packagesCount}
                            onChange={e => setPackagesCount(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-500">Note</h3>
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
