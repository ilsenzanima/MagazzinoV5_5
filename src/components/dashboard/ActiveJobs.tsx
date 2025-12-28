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

interface ActiveJobsWidgetProps {
  stats: JobStats;
}

export function ActiveJobsWidget({ stats }: ActiveJobsWidgetProps) {
  // Use passed stats or defaults
  const currentStats = stats || { active: 0, completed: 0, suspended: 0, total: 0 };

  const data = [
    { name: 'Attive', value: currentStats.active },
    { name: 'Completate', value: currentStats.completed },
    { name: 'Sospese', value: currentStats.suspended },
  ];

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
              <span className="font-bold text-slate-900">{currentStats.active}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-slate-600">Completate</span>
              </div>
              <span className="font-bold text-slate-900">{currentStats.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-amber-500" />
                <span className="text-sm text-slate-600">Sospese</span>
              </div>
              <span className="font-bold text-slate-900">{currentStats.suspended}</span>
            </div>
          </div>

          <div className="h-[120px] w-[120px] min-w-[120px]">
            {currentStats.total > 0 ? (
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
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-slate-400">
                N/A
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
