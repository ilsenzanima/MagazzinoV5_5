"use client"

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { fetchWithTimeout } from "@/lib/api";
import { ArrowDownRight, ArrowUpRight, Clock, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface Movement {
  id: string;
  type: 'load' | 'unload';
  quantity: number;
  created_at: string;
  inventory: {
    name: string;
    model?: string;
    unit: string;
  };
  profiles: {
    full_name: string;
  } | null;
}

interface RecentMovementsProps {
  data: Movement[];
}

export function RecentMovements({ data }: RecentMovementsProps) {
  // Safe fallback if data is undefined/null
  const movements = data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Ultimi Movimenti</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {movements.length === 0 ? (
            <div className="text-center text-sm text-slate-500 py-4">
              Nessun movimento recente
            </div>
          ) : (
            movements.map((movement) => (
              <div key={movement.id} className="flex items-start justify-between group">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-full ${movement.type === 'load'
                      ? 'bg-emerald-100 text-emerald-600'
                      : 'bg-amber-100 text-amber-600'
                    }`}>
                    {movement.type === 'load' ? (
                      <ArrowDownRight className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {movement.inventory?.name || 'Articolo sconosciuto'}
                      {movement.inventory?.model && (
                        <span className="text-slate-500 font-normal ml-1">
                          ({movement.inventory.model})
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${movement.type === 'load'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                        }`}>
                        {movement.type === 'load' ? '+' : '-'}{movement.quantity} {movement.inventory?.unit}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {movement.profiles?.full_name || 'Utente'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1 mt-1 sm:mt-0 sm:whitespace-nowrap">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  {formatDistanceToNow(new Date(movement.created_at), { addSuffix: true, locale: it })}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
