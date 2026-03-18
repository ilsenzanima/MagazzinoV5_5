"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    Box, 
    Ruler, 
    Scissors, 
    ChevronRight, 
    Info, 
    Calendar, 
    Hash, 
    LayoutTemplate,
    Map,
    ArrowLeft
} from "lucide-react";
import Link from "next/link";
import type { DuctProject } from "@/lib/cutting-simulator/project-model";

interface ProjectInfoViewProps {
    project: DuctProject;
    projectId: string;
}

export function ProjectInfoView({ project, projectId }: ProjectInfoViewProps) {
    const totalLength = project.segments.reduce((acc, s) => acc + (s.type === 'straight' ? s.length : 0), 0);
    const pieceCount = project.segments.length;
    const cutCount = project.cutMarks?.length || 0;

    return (
        <div className="flex flex-col h-full bg-slate-50/50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/disegno-taglio">
                        <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-500 hover:bg-slate-100">
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-blue-200">
                                Progetto Taglio
                            </span>
                            {project.jobCode && (
                                <span className="text-slate-400 text-xs font-mono">#{project.jobCode}</span>
                            )}
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">
                            {project.name}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link href={`/disegno-taglio/${projectId}/misure`}>
                        <Button variant="outline" className="h-11 px-6 font-bold text-slate-700 bg-white border-slate-200">
                            <Ruler className="mr-2 h-5 w-5 text-blue-500" />
                            Rileva Misure
                        </Button>
                    </Link>
                    <Link href={`/disegno-taglio/${projectId}/editor`}>
                        <Button className="h-11 px-6 font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-lg">
                            <Box className="mr-2 h-5 w-5 text-blue-400" />
                            Apri Editor 3D
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8">
                <div className="max-w-6xl mx-auto space-y-8">
                    
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                            { label: "Sviluppo Totale", value: `${(totalLength / 1000).toFixed(2)} m`, icon: Map, color: "text-blue-600", bg: "bg-blue-50" },
                            { label: "Segmenti Rilevati", value: pieceCount, icon: Hash, color: "text-amber-600", bg: "bg-amber-50" },
                            { label: "Tagli Programmati", value: cutCount, icon: Scissors, color: "text-rose-600", bg: "bg-rose-50" },
                            { label: "Materiale", value: `${project.section.thickness} mm`, icon: LayoutTemplate, color: "text-emerald-600", bg: "bg-emerald-50" }
                        ].map((stat, i) => (
                            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] uppercase font-black tracking-wider text-slate-400 mb-1">{stat.label}</p>
                                    <p className="text-2xl font-black text-slate-900">{stat.value}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                    <stat.icon className="h-6 w-6" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* List of segments */}
                        <Card className="lg:col-span-2 border-slate-200 shadow-sm rounded-2xl overflow-hidden">
                            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <ListIcon className="h-5 w-5 text-slate-400" />
                                    Elenco Segmenti del Tracciato
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-slate-100">
                                    {project.segments.map((s, idx) => (
                                        <div key={s.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:bg-slate-200 transition-colors">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900 leading-none">
                                                        {s.type === 'straight' ? 'Tratto Dritto' : s.type === 'elbow90' ? 'Gomito 90°' : s.type}
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1 capitalize">
                                                        {s.type === 'straight' ? `${s.length} mm` : s.type === 'elbow90' ? `Direzione: ${s.direction}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-all group-hover:translate-x-1" />
                                        </div>
                                    ))}
                                    {project.segments.length === 0 && (
                                        <div className="p-12 text-center">
                                            <Box className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                            <p className="text-slate-400 font-medium">Nessun segmento rilevato nel progetto.</p>
                                            <p className="text-xs text-slate-300 mt-1">Apri l'editor per iniziare a disegnare il tracciato.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent Activity or Quick Docs */}
                        <div className="space-y-6">
                            <Card className="border-slate-200 shadow-sm rounded-2xl">
                                <CardHeader>
                                    <CardTitle className="text-base font-bold text-slate-800">Note Progetto</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-slate-600 leading-relaxed">
                                    {project.description || "Nessuna descrizione aggiunta a questo progetto."}
                                </CardContent>
                            </Card>

                            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                                <h4 className="font-bold text-white mb-2 relative z-10 flex items-center gap-2">
                                    <Info className="h-4 w-4 text-blue-400" /> Supporto Tecnico
                                </h4>
                                <p className="text-slate-400 text-xs mb-4 relative z-10">
                                    Puoi caricare la piantina (Blueprint) direttamente dall'editor 3D per usarla come guida nel posizionamento.
                                </p>
                                <Button className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs border-slate-700">
                                    Guida all'uso
                                </Button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function ListIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <line x1="3" y1="6" x2="3.01" y2="6"></line>
            <line x1="3" y1="12" x2="3.01" y2="12"></line>
            <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
    )
}
