import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Plus, Package, ArrowRightLeft } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const actions = [
    {
      title: "Nuovo Articolo",
      description: "Aggiungi un nuovo prodotto al magazzino",
      icon: Plus,
      href: "#", // Placeholder for now
      color: "text-blue-500",
    },
    {
      title: "Lista Giacenze",
      description: "Visualizza lo stato attuale del magazzino",
      icon: Package,
      href: "#",
      color: "text-emerald-500",
    },
    {
      title: "Movimenti",
      description: "Registra entrate e uscite merce",
      icon: ArrowRightLeft,
      href: "#",
      color: "text-amber-500",
    },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      {/* Header */}
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Magazzino V5.5</h1>
        <p className="text-muted-foreground mt-2">Pannello di controllo gestione magazzino</p>
      </header>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {actions.map((action, index) => (
          <Link href={action.href} key={index} className="block group">
            <Card className="h-full transition-all duration-300 hover:shadow-lg hover:border-primary/50 cursor-pointer border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl font-medium">
                  {action.title}
                </CardTitle>
                <action.icon className={`h-6 w-6 ${action.color}`} />
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base mt-2">
                  {action.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
