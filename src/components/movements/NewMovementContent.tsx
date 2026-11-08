"use client";

import { Button } from "@/components/ui/button";
import { confirmDialog } from "@/components/ui/confirm-host";
import { NotchTabs, NotchActions, NotchButton, NotchHelp } from "@/components/ui/notch-tabs";
import {
    ArrowLeft,
    Save,
    Loader2,
    ArrowDownRight,
    ArrowUpRight,
    ShoppingBag,
    Recycle,
    Repeat,
    Trash2,
    FileClock,
} from "lucide-react";
import Link from "next/link";
import { InventoryItem, Job, DeliveryNote } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { useMovementForm } from "@/hooks/useMovementForm";

import { MovementHeader } from "./form/MovementHeader";
import { MovementJobSelector } from "./form/MovementJobSelector";
import { MovementFooter } from "./form/MovementFooter";
import { MovementInlineTable } from "./form/MovementInlineTable";

interface NewMovementContentProps {
    initialInventory: InventoryItem[];
    initialJobs: Job[];
    initialNote?: DeliveryNote;
    draftId?: string;
}

export default function NewMovementContent({
    initialInventory,
    initialJobs,
    initialNote,
    draftId,
}: NewMovementContentProps) {
    const { userRole } = useAuth();
    const form = useMovementForm({ initialInventory, initialJobs, initialNote, draftId });

    if (userRole === "user") {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                    Accesso Negato
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                    Non hai i permessi necessari per{" "}
                    {form.isEditing ? "modificare" : "creare nuovi"} movimenti.
                </p>
                <Link href="/movements">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Torna ai Movimenti
                    </Button>
                </Link>
            </div>
        );
    }

    const completedLines = form.lines.filter((l) => l.itemId && l.quantity);

    const tabs = [
        { value: "exit", label: "Uscita", icon: <ArrowUpRight />, bubbleClass: "bg-amber-500" },
        { value: "entry", label: "Entrata / Reso", icon: <ArrowDownRight />, bubbleClass: "bg-green-600" },
        { value: "sale", label: "Vendita", icon: <ShoppingBag />, bubbleClass: "bg-blue-600" },
        { value: "waste", label: "Eccedenze", icon: <Recycle />, bubbleClass: "bg-violet-600" },
        { value: "transfer", label: "Trasferimento", icon: <Repeat />, bubbleClass: "bg-teal-600" },
    ];
    const submitLabel = form.draftId ? "Crea bolla" : "Salva";

    return (
        <div className="space-y-6 pb-20 max-w-6xl mx-auto">
            <NotchTabs
                title={
                    <span className="flex items-center gap-2">
                        {form.draftId ? "Bozza di movimento" : form.isEditing ? "Modifica Movimento" : "Nuovo Movimento"}
                        {form.draftId && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase text-amber-800">Bozza</span>}
                    </span>
                }
                items={tabs}
                value={form.activeTab}
                onValueChange={(v) => form.setActiveTab(v as any)}
                tabWidth={130}
            >
                <NotchHelp
                    title="Tipi di movimento"
                    lines={[
                        "Uscita: materiale che esce dal magazzino verso un cantiere o una destinazione esterna, scalando lo stock.",
                        "Entrata / Reso: ingressi normali e resi da cantiere, lo stock disponibile aumenta.",
                        "Vendita: come un'uscita, ma il materiale è ceduto a un cliente.",
                        "Eccedenze: materiale di scarto registrato in peso (kg), sempre fittizio, con nota legale sul deposito temporaneo.",
                        "Trasferimento: allinea uno spostamento tra magazzini; righe sempre fittizie, lo stock non cambia.",
                    ]}
                />
                <NotchActions>
                    {form.draftId && (
                        <NotchButton
                            type="button"
                            title="Elimina bozza"
                            aria-label="Elimina bozza"
                            onClick={async () => {
                                if (await confirmDialog("Eliminare questa bozza? Non è ancora una bolla e il magazzino non cambia.")) form.handleDeleteDraft();
                            }}
                            disabled={form.loading || form.savingDraft}
                            className="px-2 text-red-600 [&_svg]:text-red-600"
                        >
                            <Trash2 />
                        </NotchButton>
                    )}
                    {!form.isEditing && (
                        <NotchButton
                            type="button"
                            title={form.draftId ? "Salva bozza" : "Salva come bozza"}
                            aria-label={form.draftId ? "Salva bozza" : "Salva come bozza"}
                            onClick={form.handleSaveDraft}
                            disabled={form.loading || form.savingDraft}
                            className="px-2"
                        >
                            {form.savingDraft ? <Loader2 className="animate-spin" /> : <FileClock />}
                        </NotchButton>
                    )}
                    <Link href="/movements">
                        <NotchButton type="button">Annulla</NotchButton>
                    </Link>
                    <NotchButton
                        type="button"
                        title={form.draftId ? "Conferma e crea bolla" : form.isEditing ? "Salva Modifiche" : "Salva Documento"}
                        onClick={form.handleSubmit}
                        disabled={form.loading || form.savingDraft}
                        className="border-blue-700 bg-blue-600 text-white hover:bg-blue-700 hover:text-white [&_svg]:text-white"
                    >
                        {form.loading ? <Loader2 className="animate-spin" /> : <Save />}
                        {submitLabel}
                    </NotchButton>
                </NotchActions>

                <div className="mt-6 space-y-6">
                    <MovementHeader
                        numberPart={form.numberPart}
                        setNumberPart={form.setNumberPart}
                        yearSuffix={form.yearSuffix}
                        date={form.date}
                        setDate={form.setDate}
                        causal={form.causal}
                        setCausal={form.setCausal}
                        pickupLocation={form.pickupLocation}
                        setPickupLocation={form.setPickupLocation}
                        deliveryLocation={form.deliveryLocation}
                        setDeliveryLocation={form.setDeliveryLocation}
                        warehouses={form.warehouses}
                        activeTab={form.activeTab}
                        fromWarehouseId={form.fromWarehouseId}
                        toWarehouseId={form.toWarehouseId}
                        onFromWarehouseSelect={form.handleFromWarehouseSelect}
                        onToWarehouseSelect={form.handleToWarehouseSelect}
                    >
                        <MovementJobSelector
                            selectedJob={form.selectedJob}
                            onSelect={form.handleJobSelect}
                            onClear={() => form.setSelectedJob(null)}
                            isOpen={form.isJobSelectorOpen}
                            setIsOpen={form.setIsJobSelectorOpen}
                            jobs={form.jobs}
                            onSearch={form.handleJobSearch}
                            loading={form.jobsLoading}
                        />
                    </MovementHeader>

                    <MovementInlineTable
                        lines={form.lines}
                        activeTab={form.activeTab}
                        selectedJob={form.selectedJob}
                        jobBatchAvailability={form.jobBatchAvailability}
                        inventory={form.inventory}
                        itemsLoading={form.itemsLoading}
                        onItemSearch={form.handleItemSearch}
                        onItemSelect={form.handleInlineItemSelect}
                        onReturnBatchSelect={form.handleInlineReturnBatchSelect}
                        onLineChange={form.handleInlineLineChange}
                        onRemove={form.handleInlineLineRemove}
                        onDuplicate={form.handleInlineLineDuplicate}
                        onSplit={form.handleInlineLineSplit}
                        onPurchaseItemsImport={form.handlePurchaseItemsImport}
                        onNoteItemsImport={form.handleNoteItemsImport}
                    />

                    <MovementFooter
                        transportMean={form.transportMean}
                        setTransportMean={form.setTransportMean}
                        transportTime={form.transportTime}
                        setTransportTime={form.setTransportTime}
                        appearance={form.appearance}
                        setAppearance={form.setAppearance}
                        packagesCount={form.packagesCount}
                        setPackagesCount={form.setPackagesCount}
                        notes={form.notes}
                        setNotes={form.setNotes}
                        linesCount={completedLines.length}
                    />
                </div>
            </NotchTabs>
        </div>
    );
}
