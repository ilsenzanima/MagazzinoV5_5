import { Suspense } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import JobsContent from "@/components/jobs/JobsContent";
import { Loader2 } from "lucide-react";
import { jobsApi, Job } from "@/lib/api";

export default async function JobsPage(
  { searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }
) {
  const params = await searchParams;
  const clientId = params.clientId as string | undefined;
  const page = Number(params.page) || 1;

  let initialJobs: Job[] = [];
  let initialTotal = 0;

  try {
    const { data, total } = await jobsApi.getPaginated({
      page,
      limit: 12,
      clientId: clientId || ''
    });
    initialJobs = data;
    initialTotal = total;
  } catch (error) {
    console.error("Error loading jobs:", error);
  }

  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500">Caricamento commesse...</span>
        </div>
      }>
        <JobsContent
          initialJobs={initialJobs}
          initialTotal={initialTotal}
        />
      </Suspense>
    </DashboardLayout>
  );
}
