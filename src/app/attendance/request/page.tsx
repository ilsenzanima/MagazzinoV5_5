
import { createClient } from "@/lib/supabase/server";
import { LeaveRequestManager } from "@/components/attendance/LeaveRequestManager";
import { mapDbToWorker } from "@/lib/api";

export const metadata = {
    title: "Richiesta Permesso | Magazzino",
};

export default async function RequestPage() {
    const supabase = await createClient();

    // Fetch Workers
    const { data: workersData } = await supabase
        .from('workers')
        .select('*')
        .eq('is_active', true)
        .order('last_name');

    const workers = (workersData || []).map(mapDbToWorker);

    // Fetch existing requests
    const { data: requestsData } = await supabase
        .from('leave_requests')
        .select('*, workers(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(50);

    const requests = (requestsData || []).map((item: any) => ({
        ...item,
        worker: item.workers
    }));

    return (
        <div className="container mx-auto py-6 max-w-5xl">
            <LeaveRequestManager
                workers={workers}
                initialRequests={requests}
            />
        </div>
    );
}
