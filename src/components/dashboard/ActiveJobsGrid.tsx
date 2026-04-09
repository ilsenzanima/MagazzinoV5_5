import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Briefcase, MapPin, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Job {
  id: string;
  code: string;
  name: string;
  status: string;
  site_address: string | null;
  clients: { name: string } | null;
}

interface ActiveJobsGridProps {
  jobs: Job[];
}

export function ActiveJobsGrid({ jobs }: ActiveJobsGridProps) {
  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-500" />
            Commesse Attive
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
            Nessuna commessa attiva
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-blue-500" />
            Commesse Attive
            <Badge
              variant="outline"
              className="ml-1 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
            >
              {jobs.length}
            </Badge>
          </CardTitle>
          <Link
            href="/jobs"
            className="text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-0.5 transition-colors"
          >
            Tutte <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
          {jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`}>
              <div className="group flex flex-col gap-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer">
                {/* Code + status */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                    {job.code}
                  </span>
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                </div>

                {/* Job name */}
                <p
                  className="text-sm font-medium text-slate-900 dark:text-white leading-snug line-clamp-2"
                  title={job.name}
                >
                  {job.name}
                </p>

                {/* Client */}
                {job.clients?.name && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {job.clients.name}
                  </p>
                )}

                {/* Address */}
                {job.site_address && (
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 truncate mt-auto">
                    <MapPin className="h-2.5 w-2.5 shrink-0" />
                    {job.site_address}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
