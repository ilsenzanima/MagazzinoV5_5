import { createClient } from "@/lib/supabase/server";
import AttendanceClient from "@/components/attendance/AttendanceClient";
import { mapDbToWorker, mapDbToJob } from "@/lib/api";

export const metadata = {
    title: "Presenze / Assenze | Magazzino",
};

export default async function AttendancePage() {
    const supabase = await createClient();

    // Fetch Active Workers and Jobs in PARALLEL for better performance
    const [workersResult, jobsResult] = await Promise.all([
        supabase
            .from('workers')
            .select('*')
            .eq('is_active', true)
            .order('last_name'),
        supabase
            .from('jobs')
            .select('*, clients(name, street, city)')
            .eq('status', 'active')
            .is('deleted_at', null)
            .order('code')
    ]);

    const workers = (workersResult.data || []).map(mapDbToWorker);
    const jobs = (jobsResult.data || []).map(mapDbToJob);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Presenze / Assenze</h1>
            </div>

            <AttendanceClient
                initialWorkers={workers}
                initialJobs={jobs}
            />
        </div>
    );
}
