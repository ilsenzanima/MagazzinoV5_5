"use client"

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

const data = [
  { name: 'Lug', presenze: 120, ferie: 20, malattia: 5 },
  { name: 'Ago', presenze: 90, ferie: 80, malattia: 2 },
  { name: 'Set', presenze: 150, ferie: 10, malattia: 8 },
  { name: 'Ott', presenze: 160, ferie: 5, malattia: 12 },
  { name: 'Nov', presenze: 155, ferie: 2, malattia: 15 },
  { name: 'Dic', presenze: 140, ferie: 15, malattia: 10 },
];

export function AttendanceChart() {
  return (
    <Card className="w-full h-[400px]">
      <CardHeader>
        <CardTitle>Presenze Semestrali per Commessa (Mock)</CardTitle>
      </CardHeader>
      <CardContent className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
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
            <Bar dataKey="ferie" name="Ferie" fill="#f59e0b" stackId="a" />
            <Bar dataKey="malattia" name="Malattia" fill="#ef4444" stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
