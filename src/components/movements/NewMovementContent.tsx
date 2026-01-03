"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Save, Loader2, ArrowDownRight, ArrowUpRight, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { InventoryItem, Job } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { useMovementForm } from "@/hooks/useMovementForm";

// Sub-components
import { MovementHeader } from "./form/MovementHeader";
import { MovementJobSelector } from "./form/MovementJobSelector";
import { MovementLinesInput } from "./form/MovementLinesInput";
import { MovementLinesList } from "./form/MovementLinesList";
import { MovementFooter } from "./form/MovementFooter";
import { MovementJobInventory } from "./form/MovementJobInventory";

interface NewMovementContentProps {
    initialInventory: InventoryItem[];
    initialJobs: Job[];
}

export default function NewMovementContent({ initialInventory, initialJobs }: NewMovementContentProps) {
    const { userRole } = useAuth();

    const form = useMovementForm({ initialInventory, initialJobs });

    if (userRole === 'user') {
        return (
            <div className="flex flex-col items-center justify-center h-full py-20">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Accesso Negato</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Non hai i permessi necessari per creare nuovi movimenti.</p>
                <Link href="/movements">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Torna ai Movimenti
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 max-w-5xl mx-auto">
            {/* Header / Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Link href="/movements">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Nuovo Movimento</h1>
                </div>
                <Button onClick={form.handleSubmit} disabled={form.loading} className="bg-[#003366] hover:bg-[#002244]">
                    {form.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Salva Documento
                </Button>
            </div>

            {/* Tabs - Type Selection */}
            <Tabs value={form.activeTab} onValueChange={(v: any) => form.setActiveTab(v)} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="entry" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800">
                        <ArrowDownRight className="mr-2 h-4 w-4" />
                        Entrata / Reso
                    </TabsTrigger>
                    <TabsTrigger value="exit" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
                        <ArrowUpRight className="mr-2 h-4 w-4" />
                        Uscita
                    </TabsTrigger>
                    <TabsTrigger value="sale" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">
                        <ShoppingBag className="mr-2 h-4 w-4" />
                        Vendita
                    </TabsTrigger>
                </TabsList>

                {/* Main Form */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Header Info */}
                    <div className="lg:col-span-2 space-y-6">

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

                        {/* Entry Mode: Return from Job Specifics */}
                        {form.activeTab === 'entry' && form.selectedJob && (
                            <MovementJobInventory
                                jobBatchAvailability={form.jobBatchAvailability}
                                onSelectBatch={form.handleSelectReturnBatch}
                            />
                        )}

                        <MovementLinesInput
                            currentLine={form.currentLine}
                            setCurrentLine={form.setCurrentLine}
                            selectedItem={form.selectedItemForLine}
                            onItemSelect={form.handleItemSelect}
                            onAddLine={form.handleAddLine}
                            availableBatches={form.availableBatches}
                            activeTab={form.activeTab}
                            isItemSelectorOpen={form.isItemSelectorOpen}
                            setIsItemSelectorOpen={form.setIsItemSelectorOpen}
                            inventory={form.inventory}
                            onItemSearch={form.handleItemSearch}
                            itemsLoading={form.itemsLoading}
                        />

                        {/* Lines List */}
                        <MovementLinesList
                            lines={form.lines}
                            onRemove={form.removeLine}
                        />

                        {/* Footer Fields */}
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
                            linesCount={form.lines.length}
                        />

                    </div>

                    {/* Right Column: Calculations / Summary (Optional - maybe move footer here later?) */}
                    {/* Currently empty or could have summaries. For now keeping structure as before where right column was part of grid but effectively empty or layout purposes? 
                       Wait, original had grid-cols-1 lg:grid-cols-3. 
                       Left column was lg:col-span-2. 
                       What was in the right column? 
                       Nothing! 
                       Ah check line 501: `grid grid-cols-1 lg:grid-cols-3 gap-6`.
                       Line 503: `lg:col-span-2 space-y-6`.
                       Then all cards were inside this div.
                       Where is the 3rd column?
                       It seems it was empty in the original code too? Or maybe I missed it.
                       Let's check the original file again if unsure. 
                       I will stick to the same layout.
                    */}
                    <div className="space-y-6">
                        {/* Potential place for Totals or Instructions */}
                        <div className="bg-slate-50 dark:bg-muted p-4 rounded-lg border dark:border-border text-sm text-slate-500 dark:text-slate-400">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Riepilogo</h4>
                            <p>Righe inserite: {form.lines.length}</p>
                            <p>Pezzi totali: {form.lines.reduce((acc, l) => acc + (l.pieces || 0), 0)}</p>
                            <p>Quantità totale: {form.lines.reduce((acc, l) => acc + l.quantity, 0)}</p>
                        </div>
                    </div>
                </div>
            </Tabs>
        </div>
    );
}
