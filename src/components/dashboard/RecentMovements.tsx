"use client"

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
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
    unit: string;
  };
  profiles: {
    full_name: string;
  } | null;
}

export function RecentMovements() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMovements = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await fetchWithTimeout(
          supabase
            .from('movements')
            .select(`
              id,
              type,
              quantity,
              created_at,
              inventory (name, unit),
              profiles:user_id (full_name)
            `)
            .order('created_at', { ascending: false })
            .limit(5)
        );

        if (!error && data) {
          setMovements(data as any);
        }
      } catch (error) {
        console.error("Error fetching recent movements:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovements();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Movimenti Recenti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="h-10 w-10 bg-slate-100 rounded-full" />
                <div className="space-y-2 flex-1 ml-4">
                  <div className="h-4 bg-slate-100 rounded w-3/4" />
                  <div className="h-3 bg-slate-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

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
                  <div className={`p-2 rounded-full ${
                    movement.type === 'load' 
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
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        movement.type === 'load' 
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
                <div className="text-xs text-slate-400 flex items-center gap-1 whitespace-nowrap">
                  <Clock className="h-3 w-3" />
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
