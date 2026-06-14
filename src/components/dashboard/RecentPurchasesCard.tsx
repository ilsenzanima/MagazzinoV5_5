import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Clock, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";

interface Purchase {
  id: string;
  delivery_note_number: string | null;
  delivery_note_date: string | null;
  created_at: string;
  totalAmount: number;
  suppliers: { name: string } | null;
  purchase_items: { price: number; quantity: number }[];
}

interface RecentPurchasesCardProps {
  data: Purchase[];
}

export function RecentPurchasesCard({ data }: RecentPurchasesCardProps) {
  const { userRole } = useAuth();
  const canSeePrices = userRole === 'admin' || userRole === 'operativo';
  const purchases = data ?? [];

  const formatEur = (v: number) =>
    new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(v);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-emerald-500" />
            Ultimi Acquisti
          </CardTitle>
          <Link
            href="/purchases"
            className="text-xs text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-0.5 transition-colors"
          >
            Vedi tutti <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="flex-1">
        <div className="space-y-1">
          {purchases.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-8">
              Nessun acquisto recente
            </p>
          ) : (
            purchases.map((purchase) => (
              <Link
                key={purchase.id}
                href={`/purchases/${purchase.id}`}
                className="flex items-center justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 py-2.5 rounded-lg transition-colors"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                    <ShoppingCart className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {purchase.suppliers?.name ?? "Fornitore n/d"}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {purchase.delivery_note_number
                        ? `DDT ${purchase.delivery_note_number}`
                        : "Senza numero"}
                      {" · "}
                      {purchase.purchase_items?.length ?? 0} articol
                      {(purchase.purchase_items?.length ?? 0) === 1 ? "o" : "i"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 ml-2 gap-1">
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    {canSeePrices ? formatEur(purchase.totalAmount) : "—"}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5 whitespace-nowrap">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDistanceToNow(new Date(purchase.created_at), {
                      addSuffix: true,
                      locale: it,
                    })}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
