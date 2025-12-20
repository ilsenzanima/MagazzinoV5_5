"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { jobsApi, clientsApi, Client } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [formData, setFormData] = useState({
    clientId: "",
    code: "",
    description: "",
    status: "active" as const,
    startDate: "",
    endDate: ""
  });

  useEffect(() => {
    const loadClients = async () => {
        try {
            const data = await clientsApi.getAll();
            setClients(data);
        } catch (err) {
            console.error(err);
        }
    };
    loadClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clientId) {
        alert("Seleziona un committente");
        return;
    }

    try {
      setLoading(true);
      await jobsApi.create(formData);
      router.push("/jobs");
      router.refresh();
    } catch (error) {
      console.error("Error creating job:", error);
      alert("Errore durante la creazione della commessa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/jobs" className="flex items-center text-slate-500 hover:text-slate-900 mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Torna alle Commesse
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Nuova Commessa</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dettagli Commessa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="space-y-2">
                <Label htmlFor="client">Committente *</Label>
                <Select 
                    value={formData.clientId} 
                    onValueChange={(val) => setFormData({...formData, clientId: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona un committente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Codice Commessa</Label>
                  <Input 
                    id="code" 
                    placeholder="Es. 2024-001"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value})}
                  />
                </div>
                 <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Descrizione / Nome *</Label>
                    <Input 
                        id="description" 
                        required 
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                    />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Data Inizio</Label>
                  <Input 
                    id="startDate" 
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">Data Fine (Prevista)</Label>
                  <Input 
                    id="endDate" 
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Stato</Label>
                <Select 
                    value={formData.status} 
                    onValueChange={(val: any) => setFormData({...formData, status: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Attiva</SelectItem>
                    <SelectItem value="completed">Completata</SelectItem>
                    <SelectItem value="suspended">Sospesa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <Link href="/jobs">
                  <Button type="button" variant="outline">Annulla</Button>
                </Link>
                <Button type="submit" disabled={loading} className="bg-blue-600">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salva Commessa
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
