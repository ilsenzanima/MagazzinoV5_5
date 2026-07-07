import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Trash2 } from "lucide-react";
import { Client } from "@/lib/types";

interface MovementClientSelectorProps {
    selectedClient: Client | null;
    onSelect: (client: Client | null) => void;
    clients: Client[];
}

export function MovementClientSelector({
    selectedClient,
    onSelect,
    clients,
}: MovementClientSelectorProps) {
    return (
        <div className="space-y-2">
            <Label>Committente di Riferimento</Label>
            <div className="flex gap-2">
                <div className="flex-1">
                    <SearchableSelect
                        options={clients.map((c) => ({
                            value: c.id,
                            label: c.name,
                            description: c.address || undefined,
                        }))}
                        value={selectedClient?.id || ""}
                        onValueChange={(val) => {
                            const client = clients.find((c) => c.id === val) || null;
                            onSelect(client);
                        }}
                        placeholder="Seleziona Committente..."
                        searchPlaceholder="Cerca committente..."
                        emptyMessage="Nessun committente trovato"
                    />
                </div>
                {selectedClient && (
                    <Button variant="ghost" size="icon" onClick={() => onSelect(null)}>
                        <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500" />
                    </Button>
                )}
            </div>
        </div>
    );
}
