import { Suspense } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SitesContent from "@/components/sites/SitesContent";
import { Loader2 } from "lucide-react";

export default function SitesPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-500">Caricamento...</span>
        </div>
      }>
        <SitesContent />
      </Suspense>
    </DashboardLayout>
  );
}
