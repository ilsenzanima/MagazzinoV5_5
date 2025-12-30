import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Package, AlertTriangle, Euro } from "lucide-react";
import { useAuth } from "@/components/auth-provider";

interface StatsCardsProps {
  totalValue: number;
  lowStockCount: number;
  totalItems: number;
}

export const StatsCards = memo(function StatsCards({ totalValue, lowStockCount, totalItems }: StatsCardsProps) {
  const { userRole } = useAuth();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
      <Card>
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <div className="text-slate-500 text-xs font-medium mb-1">Valore Magazzino</div>
          <div className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-emerald-500" />
            <span className="text-2xl font-bold text-slate-900">
              {userRole === 'user' ? (
                <span className="text-slate-400 italic text-lg">Non disponibile</span>
              ) : (
                formatCurrency(totalValue)
              )}
            </span>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <div className="text-slate-500 text-xs font-medium mb-1">Articoli in Scorta Minima</div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <span className="text-2xl font-bold text-slate-900">{lowStockCount}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
          <div className="text-slate-500 text-xs font-medium mb-1">Totale Articoli</div>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-500" />
            <span className="text-2xl font-bold text-slate-900">{totalItems}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
