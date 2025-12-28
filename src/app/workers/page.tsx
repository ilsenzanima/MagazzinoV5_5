import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import DashboardLayout from "@/components/layout/DashboardLayout";
import WorkersContent from "./components/workers-content";
import { Loader2, AlertCircle } from "lucide-react";
import { Worker, mapDbToWorker } from "@/lib/api";

export const dynamic = 'force-dynamic';

export default async function WorkersPage() {
    const supabase = await createClient();
    let workers: Worker[] = [];
    let error: string | null = null;

    try {
        const { data, error: apiError } = await supabase
            .from('workers')
            .select('*')
            .order('last_name', { ascending: true });

        if (apiError) throw apiError;
        workers = (data || []).map(mapDbToWorker);
    } catch (e: any) {
        console.error("Failed to fetch workers", e);
        error = e.message || "Impossibile recuperare la lista degli operai.";
    }

    return (
        <DashboardLayout>
            <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
                {error ? (
                    <div className="flex flex-col items-center justify-center p-8 text-red-500">
                        <AlertCircle className="h-8 w-8 mb-2" />
                        <p className="font-semibold">Errore</p>
                        <p>{error}</p>
                    </div>
                ) : (
                    <WorkersContent initialWorkers={workers} />
                )}
            </Suspense>
        </DashboardLayout>
    );
}
