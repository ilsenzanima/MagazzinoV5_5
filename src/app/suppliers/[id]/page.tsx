"use client"

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Save, Pencil, X } from "lucide-react";
import Link from "next/link";
import { suppliersApi, Supplier } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/components/auth-provider";

export default function SupplierDetailPage() {
  const { userRole } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    vatNumber: "",
    email: "",
    phone: ""
  });

  useEffect(() => {
    if (id) {
      loadSupplier();
    }
  }, [id]);

  const loadSupplier = async () => {
    try {
      setLoading(true);
      const data = await suppliersApi.getById(id);
      setSupplier(data);
      setFormData({
        name: data.name,
        address: data.address || "",
        vatNumber: data.vatNumber || "",
        email: data.email || "",
        phone: data.phone || ""
      });
    } catch (error) {
      console.error("Error loading supplier:", error);
      alert("Errore durante il caricamento del fornitore");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      const updated = await suppliersApi.update(id, formData);
      setSupplier(updated);
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error("Error updating supplier:", error);
      alert("Errore durante l'aggiornamento del fornitore");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500">Caricamento fornitore...</span>
        </div>
      </DashboardLayout>
    );
  }

  if (!supplier) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h2 className="text-xl font-bold text-slate-900">Fornitore non trovato</h2>
          <Link href="/suppliers" className="text-blue-600 hover:underline mt-4 inline-block">
            Torna alla lista
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/suppliers" className="flex items-center text-slate-500 hover:text-slate-900 mb-2">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Torna ai Fornitori
            </Link>
            <h1 className="text-2xl font-bold text-slate-900">
                {isEditing ? "Modifica Fornitore" : supplier.name}
            </h1>
          </div>
          {!isEditing && (userRole === 'admin' || userRole === 'operativo') && (
            <Button onClick={() => setIsEditing(true)} variant="outline">
                <Pencil className="mr-2 h-4 w-4" />
                Modifica
            </Button>
          )}
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
                  placeholder="Inserisci il nome dell'azienda o del fornitore"
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Indirizzo Sede</Label>
                <Textarea 
                  id="address" 
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Via Roma 10, 00100 Roma (RM)"
                  className="min-h-[80px]"
                  disabled={!isEditing}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vatNumber">Partita IVA / Codice Fiscale</Label>
                  <Input 
                    id="vatNumber" 
                    value={formData.vatNumber}
                    onChange={(e) => setFormData({...formData, vatNumber: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefono</Label>
                  <Input 
                    id="phone" 
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    disabled={!isEditing}
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
                  disabled={!isEditing}
                />
              </div>

              {isEditing && (
                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => {
                        setIsEditing(false);
                        setFormData({
                            name: supplier.name,
                            address: supplier.address || "",
                            vatNumber: supplier.vatNumber || "",
                            email: supplier.email || "",
                            phone: supplier.phone || ""
                        });
                    }}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Annulla
                  </Button>
                  <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvataggio...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Salva Modifiche
                      </>
                    )}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
