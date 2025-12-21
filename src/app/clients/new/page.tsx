"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { clientsApi } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    street: "",
    streetNumber: "",
    postalCode: "",
    city: "",
    province: "",
    vatNumber: "",
    email: "",
    phone: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await clientsApi.create(formData);
      router.push("/clients");
      router.refresh();
    } catch (error) {
      console.error("Error creating client:", error);
      alert("Errore durante la creazione del committente");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link href="/clients" className="flex items-center text-slate-500 hover:text-slate-900 mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Torna ai Committenti
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Nuovo Committente</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dettagli Anagrafici</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Ragione Sociale / Nome *</Label>
                <Input 
                  id="name" 
                  required 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Inserisci il nome dell'azienda o del cliente"
                />
              </div>

              {/* Indirizzo - Priorità alta come richiesto */}
              <div className="space-y-4 border-t border-b py-4 border-slate-100">
                <h3 className="font-medium text-slate-900">Indirizzo Sede</h3>
                
                <div className="grid grid-cols-4 gap-4">
                    <div className="col-span-3 space-y-2">
                        <Label htmlFor="street">Via / Piazza</Label>
                        <Input 
                        id="street" 
                        value={formData.street}
                        onChange={(e) => setFormData({...formData, street: e.target.value})}
                        placeholder="Via Roma"
                        />
                    </div>
                    <div className="col-span-1 space-y-2">
                        <Label htmlFor="streetNumber">N. Civico</Label>
                        <Input 
                        id="streetNumber" 
                        value={formData.streetNumber}
                        onChange={(e) => setFormData({...formData, streetNumber: e.target.value})}
                        placeholder="10"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="md:col-span-1 space-y-2">
                        <Label htmlFor="postalCode">CAP</Label>
                        <Input 
                        id="postalCode" 
                        value={formData.postalCode}
                        onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
                        placeholder="00100"
                        />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="city">Città</Label>
                        <Input 
                        id="city" 
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                        placeholder="Milano"
                        />
                    </div>
                    <div className="md:col-span-1 space-y-2">
                        <Label htmlFor="province">Provincia</Label>
                        <Input 
                        id="province" 
                        value={formData.province}
                        onChange={(e) => setFormData({...formData, province: e.target.value})}
                        placeholder="MI"
                        maxLength={2}
                        className="uppercase"
                        />
                    </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vatNumber">Partita IVA / Codice Fiscale</Label>
                  <Input 
                    id="vatNumber" 
                    value={formData.vatNumber}
                    onChange={(e) => setFormData({...formData, vatNumber: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefono</Label>
                  <Input 
                    id="phone" 
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salva Committente
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
