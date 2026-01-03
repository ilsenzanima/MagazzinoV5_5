import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-4">

      {/* Main Content */}
      <div className="w-full max-w-md text-center space-y-8">

        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/opi_logo.jpg"
            alt="OPI Firesafe Logo"
            width={180}
            height={80}
            className="object-contain"
            priority
          />
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
            MAGAZZINO <span className="text-red-600">PPA</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Sistema di Gestione Interno
          </p>
        </div>

        {/* Login Button */}
        <div className="pt-4">
          <Link href="/login" className="block">
            <Button
              size="lg"
              className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-sm"
            >
              Accedi
            </Button>
          </Link>
        </div>

        {/* Divider */}
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-4 bg-slate-50 dark:bg-slate-900 text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              oppure
            </span>
          </div>
        </div>

        {/* Register Link */}
        <div>
          <Link href="/register">
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              Nuovo utente? Richiedi accesso
            </Button>
          </Link>
        </div>

      </div>

      {/* Footer */}
      <footer className="absolute bottom-4 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} OPI Firesafe S.R.L. • Sistema ad uso interno
        </p>
      </footer>

    </div>
  );
}
