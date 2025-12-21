"use client";

import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { Loader2 } from "lucide-react";

export default function SettingsProfilePage() {
  const { user } = useAuth();
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Profile State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Get basic auth data
      setEmail(user.email || "");

      // 2. Get profile data
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile:", error);
      }

      if (profile) {
        setFullName(profile.full_name || "");
        setRole(profile.role || "user");
        // Always set avatar based on role
        setAvatarUrl(`/avatars/${profile.role || 'user'}.png`);
      } else {
        // Fallback if no profile exists yet (shouldn't happen with our trigger)
        setRole("user");
        setAvatarUrl('/avatars/user.png');
      }
    } catch (error) {
      console.error("Unexpected error:", error);
    } finally {
      setLoading(false);
    }
  };

  // Removed handleImageUpload as it's no longer allowed

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName,
          updated_at: new Date().toISOString(),
          // Don't update role here for security, handled by admin
        });

      if (error) throw error;
      alert("Profilo aggiornato con successo!");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      alert("Errore durante il salvataggio: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profilo</h3>
        <p className="text-sm text-muted-foreground">
          Gestisci le tue informazioni personali.
        </p>
      </div>
      <Separator />

      <Card>
        <CardHeader>
            <CardTitle>Informazioni Utente</CardTitle>
            <CardDescription>
                Visualizza la tua foto profilo (basata sul ruolo) e aggiorna i dettagli personali.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                    <AvatarImage src={avatarUrl || ""} />
                    <AvatarFallback className="text-lg bg-primary/10 text-primary">
                      {email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                    <div className="text-sm font-medium">Immagine Profilo</div>
                    <p className="text-xs text-muted-foreground">
                        L'immagine del profilo è assegnata automaticamente in base al tuo ruolo ({role}).
                    </p>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                    <Label htmlFor="name">Nome Completo</Label>
                    <Input 
                      id="name" 
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Il tuo nome"
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      value={email} 
                      disabled 
                      className="opacity-50 cursor-not-allowed" // Better dark mode handling
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="role">Ruolo</Label>
                    <Input 
                      id="role" 
                      value={role.toUpperCase()} 
                      disabled 
                      className="opacity-50 cursor-not-allowed font-mono"
                    />
                </div>
            </div>
            
            <div className="flex justify-end">
                <Button 
                  className="bg-primary hover:bg-primary/90" 
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salva Modifiche
                </Button>
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Sicurezza</CardTitle>
            <CardDescription>
                La gestione della password è gestita tramite provider di autenticazione.
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se hai effettuato l'accesso tramite email/password, puoi richiedere il reset della password dalla pagina di login.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}
