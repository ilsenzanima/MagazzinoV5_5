import { Suspense } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import JobsContent from "@/components/jobs/JobsContent";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { mapDbToJob } from "@/lib/api";

export default async function JobsPage(
  { searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }
) {
  const supabase = await createClient();
  const params = await searchParams;
  const clientId = params.clientId as string | undefined;

  let query = supabase
    .from('jobs')
    .select('*, clients(name, street, street_number, city, province)')
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data: dbJobs, error } = await query;

  if (error) {
    console.error("Error loading jobs:", error);
  }

  const initialJobs = dbJobs ? dbJobs.map(mapDbToJob) : [];

  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-500">Caricamento...</span>
        </div>
      }>
        <JobsContent initialJobs={initialJobs} />
      </Suspense>
    </DashboardLayout>
  );
}
