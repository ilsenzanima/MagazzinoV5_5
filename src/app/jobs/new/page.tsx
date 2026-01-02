"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2, Save, RefreshCw } from "lucide-react";
import Link from "next/link";
import { jobsApi, clientsApi, Client } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/components/auth-provider";

export default function NewJobPage() {
  const router = useRouter();
  const { userRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [useClientAddress, setUseClientAddress] = useState(false);

  if (userRole === 'user') {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-full py-20">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Accesso Negato</h2>
          <p className="text-slate-500 mb-6">Non hai i permessi necessari per creare nuove commesse.</p>
          <Link href="/jobs">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Torna alle Commesse
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const [formData, setFormData] = useState({
    clientId: "",
    code: "",
    name: "",
    description: "",
    status: "active" as const,
    startDate: new Date().toISOString().split('T')[0], // Default to today
    endDate: "",
    siteAddress: "",
    siteManager: "",
    cig: "",
    cup: ""
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

  // Effect to handle "Use client address" checkbox
  useEffect(() => {
    if (useClientAddress && formData.clientId) {
      const selectedClient = clients.find(c => c.id === formData.clientId);
      if (selectedClient) {
        setFormData(prev => ({ ...prev, siteAddress: selectedClient.address || "" }));
      }
    }
  }, [useClientAddress, formData.clientId, clients]);

  const generateCode = (clientName: string) => {
    if (!clientName) return "";
    const date = new Date();
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    // Sanitize client name: take first 3 chars, uppercase, alphanumeric only
    const clientSlug = clientName.trim().substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, 'X');
    return `${year}-${month}-${clientSlug}`;
  };

  const handleClientChange = (clientId: string) => {
    const selectedClient = clients.find(c => c.id === clientId);
    const newCode = selectedClient ? generateCode(selectedClient.name) : formData.code;

    setFormData(prev => ({
      ...prev,
      clientId,
      code: newCode || prev.code,
      siteAddress: useClientAddress && selectedClient ? (selectedClient.address || "") : (prev.siteAddress || "")
    }));
  };

  const regenerateCode = () => {
    const selectedClient = clients.find(c => c.id === formData.clientId);
    if (selectedClient) {
      setFormData(prev => ({ ...prev, code: generateCode(selectedClient.name) }));
    }
  };

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
            <CardTitle>Dettagli Commessa & Cantiere</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Sezione Committente */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold text-slate-700">Committente</h3>
                <div className="space-y-2">
                  <Label htmlFor="client">Seleziona Committente *</Label>
                  <Select
                    value={formData.clientId}
                    onValueChange={handleClientChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Cerca committente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sezione Dati Commessa */}
              <div className="space-y-4 border-b pb-4">
                <h3 className="font-semibold text-slate-700">Dati Commessa</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Codice Commessa (Auto)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="code"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                        placeholder="YYYY-MM-CLT"
                      />
                      <Button type="button" variant="outline" size="icon" onClick={regenerateCode} title="Rigenera codice">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-slate-500">Formato: Anno-Mese-Committente</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="name">Nome Commessa *</Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Es. Ristrutturazione Villa Rossi"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrizione (Opzionale)</Label>
                  <textarea
                    id="description"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cig">CIG (Codice Identificativo Gara)</Label>
                    <Input
                      id="cig"
                      value={formData.cig}
                      onChange={(e) => setFormData({ ...formData, cig: e.target.value })}
                      placeholder="Es. 1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cup">CUP (Codice Unico Progetto)</Label>
                    <Input
                      id="cup"
                      value={formData.cup}
                      onChange={(e) => setFormData({ ...formData, cup: e.target.value })}
                      placeholder="Es. A1B2C3D4E5"
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
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Data Fine (Prevista)</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Stato</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(val: any) => setFormData({ ...formData, status: val })}
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
              </div>

              {/* Sezione Cantiere */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700">Indirizzo Cantiere</h3>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="useClientAddress"
                      checked={useClientAddress}
                      onCheckedChange={(checked) => setUseClientAddress(checked as boolean)}
                    />
                    <Label htmlFor="useClientAddress" className="text-sm font-normal cursor-pointer">
                      Usa indirizzo committente
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="siteAddress">Indirizzo Completo</Label>
                  <Input
                    id="siteAddress"
                    value={formData.siteAddress}
                    onChange={(e) => setFormData({ ...formData, siteAddress: e.target.value })}
                    placeholder="Via Roma 1, 00100 Milano (MI)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="siteManager">Capocantiere / Referente (Opzionale)</Label>
                  <Input
                    id="siteManager"
                    value={formData.siteManager}
                    onChange={(e) => setFormData({ ...formData, siteManager: e.target.value })}
                    placeholder="Nome Cognome"
                  />
                </div>
              </div>

              <div className="pt-6 flex justify-end gap-2 border-t mt-6">
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
