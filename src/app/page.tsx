import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function Home() {
  // Check if user is already logged in
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // If logged in, redirect to dashboard
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="page-texture min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center px-4">

      {/* Main Content */}
      <Card className="w-full max-w-md gap-8 px-8 py-10 text-center sm:px-10">

        {/* Logo */}
        <div className="flex justify-center">
          <Image
            src="/logo_header.png"
            alt="OPI Firesafe Logo"
            width={200}
            height={60}
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

      </Card>

      {/* Footer */}
      <footer className="absolute bottom-4 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} OPI Firesafe S.R.L. • Sistema ad uso interno
        </p>
      </footer>

    </div>
  );
}
