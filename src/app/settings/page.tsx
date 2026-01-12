"use client";

import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type FontPreference = 'default' | 'lexend' | 'opendyslexic';

export default function SettingsPage() {
    const { setTheme, theme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [fontPreference, setFontPreference] = useState<FontPreference>('default');

    // Load settings on mount
    useEffect(() => {
        setMounted(true);
        const savedFont = localStorage.getItem('font-preference') as FontPreference;
        if (savedFont) {
            setFontPreference(savedFont);
            applyFont(savedFont);
        }
    }, []);

    const applyFont = (font: FontPreference) => {
        // Remove all font classes first
        document.body.classList.remove('font-lexend', 'font-opendyslexic');

        // Apply new font class
        if (font === 'lexend') {
            document.body.classList.add('font-lexend');
        } else if (font === 'opendyslexic') {
            document.body.classList.add('font-opendyslexic');
        }
        // 'default' uses Geist Sans, no extra class needed
    };

    const handleFontChange = (font: FontPreference) => {
        setFontPreference(font);
        applyFont(font);
        localStorage.setItem('font-preference', font);
    };

    const handleThemeChange = (newTheme: string) => {
        console.log('Changing theme from', theme, 'to', newTheme);
        setTheme(newTheme);
    };

    if (!mounted) {
        return null;
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Impostazioni Generali</h3>
                <p className="text-sm text-muted-foreground">
                    Configura l'aspetto e il comportamento dell'applicazione.
                </p>
            </div>
            <Separator />

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Aspetto</CardTitle>
                        <CardDescription>
                            Personalizza come appare l'applicazione sul tuo dispositivo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tema Colore</Label>
                            <RadioGroup
                                value={theme}
                                onValueChange={handleThemeChange}
                                className="grid grid-cols-2 md:grid-cols-4 gap-4"
                            >
                                <div>
                                    <RadioGroupItem value="light" id="light" className="peer sr-only" />
                                    <Label
                                        htmlFor="light"
                                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 [&:has([data-state=checked])]:border-blue-600 cursor-pointer"
                                    >
                                        <div className="h-20 w-full rounded-md bg-[#ecedef] border" />
                                        <span className="mt-2 block w-full p-2 text-center text-sm font-medium">
                                            Chiaro
                                        </span>
                                    </Label>
                                </div>
                                <div>
                                    <RadioGroupItem value="gray" id="gray" className="peer sr-only" />
                                    <Label
                                        htmlFor="gray"
                                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 [&:has([data-state=checked])]:border-blue-600 cursor-pointer"
                                    >
                                        <div className="h-20 w-full rounded-md bg-[#E8E8E8] border flex items-center justify-center">
                                            <div className="h-10 w-10 rounded bg-[#C00016]" />
                                        </div>
                                        <span className="mt-2 block w-full p-2 text-center text-sm font-medium">
                                            Grigio OPI
                                        </span>
                                    </Label>
                                </div>
                                <div>
                                    <RadioGroupItem value="dark" id="dark" className="peer sr-only" />
                                    <Label
                                        htmlFor="dark"
                                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 [&:has([data-state=checked])]:border-blue-600 cursor-pointer"
                                    >
                                        <div className="h-20 w-full rounded-md bg-slate-950 border" />
                                        <span className="mt-2 block w-full p-2 text-center text-sm font-medium">
                                            Scuro
                                        </span>
                                    </Label>
                                </div>
                                <div>
                                    <RadioGroupItem value="system" id="system" className="peer sr-only" />
                                    <Label
                                        htmlFor="system"
                                        className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 [&:has([data-state=checked])]:border-blue-600 cursor-pointer"
                                    >
                                        <div className="flex h-20 w-full items-center justify-center rounded-md bg-slate-100 border overflow-hidden">
                                            <div className="h-full w-1/2 bg-[#ecedef]" />
                                            <div className="h-full w-1/2 bg-slate-950" />
                                        </div>
                                        <span className="mt-2 block w-full p-2 text-center text-sm font-medium">
                                            Sistema
                                        </span>
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </CardContent>
                </Card>

                {/* Font Accessibility - Disponibile per tutti i temi */}
                <Card>
                    <CardHeader>
                        <CardTitle>Accessibilità Font</CardTitle>
                        <CardDescription>
                            Scegli il font che preferisci per migliorare la leggibilità.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <RadioGroup
                            value={fontPreference}
                            onValueChange={(value) => handleFontChange(value as FontPreference)}
                            className="grid grid-cols-1 md:grid-cols-3 gap-4"
                        >
                            <div>
                                <RadioGroupItem value="default" id="font-default" className="peer sr-only" />
                                <Label
                                    htmlFor="font-default"
                                    className="flex flex-col rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 [&:has([data-state=checked])]:border-blue-600 cursor-pointer"
                                >
                                    <span className="font-semibold">Geist Sans</span>
                                    <span className="text-sm text-muted-foreground">Font predefinito</span>
                                    <div className="mt-2 p-2 bg-muted/50 rounded text-sm" style={{ fontFamily: 'var(--font-geist-sans), system-ui' }}>
                                        Anteprima: ABCDabcd 0123
                                    </div>
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="lexend" id="font-lexend" className="peer sr-only" />
                                <Label
                                    htmlFor="font-lexend"
                                    className="flex flex-col rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 [&:has([data-state=checked])]:border-blue-600 cursor-pointer"
                                >
                                    <span className="font-semibold">Lexend</span>
                                    <span className="text-sm text-muted-foreground">Ottimizzato per la lettura</span>
                                    <div className="mt-2 p-2 bg-muted/50 rounded text-sm" style={{ fontFamily: 'var(--font-lexend), system-ui' }}>
                                        Anteprima: ABCDabcd 0123
                                    </div>
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="opendyslexic" id="font-opendyslexic" className="peer sr-only" />
                                <Label
                                    htmlFor="font-opendyslexic"
                                    className="flex flex-col rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-blue-600 [&:has([data-state=checked])]:border-blue-600 cursor-pointer"
                                >
                                    <span className="font-semibold">OpenDyslexic</span>
                                    <span className="text-sm text-muted-foreground">Progettato per la dislessia</span>
                                    <div className="mt-2 p-2 bg-muted/50 rounded text-sm" style={{ fontFamily: "'OpenDyslexic', system-ui" }}>
                                        Anteprima: ABCDabcd 0123
                                    </div>
                                </Label>
                            </div>
                        </RadioGroup>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
