import { Suspense } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import JobsContent from "@/components/jobs/JobsContent";
import { Loader2 } from "lucide-react";

export default function JobsPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-500">Caricamento...</span>
        </div>
      }>
        <JobsContent />
      </Suspense>
    </DashboardLayout>
  );
}
