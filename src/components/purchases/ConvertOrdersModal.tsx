"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, FileText, Calendar, ArrowRight } from "lucide-react";
import { purchasesApi, Purchase } from "@/lib/api";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** The order that triggered the modal — always pre-selected */
    triggerOrder: Purchase;
}

export function ConvertOrdersModal({ open, onOpenChange, triggerOrder }: Props) {
    const router = useRouter();
    const [orders, setOrders] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<Set<string>>(new Set([triggerOrder.id]));

    // Load other orders from same supplier when modal opens
    useEffect(() => {
        if (!open) return;
        setSelected(new Set([triggerOrder.id]));
        setLoading(true);
        purchasesApi.getPaginated({
            page: 1, limit: 50,
            supplierId: triggerOrder.supplierId,
            orderType: 'order',
        })
            .then(({ data }) => setOrders(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [open, triggerOrder.id, triggerOrder.supplierId]);

    const toggle = (id: string) => {
        // Cannot deselect the trigger order
        if (id === triggerOrder.id) return;
        setSelected(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    };

    const handleConvert = () => {
        const ids = [...selected].join(',');
        onOpenChange(false);
        router.push(`/purchases/new?fromOrders=${ids}`);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Converti Ordini in Acquisto</DialogTitle>
                </DialogHeader>

                <div className="text-sm text-slate-500 mb-3">
                    Fornitore: <span className="font-medium text-slate-800 dark:text-slate-200">{triggerOrder.supplierName}</span>
                    <br />
                    Seleziona gli ordini da unire in un unico acquisto.
                </div>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                        {orders.map(order => {
                            const isTrigger = order.id === triggerOrder.id;
                            const isChecked = selected.has(order.id);
                            return (
                                <label
                                    key={order.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
                                        ${isChecked
                                            ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}
                                        ${isTrigger ? 'opacity-75' : ''}`}
                                    onClick={() => toggle(order.id)}
                                >
                                    <Checkbox
                                        checked={isChecked}
                                        disabled={isTrigger}
                                        onCheckedChange={() => toggle(order.id)}
                                        onClick={e => e.stopPropagation()}
                                    />
                                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">
                                            {order.deliveryNoteNumber}
                                            {isTrigger && <span className="ml-2 text-xs text-blue-600 font-normal">(selezionato)</span>}
                                        </p>
                                        {order.jobCode && (
                                            <p className="text-xs text-slate-500">Commessa: {order.jobCode}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(order.deliveryNoteDate).toLocaleDateString('it-IT')}
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                )}

                <DialogFooter className="mt-4 gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={handleConvert}
                        disabled={selected.size === 0}
                    >
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Converti {selected.size > 1 ? `${selected.size} ordini` : "ordine"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
