import { createClient } from "@/lib/supabase/server";
import { mapDbToWorker } from "@/lib/api";
import RettificaClient from "@/components/attendance/RettificaClient";

export const metadata = {
    title: "Rettifica Ore | Magazzino",
};

export default async function RettificaPage() {
    const supabase = await createClient();

    const { data: workersData } = await supabase
        .from('workers')
        .select('*')
        .eq('is_active', true)
        .order('last_name');

    const workers = (workersData || []).map(mapDbToWorker);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Rettifica Ore</h1>
            </div>
            <RettificaClient initialWorkers={workers} />
        </div>
    );
}
