import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Warehouse, 
  Check, 
  ArrowRight, 
  Box, 
  BarChart3, 
  Cloud, 
  ShieldCheck,
  Home
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-blue-100">
      
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-500 text-white p-1.5 rounded-md">
                <Warehouse className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              MAGAZZINO <span className="text-red-500">PPA</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <Link href="#" className="hover:text-blue-600 transition-colors">Supporto</Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">Contattaci</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6">
                Accedi
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="outline" className="hidden sm:inline-flex border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900">
                Registrati
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 md:py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            
            {/* Left Column: Content */}
            <div className="space-y-8 animate-in slide-in-from-left duration-700">
              <Badge variant="secondary" className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded-full text-sm font-medium border-none">
                <span className="w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse"></span>
                NUOVA VERSIONE 2.0
              </Badge>
              
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]">
                Gestione <br/>
                Magazzino <br/>
                <span className="text-blue-500">Semplice e Veloce</span>
              </h1>
              
              <p className="text-lg sm:text-xl text-slate-500 leading-relaxed max-w-lg">
                Benvenuto in MAGAZZINO PPA. La piattaforma definitiva per monitorare le scorte, ottimizzare gli ordini e gestire il tuo inventario con precisione chirurgica.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link href="/login">
                  <Button size="lg" className="h-14 px-8 text-lg bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 w-full sm:w-auto rounded-xl group">
                    Accedi subito
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-2 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 w-full sm:w-auto rounded-xl">
                    Crea account
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-2 text-sm font-medium text-slate-500 pt-4">
                <ShieldCheck className="h-5 w-5 text-green-500" />
                Sistema sicuro e certificato
              </div>
            </div>

            {/* Right Column: Image */}
            <div className="relative animate-in slide-in-from-right duration-700 delay-200">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200 bg-slate-100 aspect-[4/3] group">
                {/* Warehouse Image Placeholder */}
                <img 
                  src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80" 
                  alt="Warehouse Interior" 
                  className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                />
                
                {/* Floating Card */}
                <div className="absolute bottom-6 left-6 right-6 sm:right-auto sm:w-80 bg-white/95 backdrop-blur rounded-xl p-4 shadow-xl border border-white/20 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Stato Sistema</p>
                    <p className="text-sm text-green-600 font-medium">Tutti i servizi operativi</p>
                  </div>
                </div>
              </div>
              
              {/* Decorative Blur */}
              <div className="absolute -z-10 inset-0 bg-blue-500/20 blur-3xl transform translate-y-4 scale-95 opacity-50 rounded-full" />
            </div>

          </div>
        </section>

        {/* Features Section */}
        <section className="bg-slate-50 py-20 border-t border-slate-100">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
              
              <Card className="border-none shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow duration-300">
                <CardContent className="pt-8 px-8 pb-8 text-center space-y-4">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 mb-6">
                    <Box className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Controllo Totale</h3>
                  <p className="text-slate-500 leading-relaxed">
                    Monitoraggio in tempo reale di ogni singolo articolo nel tuo inventario con tracciamento avanzato.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow duration-300">
                <CardContent className="pt-8 px-8 pb-8 text-center space-y-4">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-6">
                    <BarChart3 className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Analisi Predittiva</h3>
                  <p className="text-slate-500 leading-relaxed">
                    Report dettagliati per prevedere le necessità di stock, analizzare i trend e ridurre gli sprechi.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-lg shadow-slate-200/50 hover:shadow-xl transition-shadow duration-300">
                <CardContent className="pt-8 px-8 pb-8 text-center space-y-4">
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-6">
                    <Cloud className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Cloud Sicuro</h3>
                  <p className="text-slate-500 leading-relaxed">
                    I tuoi dati sono al sicuro, crittografati e accessibili ovunque tu sia, 24/7 da qualsiasi dispositivo.
                  </p>
                </CardContent>
              </Card>

            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-slate-500 font-medium">
             <Home className="h-5 w-5" />
             <span>© 2024 MAGAZZINO PPA</span>
          </div>
          
          <div className="flex items-center gap-8 text-sm text-slate-500">
            <Link href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">Termini di Servizio</Link>
            <Link href="#" className="hover:text-blue-600 transition-colors">Aiuto</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
