import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, Ruler, MousePointerClick } from "lucide-react";
import type { DuctProject } from "@/lib/cutting-simulator/project-model";

interface ProjectFormProps {
    project: DuctProject;
    onProjectChange: React.Dispatch<React.SetStateAction<DuctProject>>;
    isRoutingMode?: boolean;
}

export function ProjectForm({ project, onProjectChange, isRoutingMode }: ProjectFormProps) {
    const [subStep, setSubStep] = useState<"A" | "B">("A");

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500">
                Costruzione Impianto: Test UI
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
                Valuta le due opzioni di form in cantiere e decidi quale approccio preferisci per il rilievo dei tratti.
            </p>

            <Tabs value={subStep} onValueChange={(val) => setSubStep(val as "A" | "B")}>
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="A" className="gap-2"><Ruler className="h-4 w-4" /> Opzione A (Tabellare)</TabsTrigger>
                    <TabsTrigger value="B" className="gap-2"><MousePointerClick className="h-4 w-4" /> Opzione B (Wizard Visuale)</TabsTrigger>
                </TabsList>

                {/* ---------- OPZIONE A: TABELLA ---------- */}
                <TabsContent value="A">
                    <Card>
                        <CardContent className="pt-6 space-y-4">
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                📝 Stile Excel Rapido
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Veloce da scrivere tramite tastiera/tablet se hai i dati pronti in sequenza.
                            </p>

                            {/* Dati Finti per Mostrare L'idea */}
                            <div className="space-y-2">
                                {/* Intestazione tabella */}
                                <div className="grid grid-cols-[auto_1fr_120px_120px_auto] gap-2 items-center px-3 py-2 bg-slate-100 rounded-md text-xs font-semibold uppercase tracking-wider text-slate-500 overflow-hidden">
                                    <div className="w-6 text-center">#</div>
                                    <div>Tipologia</div>
                                    <div>Misura A (mm)</div>
                                    <div>Misura B / Note</div>
                                    <div className="w-8"></div>
                                </div>

                                {/* Riga 1 */}
                                <div className="grid grid-cols-[auto_1fr_120px_120px_auto] gap-2 items-center p-2 border border-slate-200 rounded-md hover:bg-slate-50">
                                    <div className="w-6 text-center text-sm text-slate-400">1</div>
                                    <Input defaultValue="Tratto Dritto" className="h-9" />
                                    <Input defaultValue="3000" type="number" className="h-9 font-mono" />
                                    <Input placeholder="Es: muro..." className="h-9" />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"><XIcon /></Button>
                                </div>

                                {/* Riga 2 */}
                                <div className="grid grid-cols-[auto_1fr_120px_120px_auto] gap-2 items-center p-2 border border-slate-200 rounded-md hover:bg-slate-50">
                                    <div className="w-6 text-center text-sm text-slate-400">2</div>
                                    <Input defaultValue="Curva 90" className="h-9" />
                                    <Input defaultValue="200" type="number" className="h-9 font-mono" />
                                    <Input defaultValue="Destra" className="h-9" />
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"><XIcon /></Button>
                                </div>
                            </div>

                            <Button variant="outline" className="w-full gap-2 border-dashed border-2 py-6 text-slate-500 hover:text-slate-800">
                                <Plus className="h-5 w-5" /> Aggiungi Riga
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ---------- OPZIONE B: WIZARD ---------- */}
                <TabsContent value="B">
                    <Card>
                        <CardContent className="pt-6 space-y-6">
                            <h3 className="font-semibold mb-2 flex items-center gap-2">
                                👆 Stile Touch Wizard
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Grandi bottoni touch e schede isolate per facilitare l'uso sul posto.
                            </p>

                            {/* Pulsantiera di Aggiunta Rapida */}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <Button className="h-16 flex flex-col items-center justify-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border-none">
                                    <Plus className="h-5 w-5" />
                                    <span className="text-xs font-semibold">Dritto</span>
                                </Button>
                                <Button className="h-16 flex flex-col items-center justify-center gap-1 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 border-none">
                                    <Plus className="h-5 w-5" />
                                    <span className="text-xs font-semibold">Curva</span>
                                </Button>
                                <Button className="h-16 flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-800 border-none">
                                    <Plus className="h-5 w-5" />
                                    <span className="text-xs font-semibold">Ostacolo</span>
                                </Button>
                                <Button className="h-16 flex flex-col items-center justify-center gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 border-none">
                                    <Plus className="h-5 w-5" />
                                    <span className="text-xs font-semibold">Terminale</span>
                                </Button>
                            </div>

                            {/* Card dei Segmenti */}
                            <div className="space-y-4 mt-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">

                                {/* Item 1 */}
                                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-blue-100 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold">
                                        1
                                    </div>
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded border border-blue-200 shadow-sm shadow-blue-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="font-bold text-slate-800">Tratto Dritto</div>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500"><XIcon /></Button>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <Label className="text-xs text-slate-500">Lunghezza Totale (mm)</Label>
                                                <Input type="number" defaultValue="3000" className="mt-1 font-mono h-12 text-lg" />
                                            </div>
                                            <Button variant="secondary" size="sm" className="w-full text-xs">Aggiungi Proprietà (Muro/Ostacolo)</Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Item 2 */}
                                <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-amber-100 text-amber-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold">
                                        2
                                    </div>
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded border border-slate-200 shadow-sm opacity-60 hover:opacity-100 transition-opacity">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="font-bold text-slate-800">Curva 90°</div>
                                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500"><XIcon /></Button>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button variant="outline" className="h-10 border-blue-500 bg-blue-50 text-blue-700">Destra</Button>
                                                <Button variant="outline" className="h-10">Sinistra</Button>
                                                <Button variant="outline" className="h-10">Alto</Button>
                                                <Button variant="outline" className="h-10">Basso</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>

                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function XIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
    );
}
