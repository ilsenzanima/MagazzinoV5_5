"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    // Validation
    if (!email.endsWith("@opifiresafe.com")) {
      setError("La registrazione è consentita solo con email @opifiresafe.com");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("La password deve essere di almeno 6 caratteri");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Le password non coincidono");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      if (data.user) {
        setSuccess(true);
        // Optional: clear form
        setEmail("");
        setPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      setError(err.message || "Errore durante la registrazione");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Registrazione</CardTitle>
          <CardDescription className="text-center">
            Crea un nuovo account Magazzino V5.5
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-green-600">Registrazione Completata!</h3>
                <p className="text-sm text-muted-foreground">
                  Ti abbiamo inviato un'email di conferma. Controlla la tua casella di posta per attivare l'account.
                </p>
              </div>
              <Button asChild className="w-full mt-4">
                <Link href="/login">Vai al Login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email Aziendale</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="nome.cognome@opifiresafe.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Accettiamo solo email @opifiresafe.com
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimo 6 caratteri"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Ripeti la password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button className="w-full bg-blue-600 hover:bg-blue-700" type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrazione in corso...
                  </>
                ) : (
                  "Registrati"
                )}
              </Button>
            </form>
          )}
        </CardContent>
        {!success && (
          <CardFooter className="flex flex-col space-y-2 text-center text-sm text-muted-foreground">
            <div className="text-sm">
              Hai già un account?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Accedi qui
              </Link>
            </div>
            <Link href="/" className="hover:text-blue-600 underline">
              Torna alla Home
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
