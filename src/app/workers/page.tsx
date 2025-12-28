import { Suspense } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import WorkersContent from "./components/workers-content";
import { Loader2 } from "lucide-react";
import { workersApi, Worker } from "@/lib/api";

export const dynamic = 'force-dynamic';

export default async function WorkersPage() {
    let workers: Worker[] = [];
    try {
        workers = await workersApi.getAll();
    } catch (e) {
        console.error("Failed to fetch workers", e);
    }

    return (
        <DashboardLayout>
            <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
                <WorkersContent initialWorkers={workers} />
            </Suspense>
        </DashboardLayout>
    );
}
