"use client"

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { loadNotesService } from "@/lib/services/load-notes-mock";
import { LoadNote, LoadNoteItem } from "@/lib/types";
import { FileText, Loader2, PlusCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface NotesAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    currentJobId?: string; // If provided, filters notes by this job
    onUseItem?: (item: LoadNoteItem) => void; // Callback when user clicks "+" to use item
}

export function NotesAssistant({ isOpen, onClose, currentJobId, onUseItem }: NotesAssistantProps) {
    const [notes, setNotes] = useState<LoadNote[]>([]);
    const [loading, setLoading] = useState(false);

    // We keep track of checked items locally for the session
    const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            fetchNotes();
        }
    }, [isOpen, currentJobId]);

    const fetchNotes = async () => {
        setLoading(true);
        try {
            // Fetch ALL pending notes (not filtered by job)
            const allNotes = await loadNotesService.getAll({
                status: 'pending' // Only show pending notes in assistant
            });

            // Sort: matching job first, then notes without job, then by date
            const sorted = allNotes.sort((a, b) => {
                // If we have a currentJobId, prioritize those notes
                if (currentJobId) {
                    const aMatches = a.jobId === currentJobId;
                    const bMatches = b.jobId === currentJobId;
                    if (aMatches && !bMatches) return -1;
                    if (!aMatches && bMatches) return 1;
                }
                // Then by date descending
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            });

            setNotes(sorted);
        } catch (error) {
            console.error("Failed to fetch notes", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleCheck = async (noteId: string, itemId: string) => {
        const isCurrentlyChecked = checkedItems.has(itemId);
        const newChecked = !isCurrentlyChecked;

        // Update local state immediately for responsiveness
        const next = new Set(checkedItems);
        if (newChecked) {
            next.add(itemId);
        } else {
            next.delete(itemId);
        }
        setCheckedItems(next);

        // Persist to mock service (syncs with note detail page)
        try {
            await loadNotesService.toggleItemCheck(noteId, itemId, newChecked);
        } catch (error) {
            console.error("Failed to toggle item check", error);
        }
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0 gap-0">
                <SheetHeader className="p-6 pb-2 border-b">
                    <SheetTitle>Assistente Note di Carico</SheetTitle>
                    <SheetDescription>
                        {currentJobId
                            ? "Note aperte per la commessa selezionata"
                            : "Tutte le note aperte"}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 p-6 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : notes.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground">
                            <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p>Nessuna nota attiva trovata.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {notes.map(note => (
                                <div key={note.id} className="border rounded-lg p-4 bg-card shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="text-sm text-muted-foreground mb-1">
                                                {format(new Date(note.date), "d MMM yyyy", { locale: it })}
                                            </div>
                                            {!currentJobId && note.jobCode && (
                                                <Badge variant="outline" className="mb-2">
                                                    {note.jobCode}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {note.notes && (
                                        <div className="bg-muted/30 p-2 rounded text-sm italic mb-4 border-l-2 border-primary/20 text-muted-foreground">
                                            "{note.notes}"
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        {note.items.map(item => {
                                            const isChecked = checkedItems.has(item.id) || item.isChecked;
                                            return (
                                                <div
                                                    key={item.id}
                                                    className={`
                                                        flex items-center gap-3 p-2 rounded border 
                                                        transition-colors
                                                        ${isChecked ? 'bg-muted/50 border-transparent' : 'bg-background hover:border-primary/50'}
                                                    `}
                                                >
                                                    <Checkbox
                                                        checked={isChecked}
                                                        onCheckedChange={() => toggleCheck(note.id, item.id)}
                                                    />
                                                    <div className={`flex-1 text-sm ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                                                        <span className="font-medium">{item.inventoryName}</span>
                                                        <span className="text-xs text-muted-foreground ml-1">({item.inventoryModel})</span>
                                                    </div>
                                                    <div className={`text-sm font-semibold whitespace-nowrap ${isChecked ? 'text-muted-foreground' : ''}`}>
                                                        {item.quantity} {item.inventoryUnit}
                                                    </div>
                                                    {onUseItem && !isChecked && (
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-6 w-6 text-primary"
                                                            title="Usa in DDT"
                                                            onClick={() => onUseItem(item)}
                                                        >
                                                            <PlusCircle className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-muted/20 text-xs text-center text-muted-foreground">
                    I flag sono solo visivi per aiutarti nella compilazione.
                </div>
            </SheetContent>
        </Sheet>
    );
}
