"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle2, Loader2, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Creazione di un nuovo utente da parte di un admin (la registrazione libera non esiste piu')
export function CreateUserForm() {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [role, setRole] = useState<"user" | "operativo" | "admin">("user")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setCreated(null)

    if (!email.trim().toLowerCase().endsWith("@opifiresafe.com")) return setError("Sono ammesse solo email @opifiresafe.com")
    if (password.length < 6) return setError("La password deve essere di almeno 6 caratteri")
    if (password !== confirmPassword) return setError("Le password non coincidono")

    try {
      setLoading(true)
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, password, role }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Errore durante la creazione dell'utente")
      setCreated(email.trim().toLowerCase())
      setEmail(""); setFullName(""); setPassword(""); setConfirmPassword(""); setRole("user")
    } catch (err: any) {
      setError(err.message || "Errore durante la creazione dell'utente")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Nuovo utente</CardTitle>
        <CardDescription>
          Crea un account per un collaboratore. L&apos;account è attivo subito, senza email di conferma: comunica tu la password iniziale alla persona.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {created && (
            <Alert className="border-green-200 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>Utente <strong>{created}</strong> creato. Puoi cambiarne il ruolo in Impostazioni › Gestione utenti.</AlertDescription>
            </Alert>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="nu-email">Email aziendale</Label>
            <Input id="nu-email" type="email" placeholder="nome.cognome@opifiresafe.com" value={email} onChange={e => setEmail(e.target.value)} required />
            <p className="text-xs text-muted-foreground">Sono ammesse solo email @opifiresafe.com</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nu-name">Nome e cognome <span className="text-muted-foreground">(facoltativo)</span></Label>
            <Input id="nu-name" value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Ruolo</Label>
            <Select value={role} onValueChange={v => setRole(v as typeof role)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Utente standard (sola lettura)</SelectItem>
                <SelectItem value="operativo">Utente operativo (lettura/scrittura limitata)</SelectItem>
                <SelectItem value="admin">Admin (controllo completo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nu-pw">Password iniziale</Label>
              <Input id="nu-pw" type="password" placeholder="Minimo 6 caratteri" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nu-pw2">Conferma password</Label>
              <Input id="nu-pw2" type="password" placeholder="Ripeti la password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
          </div>
          <Button className="w-full bg-blue-600 hover:bg-blue-700" type="submit" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creazione in corso...</> : "Crea utente"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
