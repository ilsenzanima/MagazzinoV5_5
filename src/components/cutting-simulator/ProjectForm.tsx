import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, Navigation, Settings2 } from "lucide-react";
import {
    DuctProject,
    RilievoCard,
    SegmentDirection,
    createCardDritto,
    createCardCurva,
    translateRilievoToSegments
} from "@/lib/cutting-simulator/project-model";

interface ProjectFormProps {
    project: DuctProject;
    onProjectChange: React.Dispatch<React.SetStateAction<DuctProject>>;
    isRoutingMode?: boolean;
}

export function ProjectForm({ project, onProjectChange, isRoutingMode }: ProjectFormProps) {
    // Stato locale per le card utente in cantiere
    const [cards, setCards] = useState<RilievoCard[]>([]);

    // Al mount o slegamento peschiamo le card.
    // In una V2 reale, `project.rilievoCards` manterrà la memoria, per ora
    // lavoriamo sullo state volatile del componente e generiamo i `segments` puri che
    // andranno al database.
    useEffect(() => {
        if (project.segments.length === 0 && cards.length > 0) {
            setCards([]);
        }
    }, [project.segments.length]);

    // Ogni volta che modifichiamo le Cards, aggiorniamo l'Editor 3D ("Segments")
    const updateProjectSegments = (newCards: RilievoCard[]) => {
        setCards(newCards);
        const newSegments = translateRilievoToSegments(newCards);
        onProjectChange(prev => ({ ...prev, segments: newSegments }));
    };

    const addDritto = () => {
        if (cards.length > 0 && cards[cards.length - 1].type === 'dritto') {
            const lastCard = cards[cards.length - 1];
            updateProjectSegments(cards.map(c => {
                if (c.id === lastCard.id && c.type === 'dritto') {
                    return {
                        ...c,
                        subMisure: [...c.subMisure, { id: `sm-${Date.now()}`, length: 1000 }]
                    };
                }
                return c;
            }));
        } else {
            updateProjectSegments([...cards, createCardDritto()]);
        }
    };

    const addCurva = () => {
        updateProjectSegments([...cards, createCardCurva('right')]);
    };

    const removeCard = (id: string) => {
        updateProjectSegments(cards.filter(c => c.id !== id));
    };

    const updateDrittoLength = (id: string, length: number) => {
        updateProjectSegments(cards.map(c =>
            c.id === id && c.type === 'dritto' ? { ...c, baseLength: length } : c
        ));
    };

    const updateSottomisuraLength = (cardId: string, smId: string, length: number) => {
        updateProjectSegments(cards.map(c => {
            if (c.id === cardId && c.type === 'dritto') {
                return {
                    ...c,
                    subMisure: c.subMisure.map(sm => sm.id === smId ? { ...sm, length } : sm)
                };
            }
            return c;
        }));
    };

    const removeSottomisura = (cardId: string, smId: string) => {
        updateProjectSegments(cards.map(c => {
            if (c.id === cardId && c.type === 'dritto') {
                return { ...c, subMisure: c.subMisure.filter(sm => sm.id !== smId) };
            }
            return c;
        }));
    };

    const updateCurvaDirection = (id: string, dir: SegmentDirection) => {
        updateProjectSegments(cards.map(c =>
            c.id === id && c.type === 'curva' ? { ...c, direction: dir } : c
        ));
    };

    const addOstacoloToDritto = (id: string) => {
        // Aggiunge un muro fittizio a metà
        updateProjectSegments(cards.map(c => {
            if (c.id === id && c.type === 'dritto') {
                return {
                    ...c,
                    ostacoli: [...c.ostacoli, { id: `ost-${Date.now()}`, type: 'wall', thickness: 300, distanceFromStart: c.baseLength / 2 }]
                };
            }
            return c;
        }));
    };

    const removeOstacolo = (cardId: string, ostId: string) => {
        updateProjectSegments(cards.map(c => {
            if (c.id === cardId && c.type === 'dritto') {
                return { ...c, ostacoli: c.ostacoli.filter(o => o.id !== ostId) };
            }
            return c;
        }));
    };

    const updateOstacolo = (
        cardId: string,
        ostId: string,
        field: 'thickness' | 'distanceFromStart' | 'holeWidth' | 'holeHeight' | 'offsetFromCeiling' | 'offsetFromRight',
        value: number
    ) => {
        updateProjectSegments(cards.map(c => {
            if (c.id === cardId && c.type === 'dritto') {
                return {
                    ...c,
                    ostacoli: c.ostacoli.map(o => o.id === ostId ? { ...o, [field]: value } : o)
                };
            }
            return c;
        }));
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 hidden">
                Costruzione Impianto
            </h2>

            <div className="space-y-6">
                <h3 className="font-semibold flex items-center gap-2 text-foreground">
                    <Navigation className="h-5 w-5 text-primary" /> Rilievo Asse Stanza
                </h3>

                {/* Pulsantiera di Aggiunta Rapida (Wizard) */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Button onClick={addDritto} className="h-16 flex flex-col items-center justify-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border-none dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50">
                        <TrendingUp className="h-5 w-5" />
                        <span className="text-xs font-semibold">Tratto Dritto</span>
                    </Button>
                    <Button onClick={addCurva} className="h-16 flex flex-col items-center justify-center gap-1 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 border-none dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                        <span className="text-xs font-semibold">Curva</span>
                    </Button>
                    <Button disabled className="h-16 flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400 border-none dark:bg-slate-800">
                        <Settings2 className="h-5 w-5" />
                        <span className="text-xs font-semibold">Canala Fumi (TBD)</span>
                    </Button>
                    <Button disabled className="h-16 flex flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400 border-none dark:bg-slate-800">
                        <Plus className="h-5 w-5" />
                        <span className="text-xs font-semibold">Terminale (TBD)</span>
                    </Button>
                </div>

                {/* Lista Inserimenti Rilievo (Timeline Verticale) */}
                <div className="space-y-4 mt-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">

                    {cards.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground italic text-sm relative z-10 bg-background/80 rounded-xl border border-dashed border-border">
                            Inizia aggiungendo un Tratto Dritto per descrivere il primo asse della stanza.
                        </div>
                    )}

                    {cards.map((card, index) => {
                        if (card.type === 'dritto') {
                            return (
                                <div key={card.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-background bg-primary/10 text-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold">
                                        {index + 1}
                                    </div>
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-4 rounded-xl border border-primary/20 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="font-bold text-foreground flex items-center gap-2">
                                                <TrendingUp className="h-4 w-4 text-primary" /> Tratto Dritto
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => removeCard(card.id)} className="h-6 w-6 p-0 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><XIcon /></Button>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="p-3 bg-muted/20 border border-border rounded-lg space-y-3">
                                                <div>
                                                    <Label className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Misura Iniziale Asse (mm)</Label>
                                                    <Input
                                                        type="number"
                                                        value={card.baseLength}
                                                        onChange={(e) => updateDrittoLength(card.id, Number(e.target.value))}
                                                        className="mt-1 font-mono h-12 text-lg focus-visible:ring-primary shadow-inner bg-background border-border"
                                                    />
                                                </div>

                                                {/* Rendering Sottomisure in serie */}
                                                {card.subMisure.length > 0 && (
                                                    <div className="pt-2 space-y-2 relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-border/50 before:-z-10 z-0">
                                                        {card.subMisure.map((sm, smIndex) => (
                                                            <div key={sm.id} className="flex gap-2 items-end pl-6 relative">
                                                                <div className="absolute top-1/2 left-3 w-3 h-px bg-border/50 -translate-y-1/2"></div>
                                                                <div className="flex-1">
                                                                    <Label className="text-[10px] text-muted-foreground font-semibold flex items-center justify-between uppercase">
                                                                        <span>Continua Tratto (mm)</span>
                                                                    </Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={sm.length}
                                                                        onChange={(e) => updateSottomisuraLength(card.id, sm.id, Number(e.target.value))}
                                                                        className="mt-1 font-mono h-10 border-dashed focus-visible:ring-primary shadow-sm bg-background/50"
                                                                    />
                                                                </div>
                                                                <Button variant="ghost" size="icon" onClick={() => removeSottomisura(card.id, sm.id)} className="h-10 w-10 shrink-0 text-destructive hover:bg-destructive/10"><XIcon /></Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Rendering Ostacoli Orizzontali legati all'asse */}
                                            {card.ostacoli.length > 0 && (
                                                <div className="pt-2 pb-1 space-y-3">
                                                    <Label className="text-xs text-muted-foreground uppercase tracking-wide font-semibold flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Ostacoli / Attraversamenti
                                                    </Label>
                                                    {card.ostacoli.map(o => (
                                                        <div key={o.id} className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg space-y-3 relative overflow-hidden">
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400"></div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="flex items-center gap-2 text-foreground font-semibold text-sm">Muro / Solaio</span>
                                                                <Button variant="ghost" size="icon" onClick={() => removeOstacolo(card.id, o.id)} className="h-6 w-6 text-destructive hover:bg-destructive/10"><XIcon /></Button>
                                                            </div>
                                                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                                                                <div>
                                                                    <Label className="text-[10px] text-muted-foreground uppercase">Spessore Muro</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={o.thickness || 0}
                                                                        onChange={(e) => updateOstacolo(card.id, o.id, 'thickness', Number(e.target.value))}
                                                                        className="h-8 mt-1 font-mono text-xs bg-background border-border"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="text-[10px] text-muted-foreground uppercase">Distanza asse</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={o.distanceFromStart || 0}
                                                                        onChange={(e) => updateOstacolo(card.id, o.id, 'distanceFromStart', Number(e.target.value))}
                                                                        title="Distanza dall'inizio dell'asse su cui si trova il muro"
                                                                        className="h-8 mt-1 font-mono text-xs bg-background border-border"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="text-[10px] text-muted-foreground uppercase">Larghezza Foro</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={o.holeWidth || ''}
                                                                        placeholder="es. 500"
                                                                        onChange={(e) => updateOstacolo(card.id, o.id, 'holeWidth', Number(e.target.value))}
                                                                        className="h-8 mt-1 font-mono text-xs bg-background border-border"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="text-[10px] text-muted-foreground uppercase">Altezza Foro</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={o.holeHeight || ''}
                                                                        placeholder="es. 400"
                                                                        onChange={(e) => updateOstacolo(card.id, o.id, 'holeHeight', Number(e.target.value))}
                                                                        className="h-8 mt-1 font-mono text-xs bg-background border-border"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="text-[10px] text-muted-foreground uppercase">Dist. Soffitto</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={o.offsetFromCeiling || ''}
                                                                        placeholder="es. 300"
                                                                        onChange={(e) => updateOstacolo(card.id, o.id, 'offsetFromCeiling', Number(e.target.value))}
                                                                        className="h-8 mt-1 font-mono text-xs bg-background border-border"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <Label className="text-[10px] text-muted-foreground uppercase">Dist. Destra</Label>
                                                                    <Input
                                                                        type="number"
                                                                        value={o.offsetFromRight || ''}
                                                                        placeholder="es. 500"
                                                                        onChange={(e) => updateOstacolo(card.id, o.id, 'offsetFromRight', Number(e.target.value))}
                                                                        className="h-8 mt-1 font-mono text-xs bg-background border-border"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <Button variant="secondary" size="sm" onClick={() => addOstacoloToDritto(card.id)} className="w-full text-xs font-semibold mt-2 border-dashed border">
                                                <Plus className="h-3 w-3 mr-1" /> Aggiungi Ostacolo (Muro)
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        if (card.type === 'curva') {
                            return (
                                <div key={card.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-background bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 font-bold">
                                        {index + 1}
                                    </div>
                                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-4 rounded-xl border border-border flex flex-col shadow-sm transition-opacity animate-in fade-in slide-in-from-bottom-2">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="font-bold text-foreground flex items-center gap-2">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
                                                Curva 90° (Crocevia)
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => removeCard(card.id)} className="h-6 w-6 p-0 rounded-full bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><XIcon /></Button>
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="text-xs text-muted-foreground uppercase tracking-wide font-semibold text-center block mb-2">Imposta Nuova Direzione</Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    variant="outline"
                                                    onClick={() => updateCurvaDirection(card.id, 'right')}
                                                    className={`h-10 ${card.direction === 'right' ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold' : 'border-border'}`}>Destra</Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => updateCurvaDirection(card.id, 'left')}
                                                    className={`h-10 ${card.direction === 'left' ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold' : 'border-border'}`}>Sinistra</Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => updateCurvaDirection(card.id, 'up')}
                                                    className={`h-10 ${card.direction === 'up' ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold' : 'border-border'}`}>Alto</Button>
                                                <Button
                                                    variant="outline"
                                                    onClick={() => updateCurvaDirection(card.id, 'down')}
                                                    className={`h-10 ${card.direction === 'down' ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold' : 'border-border'}`}>Basso</Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        return null;
                    })}

                </div>
            </div>
        </div>
    );
}

function XIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
    );
}
