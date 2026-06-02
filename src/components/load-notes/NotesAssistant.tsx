"use client"

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { loadNotesService } from "@/lib/services/load-notes";
import { LoadNote, LoadNoteItem } from "@/lib/types";
import { FileText, Loader2, PlusCircle, ArrowDownRight, ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";

interface NotesAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    currentJobId?: string; // If provided, filters notes by this job
    onUseItem?: (item: LoadNoteItem) => void; // Callback when user clicks "+" to use item
}

export function NotesAssistant({ isOpen, onClose, currentJobId, onUseItem }: NotesAssistantProps) {
    const [notes, setNotes] = useState<LoadNote[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

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
            // Fetch pending notes, filtered by job if currentJobId is provided
            const allNotes = await loadNotesService.getAll({
                status: 'pending',
                jobId: currentJobId // Filter by job if provided
            });

            // Sort by date descending, then by job name
            const sorted = allNotes.sort((a, b) => {
                const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
                if (dateCompare !== 0) return dateCompare;
                return (a.jobDescription || '').localeCompare(b.jobDescription || '');
            });

            setNotes(sorted);
        } catch (error) {
            console.error("Failed to fetch notes", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleCheck = async (noteId: string, itemId: string, currentChecked?: boolean) => {
        // Use the passed current state to correctly handle items already checked server-side
        const isCurrentlyChecked = currentChecked ?? checkedItems.has(itemId);
        const newChecked = !isCurrentlyChecked;

        // Update local state immediately for responsiveness
        const next = new Set(checkedItems);
        if (newChecked) {
            next.add(itemId);
        } else {
            next.delete(itemId);
        }
        setCheckedItems(next);

        // Persist to service (syncs with note detail page)
        try {
            await loadNotesService.toggleItemCheck(noteId, itemId, newChecked);
        } catch (error) {
            console.error("Failed to toggle item check", error);
        }
    };

    const toggleExpanded = (noteId: string) => {
        const next = new Set(expandedNotes);
        if (next.has(noteId)) {
            next.delete(noteId);
        } else {
            next.add(noteId);
        }
        setExpandedNotes(next);
    };

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
                <SheetHeader className="p-6 pb-4 border-b">
                    <SheetTitle>Assistente Note di Carico</SheetTitle>
                    <SheetDescription>
                        {currentJobId
                            ? "Note aperte per la commessa selezionata"
                            : "Tutte le note aperte"}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 p-4 overflow-y-auto">
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
                        <div className="space-y-2">
                            {notes.map(note => {
                                const isExpanded = expandedNotes.has(note.id);
                                const uncheckedCount = note.items.filter(i => !checkedItems.has(i.id) && !i.isChecked).length;

                                return (
                                    <Collapsible key={note.id} open={isExpanded} onOpenChange={() => toggleExpanded(note.id)}>
                                        <CollapsibleTrigger asChild>
                                            <div className="flex items-center gap-2 p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors">
                                                {/* Type Icon */}
                                                <div className={`flex-shrink-0 p-1.5 rounded ${note.noteType === 'uscita' ? 'bg-amber-500/10 text-amber-600' : 'bg-green-500/10 text-green-600'}`}>
                                                    {note.noteType === 'uscita'
                                                        ? <ArrowUpRight className="h-4 w-4" />
                                                        : <ArrowDownRight className="h-4 w-4" />
                                                    }
                                                </div>

                                                {/* Date and Job */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-muted-foreground">
                                                            {format(new Date(note.date), "d MMM", { locale: it })}
                                                        </span>
                                                        {uncheckedCount > 0 && (
                                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                                                {uncheckedCount}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="font-medium text-sm truncate">
                                                        {note.jobDescription || note.notes || "Appunto generico"}
                                                    </div>
                                                </div>

                                                {/* Chevron */}
                                                <div className="flex-shrink-0 text-muted-foreground">
                                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </div>
                                            </div>
                                        </CollapsibleTrigger>

                                        <CollapsibleContent>
                                            <div className="ml-4 pl-4 border-l-2 border-muted mt-1 space-y-1">
                                                {note.notes && (
                                                    <div className="text-xs italic text-muted-foreground py-1 px-2">
                                                        "{note.notes}"
                                                    </div>
                                                )}
                                                {note.items.map(item => {
                                                    const isChecked = checkedItems.has(item.id) || item.isChecked;
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            className={`
                                                                flex items-center gap-2 p-2 rounded border text-sm
                                                                transition-colors
                                                                ${isChecked ? 'bg-muted/30 border-transparent opacity-60' : 'bg-background hover:border-primary/50'}
                                                            `}
                                                        >
                                                            <Checkbox
                                                                checked={isChecked}
                                                                onCheckedChange={() => toggleCheck(note.id, item.id, isChecked)}
                                                            />
                                                            <div className={`flex-1 min-w-0 ${isChecked ? 'line-through text-muted-foreground' : ''}`}>
                                                                <span className="font-medium">{item.inventoryName}</span>
                                                                {item.inventoryModel && (
                                                                    <span className="text-xs text-muted-foreground ml-1">({item.inventoryModel})</span>
                                                                )}
                                                            </div>
                                                            <div className={`text-xs font-semibold whitespace-nowrap ${isChecked ? 'text-muted-foreground' : ''}`}>
                                                                {item.quantity} {item.inventoryUnit}
                                                            </div>
                                                            {onUseItem && !isChecked && (
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-6 w-6 text-primary flex-shrink-0"
                                                                    title="Usa in DDT"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onUseItem(item);
                                                                        toggleCheck(note.id, item.id);
                                                                    }}
                                                                >
                                                                    <PlusCircle className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </CollapsibleContent>
                                    </Collapsible>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t bg-muted/20 text-xs text-center text-muted-foreground">
                    Clicca su una nota per vedere il contenuto
                </div>
            </SheetContent>
        </Sheet>
    );
}
