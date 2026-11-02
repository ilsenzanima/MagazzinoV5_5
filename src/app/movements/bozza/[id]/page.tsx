import { createClient } from '@/lib/supabase/server';
import { mapDbItemToInventoryItem, mapDbToJob } from '@/lib/api';
import { mapDbToDraft } from '@/lib/services/delivery-note-drafts';
import DashboardLayout from "@/components/layout/DashboardLayout";
import NewMovementContent from '@/components/movements/NewMovementContent';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { BlockBrowserBack } from "@/components/BlockBrowserBack";

function DraftSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Caricamento bozza...</p>
        </div>
    );
}

export default async function DraftMovementPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();
    const { id } = await params;

    const { data: draftData, error } = await supabase
        .from('delivery_note_drafts')
        .select('*, jobs(code, description, site_address, job_name:name, client_id, clients(id, name))')
        .eq('id', id)
        .single();

    if (error || !draftData) {
        notFound();
    }

    const initialNote = mapDbToDraft(draftData);

    const { data: inventoryData } = await supabase
        .from('inventory')
        .select('*')
        .is('deleted_at', null)
        .order('code', { ascending: true })
        .limit(50);
    const initialInventory = inventoryData ? inventoryData.map(mapDbItemToInventoryItem) : [];

    const { data: jobsData } = await supabase
        .from('jobs')
        .select('*, clients(*)')
        .eq('status', 'active')
        .order('on_site', { ascending: false })
        .order('code', { ascending: false })
        .limit(50);
    const initialJobs = jobsData ? jobsData.map(mapDbToJob) : [];

    // La commessa della bozza deve essere tra quelle selezionabili, anche se non più attiva
    if (initialNote.jobId && !initialJobs.find(j => j.id === initialNote.jobId)) {
        const { data: linkedJob } = await supabase
            .from('jobs')
            .select('*, clients(*)')
            .eq('id', initialNote.jobId)
            .single();
        if (linkedJob) initialJobs.push(mapDbToJob(linkedJob));
    }

    return (
        <DashboardLayout>
            <BlockBrowserBack />
            <Suspense fallback={<DraftSkeleton />}>
                <NewMovementContent
                    initialNote={initialNote}
                    draftId={id}
                    initialInventory={initialInventory}
                    initialJobs={initialJobs}
                />
            </Suspense>
        </DashboardLayout>
    );
}
