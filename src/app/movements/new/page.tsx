import { createClient } from '@/lib/supabase/server';
import { mapDbItemToInventoryItem, mapDbToJob } from '@/lib/api';
import DashboardLayout from "@/components/layout/DashboardLayout";
import NewMovementContent from '@/components/movements/NewMovementContent';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { BlockBrowserBack } from "@/components/BlockBrowserBack";

function NewMovementSkeleton() {
    return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Caricamento modulo...</p>
        </div>
    );
}

export default async function NewMovementPage() {
    const supabase = await createClient();

    // Fetch initial inventory (limit 50)
    const { data: inventoryData } = await supabase
        .from('inventory')
        .select('*')
        .is('deleted_at', null) // gli admin vedono anche gli eliminati: non vanno proposti
        .order('code', { ascending: true })
        .limit(50);

    const initialInventory = inventoryData ? inventoryData.map(mapDbItemToInventoryItem) : [];

    // Fetch initial jobs (limit 50, active)
    const { data: jobsData } = await supabase
        .from('jobs')
        .select('*, clients(*)')
        .eq('status', 'active')
        .order('on_site', { ascending: false })
        .order('code', { ascending: false })
        .limit(50);

    const initialJobs = jobsData ? jobsData.map(mapDbToJob) : [];

    return (
        <DashboardLayout>
            <BlockBrowserBack />
            <Suspense fallback={<NewMovementSkeleton />}>
                <NewMovementContent 
                    initialInventory={initialInventory} 
                    initialJobs={initialJobs} 
                />
            </Suspense>
        </DashboardLayout>
    );
}
