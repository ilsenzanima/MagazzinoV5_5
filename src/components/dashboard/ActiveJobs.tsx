"use client"

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { fetchWithTimeout } from "@/lib/api";
import { Briefcase, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface JobStats {
  active: number;
  completed: number;
  suspended: number;
  total: number;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b']; // blue, green, amber

export function ActiveJobsWidget() {
  const [stats, setStats] = useState<JobStats>({ active: 0, completed: 0, suspended: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await fetchWithTimeout(
          supabase
            .from('jobs')
            .select('status')
        );

        if (!error && data) {
          const newStats = data.reduce((acc, job) => {
            acc[job.status as keyof Omit<JobStats, 'total'>] = (acc[job.status as keyof Omit<JobStats, 'total'>] || 0) + 1;
            return acc;
          }, { active: 0, completed: 0, suspended: 0 } as Omit<JobStats, 'total'>);
          
          setStats({
            ...newStats,
            total: data.length
          });
        }
      } catch (error) {
        console.error("Error fetching job stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const data = [
    { name: 'Attive', value: stats.active },
    { name: 'Completate', value: stats.completed },
    { name: 'Sospese', value: stats.suspended },
  ];

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Stato Commesse</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center animate-pulse bg-slate-50 rounded-lg">
            <div className="h-32 w-32 bg-slate-200 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-medium">Stato Commesse</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-4 w-full sm:w-1/2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-sm text-slate-600">Attive</span>
                    </div>
                    <span className="font-bold text-slate-900">{stats.active}</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-sm text-slate-600">Completate</span>
                    </div>
                    <span className="font-bold text-slate-900">{stats.completed}</span>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-sm text-slate-600">Sospese</span>
                    </div>
                    <span className="font-bold text-slate-900">{stats.suspended}</span>
                </div>
            </div>
            
            <div className="h-[120px] w-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    paddingAngle={2}
                    dataKey="value"
                    >
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                    <Tooltip />
                </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
