import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Background Mesh Gradients */}
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl opacity-50 dark:opacity-20 mix-blend-multiply dark:mix-blend-screen animate-blob" />
      <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl opacity-50 dark:opacity-20 mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-2000" />
      <div className="absolute -bottom-40 left-20 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl opacity-50 dark:opacity-20 mix-blend-multiply dark:mix-blend-screen animate-blob animation-delay-4000" />

      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center sm:px-8 relative z-10">
        <div className="max-w-4xl space-y-8">
          <div className="space-y-6">
            <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl md:text-8xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70 pb-2">
              Magazzino <span className="text-indigo-600 inline-block">V5.5</span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg font-medium text-muted-foreground sm:text-xl md:text-2xl leading-relaxed">
              La soluzione definitiva per la gestione logistica intelligente.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6 pt-4">
            <Button 
              asChild 
              size="lg" 
              className="h-12 px-8 text-base bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95"
            >
              <Link href="/dashboard">
                Accedi all'Area Riservata
              </Link>
            </Button>
            <Button 
              asChild 
              variant="outline" 
              size="lg" 
              className="h-12 px-8 text-base border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 hover:border-indigo-300 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950/50 transition-all hover:scale-105 active:scale-95"
            >
              <Link href="/register">
                Richiedi Demo
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-8 text-center">
        <p className="text-sm font-medium text-muted-foreground/60">
          © 2025 Magazzino V5.5 - Developed by IlSenzanima
        </p>
      </footer>
    </div>
  );
}
