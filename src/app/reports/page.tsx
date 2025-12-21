"use client"

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function ReportsPage() {
  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Report</h1>
          <p className="text-slate-500">Analisi e statistiche del magazzino.</p>
        </div>
        
        <Card className="border-dashed">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-slate-100 p-3 rounded-full w-fit mb-4">
              <BarChart3 className="h-6 w-6 text-slate-500" />
            </div>
            <CardTitle>Modulo in Sviluppo</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-slate-500 pb-8">
            <p>La sezione reportistica avanzata sarà disponibile a breve.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
