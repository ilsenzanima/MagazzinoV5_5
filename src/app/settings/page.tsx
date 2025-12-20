"use client";

import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

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
                    <Label>Tema</Label>
                    <RadioGroup 
                        defaultValue={theme} 
                        onValueChange={(value) => setTheme(value)}
                        className="grid grid-cols-3 gap-4"
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
      </div>
    </div>
  );
}
