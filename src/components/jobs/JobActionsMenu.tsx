"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Menu, Pencil, QrCode, RefreshCcw, Trash2, Archive, Loader2 } from "lucide-react"
import { Job, Client, jobsApi, clientsApi } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/components/auth-provider"
import { notify } from "@/lib/notify"
import { JobPortalDialog } from "@/components/guest-sites/JobPortalDialog"
import { JobCategorySelector } from "@/components/jobs/JobCategorySelector"

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface JobActionsMenuProps {
  job: Job
  onJobUpdated: () => void
  onDownloadDocumentation: () => void
  downloading: boolean
  downloadLabel: string | null
}

// Un solo pulsante con tutte le azioni della commessa (modifica, portale ospiti, nuovo inizio, documentazione, eliminazione)
// e le relative finestre. Vale per tutte le pagine della commessa, non solo per i Dettagli.
export function JobActionsMenu({ job, onJobUpdated, onDownloadDocumentation, downloading, downloadLabel }: JobActionsMenuProps) {
  const router = useRouter()
  const { userRole } = useAuth()
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Job>>({})
  const [updateExistingMovements, setUpdateExistingMovements] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [isLoadingClients, setIsLoadingClients] = useState(false)

  // Portale ospiti: dal menu, oppure proposto quando la commessa passa a completata
  const [portalOpen, setPortalOpen] = useState(false)
  const [portalReason, setPortalReason] = useState<"completed" | "manual">("manual")

  const handleEditClick = async () => {
    setEditForm({
      name: job.name,
      description: job.description,
      status: job.status,
      siteAddress: job.siteAddress || '',
      siteManager: job.siteManager || '',
      startDate: job.startDate,
      endDate: job.endDate,
      cig: job.cig || '',
      cup: job.cup || '',
      clientId: job.clientId,
      createdAt: job.createdAt,
      category: job.category || 'fornitura_posa'
    })
    setUpdateExistingMovements(false)
    setIsEditOpen(true)
    setIsLoadingClients(true)
    try {
      const data = await clientsApi.getAll()
      setClients(data)
    } catch {
      notify.error("Errore nel caricamento dei committenti")
    } finally {
      setIsLoadingClients(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      const becomesCompleted = job.status !== 'completed' && editForm.status === 'completed'
      // Completata: la fine cantiere diventa il giorno del cambio di stato (salvo che l'abbia modificata a mano)
      const payload = becomesCompleted && editForm.endDate === job.endDate ? { ...editForm, endDate: todayIso() } : editForm
      await jobsApi.update(job.id, payload, updateExistingMovements)
      setIsEditOpen(false)
      if (becomesCompleted && (userRole === 'admin' || userRole === 'operativo')) {
        setPortalReason("completed")
        setPortalOpen(true)
      }
      onJobUpdated()
    } catch (error) {
      console.error("Failed to update job", error)
      notify.error("Errore durante l'aggiornamento della commessa")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await jobsApi.delete(job.id)
      router.push('/jobs')
    } catch (error: any) {
      console.error("Failed to delete job", error)
      notify.error(error?.message || "Errore durante l'eliminazione della commessa")
    }
  }

  if (userRole !== 'admin' && userRole !== 'operativo') return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 px-2 md:px-3" aria-label="Azioni della commessa">
            <Menu className="h-4 w-4" />
            <span className="hidden md:inline">Azioni</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onClick={handleEditClick}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifica
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setPortalReason("manual"); setPortalOpen(true) }}>
            <QrCode className="mr-2 h-4 w-4" />
            Portale ospiti
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/jobs/new?clone=${job.id}`)}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Nuovo inizio cantiere
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDownloadDocumentation} disabled={downloading}>
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
            {downloading ? (downloadLabel || "Preparazione...") : "Scarica documentazione"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Elimina commessa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Commessa</DialogTitle>
            <DialogDescription>
              Modifica i dettagli della commessa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <JobCategorySelector
              value={editForm.category || 'fornitura_posa'}
              onChange={(category) => setEditForm({ ...editForm, category })}
            />

            <div className="space-y-2">
              <Label htmlFor="committente">Committente *</Label>
              <Select
                value={editForm.clientId || ""}
                onValueChange={(value) => setEditForm({ ...editForm, clientId: value })}
                disabled={isLoadingClients}
              >
                <SelectTrigger id="committente">
                  <SelectValue placeholder={isLoadingClients ? "Caricamento..." : "Seleziona committente"} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editForm.clientId !== job.clientId && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Attenzione: cambiare il committente aggiornerà automaticamente tutte le movimentazioni e bolle associate.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome Commessa *</Label>
              <Input
                id="name"
                value={editForm.name || ""}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={editForm.description || ""}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Stato</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value: any) => setEditForm({ ...editForm, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona stato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">In Lavorazione</SelectItem>
                    <SelectItem value="suspended">Sospesa</SelectItem>
                    <SelectItem value="completed">Completata</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="siteManager">Responsabile Cantiere</Label>
                <Input
                  id="siteManager"
                  value={editForm.siteManager || ""}
                  onChange={(e) => setEditForm({ ...editForm, siteManager: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteAddress">Indirizzo Cantiere</Label>
              <Input
                id="siteAddress"
                value={editForm.siteAddress || ""}
                onChange={(e) => setEditForm({ ...editForm, siteAddress: e.target.value })}
                placeholder="Via, Città..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inizio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={editForm.startDate ? (typeof editForm.startDate === 'string' ? editForm.startDate.split('T')[0] : '') : ""}
                  onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Fine</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={editForm.endDate ? (typeof editForm.endDate === 'string' ? editForm.endDate.split('T')[0] : '') : ""}
                  onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="createdAt">Data Creazione Commessa</Label>
              <Input
                id="createdAt"
                type="date"
                value={editForm.createdAt ? (typeof editForm.createdAt === 'string' ? editForm.createdAt.split('T')[0] : '') : ""}
                onChange={(e) => setEditForm({ ...editForm, createdAt: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cig">CIG</Label>
                <Input
                  id="cig"
                  value={editForm.cig || ""}
                  onChange={(e) => setEditForm({ ...editForm, cig: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cup">CUP</Label>
                <Input
                  id="cup"
                  value={editForm.cup || ""}
                  onChange={(e) => setEditForm({ ...editForm, cup: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t mt-2">
              <Checkbox
                id="updateMovements"
                checked={updateExistingMovements}
                onCheckedChange={(checked) => setUpdateExistingMovements(checked as boolean)}
              />
              <label
                htmlFor="updateMovements"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Aggiorna CIG/CUP nelle note delle bolle esistenti
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Annulla</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
              Salva Modifiche
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elimina Commessa</DialogTitle>
            <DialogDescription>
              Sei sicuro di voler eliminare la commessa <strong>{job.name}</strong>?
              <br />
              La commessa verrà spostata nel Cestino e potrà essere ripristinata dagli admin entro 30 giorni. L'eliminazione è bloccata se la commessa ha movimenti o acquisti collegati.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleDelete}>Elimina</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <JobPortalDialog jobId={job.id} open={portalOpen} onOpenChange={setPortalOpen} reason={portalReason} />
    </>
  )
}
