import React from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HeroSection() {
  return (
    <section className="flex flex-col items-center justify-center py-24 text-center bg-background text-foreground">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
            Benvenuto in Magazzino V5.5
          </h1>
          <p className="max-w-[700px] text-lg text-muted-foreground md:text-xl">
            La soluzione completa per la gestione del tuo magazzino.
            Efficienza, velocità e controllo totale a portata di mano.
          </p>
          
          <div className="flex flex-col gap-4 min-[400px]:flex-row mt-8">
            <Link href="/dashboard">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Accedi alla Dashboard
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                Registrati
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
