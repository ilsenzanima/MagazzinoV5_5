"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Package, 
  ClipboardList, 
  AlertTriangle, 
  Plus, 
  Zap,
  User
} from "lucide-react";
import Link from "next/link";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Dati mock per i grafici
const stockData = [
  { name: '1', value: 40 },
  { name: '6', value: 60 },
  { name: '14', value: 45 },
  { name: '23', value: 90 },
  { name: '30', value: 75 },
];

const orderStatusData = [
  { name: 'Completati', value: 65, color: '#3b82f6' }, // blue-500
  { name: 'In Elaborazione', value: 25, color: '#94a3b8' }, // slate-400
  { name: 'In Attesa', value: 10, color: '#f59e0b' }, // amber-500
];

import DashboardLayout from "@/components/layout/DashboardLayout";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Bar (Mobile Hidden, Desktop Title) */}
        <div className="flex justify-between items-center mb-6">
           <h1 className="text-2xl font-bold text-slate-900 hidden md:block">Dashboard Principale</h1>
           <div className="flex items-center gap-4 ml-auto">
             <Avatar>
              <AvatarImage src="https://github.com/shadcn.png" />
              <AvatarFallback><User /></AvatarFallback>
            </Avatar>
           </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-3 gap-4 md:gap-6">
          <Card>
            <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <div className="text-slate-500 text-xs font-medium mb-1">Articoli in Stock</div>
              <div className="flex items-center gap-1">
                <Package className="h-4 w-4 text-slate-400" />
                <span className="text-xl font-bold text-slate-900">12,450</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
             <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <div className="text-slate-500 text-xs font-medium mb-1">Ordini Sospesi</div>
               <div className="flex items-center gap-1">
                <ClipboardList className="h-4 w-4 text-slate-400" />
                <span className="text-xl font-bold text-slate-900">45</span>
              </div>
            </CardContent>
          </Card>

          <Card>
             <CardContent className="p-3 flex flex-col items-center justify-center text-center">
              <div className="text-slate-500 text-xs font-medium mb-1">Avvisi Urgenti</div>
               <div className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-xl font-bold text-slate-900">3</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stock Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Andamento Scorte (30gg)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] min-h-[200px] min-w-0 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stockData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#3b82f6" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Orders Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Stato Ordini</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] min-h-[200px] min-w-0 w-full flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Text */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Package className="h-8 w-8 text-slate-300" />
                </div>
              </div>
              <div className="flex justify-center gap-3 text-xs mt-2">
                {orderStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}}></div>
                    <span className="text-slate-600">{item.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Azioni Rapide</h2>
          <div className="grid grid-cols-2 gap-4">
            <Button className="h-14 text-lg bg-blue-600 hover:bg-blue-700 shadow-md">
              <Plus className="mr-2 h-5 w-5" /> Nuovo Ordine
            </Button>
            <Link href="/inventory" className="block w-full">
              <Button variant="secondary" className="w-full h-14 text-lg shadow-sm bg-slate-200 hover:bg-slate-300 text-slate-800">
                <Zap className="mr-2 h-5 w-5" /> Inventario Rapido
              </Button>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
           <h2 className="text-lg font-bold text-slate-900 mb-3">Attività Recenti</h2>
           <Card>
             <CardContent className="p-0">
                {[
                  { title: "Ordine #12345 completato", time: "10:30 AM", type: "order" },
                  { title: "Avviso: Scorta bassa Articolo A", time: "Ieri", type: "alert" },
                  { title: "Avviso: #12345 completamole", time: "9:10 AM", type: "info" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 border-b last:border-0 hover:bg-slate-50 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${item.type === 'alert' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                      <span className="text-sm font-medium text-slate-700">{item.title}</span>
                    </div>
                    <span className="text-xs text-slate-400">{item.time}</span>
                  </div>
                ))}
             </CardContent>
           </Card>
        </div>

      </div>
    </DashboardLayout>
  );
}
