"use client"

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, ShoppingBag, Clock, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import Link from "next/link";

interface DeliveryNoteItem {
  quantity: number;
  inventory: {
    name: string;
    model?: string;
    unit: string;
  } | null;
}

interface Movement {
  id: string;
  type: 'entry' | 'exit' | 'sale';
  number: string;
  date: string;
  created_at: string;
  jobs?: {
    code: string;
    description: string;
  } | null;
  delivery_note_items?: DeliveryNoteItem[];
}

interface RecentMovementsProps {
  data: Movement[];
}

export const RecentMovements = memo(function RecentMovements({ data }: RecentMovementsProps) {
  // Safe fallback if data is undefined/null
  const movements = data || [];

  const getTypeInfo = (type: string) => {
    switch (type) {
      case 'entry':
        return { icon: ArrowDownRight, label: 'Entrata', color: 'emerald' };
      case 'exit':
        return { icon: ArrowUpRight, label: 'Uscita', color: 'amber' };
      case 'sale':
        return { icon: ShoppingBag, label: 'Vendita', color: 'blue' };
      default:
        return { icon: FileText, label: type, color: 'slate' };
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Ultimi Movimenti</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {movements.length === 0 ? (
            <div className="text-center text-sm text-slate-500 dark:text-slate-400 py-4">
              Nessun movimento recente
            </div>
          ) : (
            movements.map((movement) => {
              const typeInfo = getTypeInfo(movement.type);
              const Icon = typeInfo.icon;
              const totalQty = movement.delivery_note_items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
              const firstItem = movement.delivery_note_items?.[0];

              return (
                <Link key={movement.id} href={`/movements/${movement.id}`} className="block">
                  <div className="flex items-start justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/50 -mx-2 px-2 py-2 rounded-lg transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-full bg-${typeInfo.color}-100 dark:bg-${typeInfo.color}-900/50 text-${typeInfo.color}-600 dark:text-${typeInfo.color}-400`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          DDT {movement.number}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium bg-${typeInfo.color}-50 dark:bg-${typeInfo.color}-900/30 text-${typeInfo.color}-700 dark:text-${typeInfo.color}-300`}>
                            {typeInfo.label}
                          </span>
                          {movement.jobs && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {movement.jobs.code}
                            </span>
                          )}
                        </div>
                        {firstItem?.inventory && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {firstItem.inventory.name}
                            {(movement.delivery_note_items?.length || 0) > 1 && ` +${(movement.delivery_note_items?.length || 0) - 1} altri`}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 whitespace-nowrap">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      {formatDistanceToNow(new Date(movement.created_at), { addSuffix: true, locale: it })}
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
});

