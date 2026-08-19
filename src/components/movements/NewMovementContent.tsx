"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ArrowLeft,
    Save,
    Loader2,
    ArrowDownRight,
    ArrowUpRight,
    ShoppingBag,
    Recycle,
    Repeat,
} from "lucide-react";
import Link from "next/link";
import { InventoryItem, Job, DeliveryNote } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { useMovementForm } from "@/hooks/useMovementForm";
import { HelpTip } from "@/components/ui/help-tip";

import { MovementHeader } from "./form/MovementHeader";
import { MovementJobSelector } from "./form/MovementJobSelector";
import { MovementFooter } from "./form/MovementFooter";
import { MovementInlineTable } from "./form/MovementInlineTable";

interface NewMovementContentProps {
    initialInventory: InventoryItem[];
    initialJobs: Job[];
    initialNote?: DeliveryNote;
}

export default function NewMovementContent({
    initialInventory,
    initialJobs,
    initialNote,
}: NewMovementContentProps) {
    const { userRole } = useAuth();
    const form = useMovementForm({ initialInventory, initialJobs, initialNote });

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

    return (
        <div className="space-y-6 pb-20 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Link href="/movements">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {form.isEditing ? "Modifica Movimento" : "Nuovo Movimento"}
                    </h1>
                </div>
                <Button
                    onClick={form.handleSubmit}
                    disabled={form.loading}
                    className="bg-[#003366] hover:bg-[#002244]"
                >
                    {form.loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {form.isEditing ? "Salva Modifiche" : "Salva Documento"}
                </Button>
            </div>

            {/* Type Tabs */}
            <Tabs
                value={form.activeTab}
                onValueChange={(v: any) => form.setActiveTab(v)}
                className="w-full"
            >
                <TabsList className="grid w-full grid-cols-5 mb-6">
                    <TabsTrigger
                        value="exit"
                        className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800"
                    >
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                        Uscita
                        <HelpTip
                            title="Uscita"
                            description="Materiale che esce dal magazzino verso un cantiere o una destinazione esterna, scalando lo stock disponibile."
                        />
                    </TabsTrigger>
                    <TabsTrigger
                        value="entry"
                        className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800"
                    >
                        <ArrowDownRight className="mr-2 h-4 w-4" />
                        Entrata / Reso
                        <HelpTip
                            title="Entrata / Reso"
                            description="Copre sia gli ingressi normali di materiale sia i resi da cantiere: in entrambi i casi lo stock disponibile aumenta."
                        />
                    </TabsTrigger>
                    <TabsTrigger
                        value="sale"
                        className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800"
                    >
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        Vendita
                        <HelpTip
                            title="Vendita"
                            description="Come un'uscita, ma il materiale viene ceduto a un cliente invece che portato in cantiere."
                        />
                    </TabsTrigger>
                    <TabsTrigger
                        value="waste"
                        className="data-[state=active]:bg-violet-100 data-[state=active]:text-violet-800"
                    >
                        <Recycle className="mr-2 h-4 w-4" />
                        Eccedenze
                        <HelpTip
                            title="Eccedenze"
                            description="Per materiale di scarto/eccedenza: si registra in peso (kg) invece che a pezzi o quantità, è sempre un movimento fittizio e aggiunge automaticamente una nota legale sul deposito temporaneo."
                        />
                    </TabsTrigger>
                    <TabsTrigger
                        value="transfer"
                        className="data-[state=active]:bg-teal-100 data-[state=active]:text-teal-800"
                    >
                        <Repeat className="mr-2 h-4 w-4" />
                        Trasferimento
                        <HelpTip
                            title="Trasferimento Magazzino"
                            description="Formalità documentale per allineare uno spostamento tra magazzini: stessa ricerca materiali dell'Uscita, ma le righe sono sempre fittizie e non modificano lo stock. Il rientro è sempre nello stesso magazzino."
                        />
                    </TabsTrigger>
                </TabsList>

                <div className="space-y-6">
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
                        selectedWarehouseId={form.selectedWarehouseId}
                        onWarehouseSelect={form.handleWarehouseSelect}
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
                        onPurchaseItemsImport={form.handlePurchaseItemsImport}
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
            </Tabs>
        </div>
    );
}
