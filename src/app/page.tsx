import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Package2 } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg text-center">
        <div className="flex justify-center">
          <div className="rounded-full bg-blue-100 p-4">
            <Package2 className="h-12 w-12 text-blue-600" />
          </div>
        </div>
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Magazzino Manager
          </h1>
          <p className="mt-2 text-slate-600">
            Gestisci il tuo inventario in modo semplice e veloce.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <Link href="/dashboard" className="w-full block">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-lg">
              Accedi
            </Button>
          </Link>
          
          <Link href="/dashboard" className="w-full block">
             <Button variant="outline" className="w-full h-12 text-lg">
              Registrati
            </Button>
          </Link>
        </div>
        
        <p className="text-xs text-slate-400 mt-8">
          Versione 1.0.0 - Alpha
        </p>
      </div>
    </div>
  );
}
