"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    Box, 
    Ruler, 
    Scissors, 
    ChevronRight, 
    Info, 
    Hash, 
    LayoutTemplate,
    Map,
    ArrowLeft,
    List
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
        <div className="flex flex-col h-full bg-muted/30">
            {/* Header */}
            <div className="bg-background border-b px-6 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Link href="/disegno-taglio">
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">
                                Progetto Taglio
                            </span>
                            {project.jobCode && (
                                <span className="text-muted-foreground text-xs font-mono">#{project.jobCode}</span>
                            )}
                        </div>
                        <h1 className="text-2xl font-black text-foreground tracking-tight leading-none uppercase">
                            {project.name}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link href={`/disegno-taglio/${projectId}/misure`}>
                        <Button variant="outline" className="h-10 px-5 font-bold">
                            <Ruler className="mr-2 h-4 w-4 text-primary" />
                            Rileva Misure
                        </Button>
                    </Link>
                    <Link href={`/disegno-taglio/${projectId}/editor`}>
                        <Button className="h-10 px-5 font-bold">
                            <Box className="mr-2 h-4 w-4" />
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
                            { label: "Sviluppo Totale", value: `${(totalLength / 1000).toFixed(2)} m`, icon: Map, color: "text-blue-500", bg: "bg-blue-500/10" },
                            { label: "Segmenti Rilevati", value: pieceCount, icon: Hash, color: "text-amber-500", bg: "bg-amber-500/10" },
                            { label: "Tagli Programmati", value: cutCount, icon: Scissors, color: "text-rose-500", bg: "bg-rose-500/10" },
                            { label: "Materiale", value: `${project.section.thickness} mm`, icon: LayoutTemplate, color: "text-emerald-500", bg: "bg-emerald-500/10" }
                        ].map((stat, i) => (
                            <div key={i} className="bg-background p-5 rounded-2xl border shadow-sm flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] uppercase font-black tracking-wider text-muted-foreground mb-1">{stat.label}</p>
                                    <p className="text-2xl font-black text-foreground">{stat.value}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                                    <stat.icon className="h-6 w-6" />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* List of segments */}
                        <Card className="lg:col-span-2 shadow-sm rounded-2xl overflow-hidden">
                            <CardHeader className="bg-muted/30 border-b">
                                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                                    <List className="h-5 w-5 text-muted-foreground" />
                                    Elenco Segmenti del Tracciato
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y divide-border">
                                    {project.segments.map((s, idx) => (
                                        <div key={s.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:bg-muted/60 transition-colors">
                                                    {idx + 1}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-foreground leading-none">
                                                        {s.type === 'straight' ? 'Tratto Dritto' : s.type === 'elbow90' ? 'Gomito 90°' : s.type}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                                                        {s.type === 'straight' ? `${s.length} mm` : s.type === 'elbow90' ? `Direzione: ${s.direction}` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-all group-hover:translate-x-1" />
                                        </div>
                                    ))}
                                    {project.segments.length === 0 && (
                                        <div className="p-12 text-center">
                                            <Box className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                            <p className="text-muted-foreground font-medium">Nessun segmento rilevato nel progetto.</p>
                                            <p className="text-xs text-muted-foreground/60 mt-1">Apri l&apos;editor per iniziare a disegnare il tracciato.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Sidebar */}
                        <div className="space-y-6">
                            <Card className="shadow-sm rounded-2xl">
                                <CardHeader>
                                    <CardTitle className="text-base font-bold text-foreground">Note Progetto</CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground leading-relaxed">
                                    {project.description || "Nessuna descrizione aggiunta a questo progetto."}
                                </CardContent>
                            </Card>

                            <div className="bg-primary rounded-2xl p-6 text-primary-foreground relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                                <h4 className="font-bold mb-2 relative z-10 flex items-center gap-2 text-sm">
                                    <Info className="h-4 w-4 opacity-80" /> Supporto Tecnico
                                </h4>
                                <p className="text-primary-foreground/70 text-xs mb-4 relative z-10">
                                    Puoi caricare la piantina (Blueprint) direttamente dall&apos;editor 3D per usarla come guida nel posizionamento.
                                </p>
                                <Button variant="secondary" size="sm" className="w-full text-xs font-bold">
                                    Guida all&apos;uso
                                </Button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
