"use client"

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Plus, 
  Loader2,
  MapPin,
  Briefcase,
  User,
  HardHat
} from "lucide-react";
import Link from "next/link";
import { Site, sitesApi } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useSearchParams } from "next/navigation";

export default function SitesPage() {
  const searchParams = useSearchParams();
  const filterJobId = searchParams.get('jobId');

  const [searchTerm, setSearchTerm] = useState("");
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSites();
  }, [filterJobId]);

  const loadSites = async () => {
    try {
        setLoading(true);
        // Note: API doesn't have getByJobId yet, but we can filter client side or add it.
        // For now let's load all and filter if needed, or update API.
        // Since the list won't be huge immediately, client side filtering is fine for MVP.
        const data = await sitesApi.getAll();
        if (filterJobId) {
            setSites(data.filter(s => s.jobId === filterJobId));
        } else {
            setSites(data);
        }
    } catch (error) {
        console.error("Failed to load sites:", error);
    } finally {
        setLoading(false);
    }
  };

  const filteredSites = sites.filter((site) => {
    return (
      site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.jobDescription?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.manager?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'active': return <Badge className="bg-green-600">Attivo</Badge>;
        case 'inactive': return <Badge variant="secondary">Inattivo</Badge>;
        case 'completed': return <Badge variant="outline">Completato</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10 space-y-4 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">Gestione Cantieri</h1>
          <Link href="/sites/new">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Cantiere
            </Button>
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Cerca Cantiere (Nome, Indirizzo, Capocantiere...)" 
            className="pl-9 bg-slate-100 border-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-slate-500">Caricamento cantieri...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSites.length === 0 ? (
            <div className="col-span-full text-center py-10 text-slate-400">
              <HardHat className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>Nessun cantiere trovato</p>
            </div>
          ) : (
            filteredSites.map((site) => (
              <Card key={site.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                      <CardTitle className="text-base leading-tight">{site.name}</CardTitle>
                      {getStatusBadge(site.status)}
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-3 text-slate-600">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="font-medium text-slate-700 truncate">{site.jobDescription || 'N/A'}</span>
                  </div>
                  
                  {site.address && (
                    <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{site.address}</span>
                    </div>
                  )}

                  {site.manager && (
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0" />
                        <span>Capocantiere: {site.manager}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
