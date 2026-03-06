import DashboardLayout from "@/components/layout/DashboardLayout";
import { Plus, Search, FolderOpen, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export const metadata = {
    title: "Disegno e Taglio | Magazzino V5.5",
    description: "Dashboard per la gestione dei progetti di taglio calciosilicato",
};

export default function DisegnoTaglioDashboard() {
    // TODO: Dati placeholder in attesa del backend
    const mockProjects = [
        {
            id: "demo",
            name: "APT Gorizia - Taglio Canala Principale",
            status: "In corso",
            date: "06/03/2026",
            jobCode: "2026-03-APT"
        },
        {
            id: "demo-2",
            name: "Castello di Colloredo - Canala Piano 1",
            status: "Completato",
            date: "01/03/2026",
            jobCode: "2026-01-IXC"
        }
    ];

    return (
        <DashboardLayout>
            <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-100 flex items-center">
                        Progetti di Disegno e Taglio
                    </h2>
                    <div className="flex items-center space-x-2">
                        <Link href="/disegno-taglio/new">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                Nuovo Progetto
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Search Bar - Responsive */}
                <div className="w-full">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            type="text"
                            placeholder="Cerca Progetto di Taglio (Nome, Commessa...)"
                            className="w-full pl-9 bg-slate-800/80 border-slate-700 text-slate-200 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-all rounded-lg shadow-sm"
                        />
                    </div>
                </div>

                {/* Grid Card View - Mobile Responsive */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                    {mockProjects.map((project) => (
                        <div key={project.id} className="group flex flex-col items-start justify-between rounded-xl border border-slate-700/60 bg-slate-800/40 p-5 shadow-sm transition-all hover:bg-slate-800/80 hover:border-slate-600 relative overflow-hidden">
                            <div className="flex items-center justify-between w-full mb-3">
                                <div className="text-xs font-medium text-slate-400 font-mono bg-slate-900/50 px-2 py-1 rounded">
                                    {project.jobCode}
                                </div>
                                <div className={`text-xs font-semibold px-2 py-1 rounded-full ${project.status === 'In corso' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/30 text-slate-300'}`}>
                                    {project.status}
                                </div>
                            </div>

                            <h3 className="font-semibold text-lg leading-tight text-slate-200 mb-2 truncate w-full" title={project.name}>
                                {project.name}
                            </h3>

                            <div className="flex items-center text-sm text-slate-400 mb-6">
                                <FolderOpen className="mr-2 h-4 w-4" />
                                <span>Taglio Calciosilicato</span>
                            </div>

                            <div className="w-full pt-4 border-t border-slate-700/50 flex items-center justify-between mt-auto">
                                <span className="text-xs text-slate-500">{project.date}</span>
                                <div className="flex gap-2">
                                    <Link href={`/disegno-taglio/${project.id}`}>
                                        <Button variant="ghost" size="sm" className="h-8 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:text-blue-300">
                                            Apri Editor
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}

                    {mockProjects.length === 0 && (
                        <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/20">
                            <p className="text-slate-400">Nessun progetto di taglio trovato.</p>
                            <p className="text-sm text-slate-500 mt-1">Crea un nuovo progetto per iniziare a tracciare.</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
