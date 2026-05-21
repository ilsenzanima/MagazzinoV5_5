"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function AuthCodeErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-red-100 p-3">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Link non valido</CardTitle>
          <CardDescription>
            Il link che hai usato è scaduto o non è valido. I link di conferma e recupero password scadono dopo 24 ore.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
            <Link href="/auth/forgot-password">Richiedi un nuovo link</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Torna al Login</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
