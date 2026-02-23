"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Layers } from "lucide-react";
import type { SheetConfig } from "@/lib/cutting-simulator/nesting";

interface SheetConfigFormProps {
    config: SheetConfig;
    onChange: (config: SheetConfig) => void;
}

export function SheetConfigForm({ config, onChange }: SheetConfigFormProps) {
    return (
        <Card className="border-border/60 shadow-lg">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                        <Layers className="h-5 w-5 text-amber-500" />
                    </div>
                    <CardTitle className="text-lg">Dimensione Lastra</CardTitle>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="sheetW" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Larghezza (mm)
                        </Label>
                        <Input
                            id="sheetW"
                            type="number"
                            min="100"
                            step="10"
                            value={config.width}
                            onChange={(e) =>
                                onChange({ ...config, width: parseFloat(e.target.value) || 0 })
                            }
                            className="h-10 font-mono bg-background/50"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="sheetH" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Altezza (mm)
                        </Label>
                        <Input
                            id="sheetH"
                            type="number"
                            min="100"
                            step="10"
                            value={config.height}
                            onChange={(e) =>
                                onChange({ ...config, height: parseFloat(e.target.value) || 0 })
                            }
                            className="h-10 font-mono bg-background/50"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="sheetGap" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Gap taglio (mm)
                        </Label>
                        <Input
                            id="sheetGap"
                            type="number"
                            min="0"
                            step="1"
                            value={config.gap}
                            onChange={(e) =>
                                onChange({ ...config, gap: parseFloat(e.target.value) || 0 })
                            }
                            className="h-10 font-mono bg-background/50"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
