import { createClient } from "@/lib/supabase/server";
import AttendanceClient from "@/components/attendance/AttendanceClient";
import { mapDbToWorker, mapDbToJob } from "@/lib/api";

export const metadata = {
    title: "Presenze / Assenze | Magazzino",
};

export default async function AttendancePage() {
    const supabase = await createClient();

    // Fetch Active Workers
    const { data: workersData } = await supabase
        .from('workers')
        .select('*')
        .eq('is_active', true)
        .order('last_name');

    // Fetch Active Jobs (Commesse)
    const { data: jobsData } = await supabase
        .from('jobs')
        .select('*, clients(name, street, city)')
        .eq('status', 'active')
        .order('code');

    const workers = (workersData || []).map(mapDbToWorker);
    const jobs = (jobsData || []).map(mapDbToJob);

    return (
        <div className="container mx-auto py-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Presenze / Assenze</h1>
            </div>

            <AttendanceClient
                initialWorkers={workers}
                initialJobs={jobs}
            />
        </div>
    );
}
