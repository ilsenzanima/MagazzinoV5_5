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
import { sitesApi, jobsApi, Job } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function NewSitePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  
  const [formData, setFormData] = useState({
    jobId: "",
    name: "",
    address: "",
    manager: "",
    status: "active" as const
  });

  useEffect(() => {
    const loadJobs = async () => {
        try {
            // Only fetch active jobs usually, but for now all
            const data = await jobsApi.getAll();
            setJobs(data);
        } catch (err) {
            console.error(err);
        }
    };
    loadJobs();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.jobId) {
        alert("Seleziona una commessa");
        return;
    }

    try {
      setLoading(true);
      await sitesApi.create(formData);
      router.push("/sites");
      router.refresh();
    } catch (error) {
      console.error("Error creating site:", error);
      alert("Errore durante la creazione del cantiere");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/sites" className="flex items-center text-slate-500 hover:text-slate-900 mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Torna ai Cantieri
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Nuovo Cantiere</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dettagli Cantiere</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="space-y-2">
                <Label htmlFor="job">Commessa di Riferimento *</Label>
                <Select 
                    value={formData.jobId} 
                    onValueChange={(val) => setFormData({...formData, jobId: val})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona una commessa" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((j) => (
                        <SelectItem key={j.id} value={j.id}>
                            {j.code ? `[${j.code}] ` : ''}{j.description}
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome Cantiere *</Label>
                <Input 
                    id="name" 
                    required 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Indirizzo</Label>
                <Input 
                    id="address" 
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="manager">Capocantiere</Label>
                    <Input 
                        id="manager" 
                        value={formData.manager}
                        onChange={(e) => setFormData({...formData, manager: e.target.value})}
                    />
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
                        <SelectItem value="active">Attivo</SelectItem>
                        <SelectItem value="inactive">Inattivo</SelectItem>
                        <SelectItem value="completed">Completato</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-2">
                <Link href="/sites">
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
                      Salva Cantiere
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
