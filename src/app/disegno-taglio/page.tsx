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
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center">
                        Progetti di Disegno e Taglio
                    </h2>
                    <div className="flex items-center space-x-2">
                        <Link href="/disegno-taglio/new">
                            <Button className="font-medium shadow-sm transition-all focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background w-full sm:w-auto">
                                <Plus className="mr-2 h-4 w-4" />
                                Nuovo Progetto
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Search Bar - Responsive */}
                <div className="w-full">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <Input
                            type="text"
                            placeholder="Cerca Progetto di Taglio (Nome, Commessa...)"
                            className="w-full pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-all rounded-lg shadow-sm"
                        />
                    </div>
                </div>

                {/* Grid Card View - Mobile Responsive */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
                    {mockProjects.map((project) => (
                        <div key={project.id} className="group flex flex-col items-start justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:bg-accent/50 hover:border-primary/50 relative overflow-hidden">
                            <div className="flex items-center justify-between w-full mb-3">
                                <div className="text-xs font-medium text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                                    {project.jobCode}
                                </div>
                                <div className={`text-xs font-semibold px-2 py-1 rounded-full ${project.status === 'In corso' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                                    {project.status}
                                </div>
                            </div>

                            <h3 className="font-semibold text-lg leading-tight text-foreground mb-2 truncate w-full" title={project.name}>
                                {project.name}
                            </h3>

                            <div className="flex items-center text-sm text-muted-foreground mb-6">
                                <FolderOpen className="mr-2 h-4 w-4" />
                                <span>Taglio Calciosilicato</span>
                            </div>

                            <div className="w-full pt-4 border-t border-border flex items-center justify-between mt-auto">
                                <span className="text-xs text-muted-foreground">{project.date}</span>
                                <div className="flex gap-2">
                                    <Link href={`/disegno-taglio/${project.id}`}>
                                        <Button variant="ghost" size="sm" className="h-8 text-primary hover:bg-primary/10">
                                            Apri Editor
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    ))}

                    {mockProjects.length === 0 && (
                        <div className="col-span-full py-12 text-center border-2 border-dashed border-border rounded-xl bg-card">
                            <p className="text-muted-foreground">Nessun progetto di taglio trovato.</p>
                            <p className="text-sm text-muted-foreground mt-1">Crea un nuovo progetto per iniziare a tracciare.</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
