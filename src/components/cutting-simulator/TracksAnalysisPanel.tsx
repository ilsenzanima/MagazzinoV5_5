import { useMemo } from "react";
import { DuctProject } from "@/lib/cutting-simulator/project-model";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Ruler } from "lucide-react";

export function TracksAnalysisPanel({ project }: { project: DuctProject }) {
    const tracksInfo = useMemo(() => {
        const tracks: { id: string, name: string, expected: number, actual: number, isMismatch: boolean }[] = [];
        let currentTrack: { id: string, name: string, expected: number } | null = null;
        let currentActual = 0;

        for (const seg of project.segments) {
            if (seg.type === 'trackSeparator') {
                if (currentTrack) {
                    tracks.push({ ...currentTrack, actual: currentActual, isMismatch: currentActual !== currentTrack.expected });
                }
                currentTrack = { id: seg.id, name: seg.name, expected: seg.expectedLength };
                currentActual = 0;
            } else if (currentTrack) {
                if (seg.type === 'straight') {
                    currentActual += seg.length;
                } else if (seg.type === 'elbow90') {
                    currentActual += seg.armA;
                }
            }
        }
        if (currentTrack) {
            tracks.push({ ...currentTrack, actual: currentActual, isMismatch: currentActual !== currentTrack.expected });
        }
        return tracks;
    }, [project.segments]);

    if (tracksInfo.length === 0) return null;

    return (
        <Card className="border-border/60 shadow-lg bg-gradient-to-br from-card to-card/80 mt-4 overflow-hidden">
            <CardHeader className="pb-3 bg-muted/20 border-b border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Ruler className="h-4 w-4" />
                    <CardTitle className="text-sm uppercase tracking-wider">Verifica Tratti Rapidi</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-64 overflow-y-auto">
                {tracksInfo.map(t => (
                    <div key={t.id} className="flex flex-col gap-0.5 text-xs bg-muted/40 p-2.5 rounded-lg border border-border/50">
                        <span className="font-semibold text-foreground">{t.name}</span>
                        <div className="flex justify-between items-center mt-1">
                            <span className="text-muted-foreground">Teorica: {t.expected} mm</span>
                            <span className={cn(
                                "font-mono font-black",
                                t.isMismatch ? "text-destructive" : "text-emerald-500"
                            )}>
                                Attuale: {t.actual} mm
                            </span>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
