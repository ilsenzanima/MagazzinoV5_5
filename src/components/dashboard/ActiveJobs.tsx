"use client"

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Link from "next/link";
import { Briefcase } from "lucide-react";

interface JobStats {
  active: number;
  completed: number;
  suspended: number;
  total: number;
}

interface ActiveJobHour {
  jobId: string;
  jobName: string;
  jobCode: string;
  totalHours: number;
}

interface ActiveJobsWidgetProps {
  stats: JobStats;
  activeJobHours: ActiveJobHour[];
}

export const ActiveJobsWidget = memo(function ActiveJobsWidget({ stats, activeJobHours = [] }: ActiveJobsWidgetProps) {
  // Use passed stats or defaults
  const currentStats = stats || { active: 0, completed: 0, suspended: 0, total: 0 };

  // Prepare data for the chart (Top 5 active jobs by hours)
  const chartData = activeJobHours.slice(0, 5).map(job => ({
    name: job.jobCode || job.jobName, // Use Code if available, else Name
    fullName: job.jobName,
    hours: job.totalHours,
    id: job.jobId
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-2 border border-slate-200 dark:border-slate-700 rounded shadow-sm text-xs">
          <p className="font-bold text-slate-900 dark:text-white mb-1">{payload[0].payload.fullName}</p>
          <p className="text-slate-600 dark:text-slate-400">
            Ore totali: <span className="font-semibold text-blue-600">{payload[0].value}h</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm font-medium">Stato Commesse</CardTitle>
          <div className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
              {currentStats.active} Attive
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Chart Section */}
        <div className="h-[180px] w-full min-h-[180px]">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                {/* <CartesianGrid strokeDasharray="3 3" horizontal={false} /> */}
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  width={60}
                  tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="hours" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#3b82f6" opacity={0.8 + (index * 0.05)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-2">
              <Briefcase className="h-8 w-8 opacity-20" />
              <span className="text-xs">Nessuna commessa attiva con ore registrate</span>
            </div>
          )}
        </div>

        {/* Shortcuts Section */}
        <div className="space-y-2 mt-auto">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold px-1">
            Accesso Rapido
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeJobHours.slice(0, 4).map((job) => (
              <Link href={`/jobs/${job.jobId}`} key={job.jobId} className="w-full">
                <div className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer group">
                  <div className="h-8 w-8 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-medium text-slate-900 dark:text-white truncate" title={job.jobName}>
                      {job.jobCode}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {job.jobName}
                    </p>
                  </div>
                  {/* <div className="ml-auto text-[10px] font-mono font-medium text-slate-400 group-hover:text-blue-600 transition-colors">
                    {job.totalHours}h
                  </div> */}
                </div>
              </Link>
            ))}
            {activeJobHours.length === 0 && (
              <div className="col-span-2 text-center py-2 text-xs text-slate-400">
                Nessuna commessa attiva
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
