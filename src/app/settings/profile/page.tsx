"use client"

import { notify } from "@/lib/notify";;

import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth-provider";
import { Loader2, Eye, EyeOff, Lock } from "lucide-react";

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

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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
      notify.error("Errore nel caricamento del profilo");
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
      notify.success("Profilo aggiornato con successo!");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      notify.error("Errore durante il salvataggio: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    // Validation
    if (!currentPassword) {
      notify.error("Inserisci la password attuale");
      return;
    }
    if (!newPassword) {
      notify.error("Inserisci la nuova password");
      return;
    }
    if (newPassword.length < 6) {
      notify.error("La nuova password deve avere almeno 6 caratteri");
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.error("Le password non coincidono");
      return;
    }
    if (currentPassword === newPassword) {
      notify.error("La nuova password deve essere diversa da quella attuale");
      return;
    }

    setChangingPassword(true);
    try {
      // First verify the current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email,
        password: currentPassword,
      });

      if (signInError) {
        notify.error("Password attuale non corretta");
        return;
      }

      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Clear password fields on success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify.success("Password aggiornata con successo!");
    } catch (error: any) {
      console.error("Error changing password:", error);
      notify.error("Errore durante il cambio password: " + error.message);
    } finally {
      setChangingPassword(false);
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
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Cambia Password
          </CardTitle>
          <CardDescription>
            Modifica la tua password di accesso. La nuova password deve avere almeno 6 caratteri.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {/* Current Password */}
            <div className="grid gap-2">
              <Label htmlFor="currentPassword">Password Attuale</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Inserisci la password attuale"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* New Password */}
            <div className="grid gap-2">
              <Label htmlFor="newPassword">Nuova Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Inserisci la nuova password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {newPassword && newPassword.length < 6 && (
                <p className="text-xs text-destructive">
                  La password deve avere almeno 6 caratteri
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Conferma Nuova Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Conferma la nuova password"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-destructive">
                  Le password non coincidono
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handlePasswordChange}
              disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
              className="bg-primary hover:bg-primary/90"
            >
              {changingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cambia Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
