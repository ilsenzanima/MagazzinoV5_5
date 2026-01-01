"use client";

import { memo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { attendanceApi } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export const AttendanceChart = memo(function AttendanceChart() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        const stats = await attendanceApi.getAggregatedStats(6);
        setData(stats);
      } catch (error) {
        console.error("Error loading attendance stats:", error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <Card className="w-full h-[400px]">
      <CardHeader>
        <CardTitle>Presenze Semestrali</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px] min-h-[320px] min-w-[100px]">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex justify-center items-center h-full text-slate-500">
            Nessun dato disponibile
          </div>
        ) : (
          <ResponsiveContainer width="99%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="presenze" name="Presenze" fill="#3b82f6" stackId="a" />
              <Bar dataKey="ferie" name="Ferie/Permessi" fill="#f59e0b" stackId="a" />
              <Bar dataKey="malattia" name="Malattia" fill="#ef4444" stackId="a" />
              <Bar dataKey="corso" name="Corso" fill="#8b5cf6" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
});

