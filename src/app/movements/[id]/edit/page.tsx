import { createClient } from '@/lib/supabase/server';
import { mapDbToDeliveryNote, mapDbItemToInventoryItem, mapDbToJob } from '@/lib/api';
import DashboardLayout from "@/components/layout/DashboardLayout";
import EditMovementContent from '@/components/movements/EditMovementContent';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { notFound } from 'next/navigation';

function EditMovementSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Caricamento dati movimento...</p>
        </div>
    );
}

export default async function EditMovementPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient();
    const { id } = await params;

    // Fetch Delivery Note with details
    const { data: noteData, error } = await supabase
        .from('delivery_notes')
        .select(`
            *,
            jobs(code, description, site_address),
            delivery_note_items(
              *,
              inventory(name, code, unit, brand, category, description, price, model),
              purchase_items(price)
            )
        `)
        .eq('id', id)
        .single();

    if (error || !noteData) {
        notFound();
    }

    const initialNote = mapDbToDeliveryNote(noteData);

    // Fetch initial inventory (limit 50)
    const { data: inventoryData } = await supabase
        .from('inventory')
        .select('*')
        .order('code', { ascending: true })
        .limit(50);

    const initialInventory = inventoryData ? inventoryData.map(mapDbItemToInventoryItem) : [];

    // Fetch initial jobs (limit 50, active)
    const { data: jobsData } = await supabase
        .from('jobs')
        .select('*, clients(*)')
        .eq('status', 'active')
        .order('code', { ascending: false })
        .limit(50);

    const initialJobs = jobsData ? jobsData.map(mapDbToJob) : [];

    // Ensure the job linked to the note is in the list, if not, fetch it
    if (initialNote.jobId && !initialJobs.find(j => j.id === initialNote.jobId)) {
        const { data: linkedJob } = await supabase
            .from('jobs')
            .select('*, clients(*)')
            .eq('id', initialNote.jobId)
            .single();
        
        if (linkedJob) {
            initialJobs.push(mapDbToJob(linkedJob));
        }
    }

    return (
        <DashboardLayout>
            <Suspense fallback={<EditMovementSkeleton />}>
                <EditMovementContent 
                    initialNote={initialNote}
                    initialInventory={initialInventory} 
                    initialJobs={initialJobs} 
                />
            </Suspense>
        </DashboardLayout>
    );
}
