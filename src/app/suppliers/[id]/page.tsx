"use client"

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Save, Pencil, X, Trash2, Plus, Mail, Phone, Globe, FileText } from "lucide-react";
import { suppliersApi, SupplierOverview, SupplierContact } from "@/lib/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/components/auth-provider";
import { SupplierDeleteDialog } from "@/components/suppliers";
import { KindBadge } from "@/components/purchases/KindBadge";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { purchaseDocumentsApi, PurchaseDocument } from "@/lib/services/purchase-documents";
import { notify } from "@/lib/notify";
import { formatCurrency } from "@/lib/utils/format";

const DOCS_PAGE_SIZE = 25;
const CURRENT_YEAR = new Date().getFullYear();

const EMPTY_FORM = { name: "", address: "", vatNumber: "", email: "", phone: "", pec: "", website: "", paymentTerms: "", notes: "" };
const EMPTY_CONTACT = { name: "", role: "", email: "", phone: "", notes: "" };

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("it-IT") : "—");

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
        <div className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function SupplierDetailPage() {
  const { userRole } = useAuth();
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const canView = userRole === 'admin' || userRole === 'operativo';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState<SupplierOverview | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<SupplierContact | null>(null);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [savingContact, setSavingContact] = useState(false);

  const [docs, setDocs] = useState<PurchaseDocument[]>([]);
  const [docsTotal, setDocsTotal] = useState(0);
  const [docsPage, setDocsPage] = useState(1);
  const [docsLoading, setDocsLoading] = useState(false);

  const toForm = (s: SupplierOverview) => ({
    name: s.name, address: s.address || "", vatNumber: s.vatNumber || "", email: s.email || "", phone: s.phone || "",
    pec: s.pec || "", website: s.website || "", paymentTerms: s.paymentTerms || "", notes: s.notes || "",
  });

  // Solo admin e operativi vedono i fornitori
  useEffect(() => {
    if (userRole && !canView) router.push("/dashboard");
  }, [userRole, canView, router]);

  const loadSupplier = useCallback(async () => {
    try {
      setLoading(true);
      const [data, list] = await Promise.all([suppliersApi.getOverviewById(id), suppliersApi.getContacts(id)]);
      setSupplier(data);
      setFormData(toForm(data));
      setContacts(list);
    } catch (error) {
      console.error("Error loading supplier:", error);
      notify.error("Errore durante il caricamento del fornitore");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id && canView) loadSupplier();
  }, [id, canView, loadSupplier]);

  const loadDocs = useCallback(async () => {
    try {
      setDocsLoading(true);
      const { data, total } = await purchaseDocumentsApi.getPaginated({ page: docsPage, limit: DOCS_PAGE_SIZE, supplierId: id });
      setDocs(data);
      setDocsTotal(total);
    } catch (error) {
      console.error("Error loading supplier documents:", error);
      notify.error("Errore nel caricamento di acquisti e fatture");
    } finally {
      setDocsLoading(false);
    }
  }, [id, docsPage]);

  useEffect(() => {
    if (id && canView) loadDocs();
  }, [id, canView, loadDocs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await suppliersApi.update(id, formData);
      await loadSupplier();
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      console.error("Error updating supplier:", error);
      notify.error("Errore durante l'aggiornamento del fornitore");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      // Un fornitore con acquisti, ordini o fatture non si elimina
      const { total } = await purchaseDocumentsApi.getPaginated({ supplierId: id, limit: 1 });
      if (total > 0) {
        setDeleteOpen(false);
        notify.error("Il fornitore ha acquisti, ordini o fatture collegati: non si può eliminare.");
        return;
      }
      await suppliersApi.delete(id);
      router.push("/suppliers");
    } catch (error) {
      console.error("Failed to delete supplier:", error);
      notify.error("Errore durante l'eliminazione del fornitore.");
    }
  };

  const openContact = (c?: SupplierContact) => {
    setEditingContact(c ?? null);
    setContactForm(c ? { name: c.name, role: c.role || "", email: c.email || "", phone: c.phone || "", notes: c.notes || "" } : EMPTY_CONTACT);
    setContactOpen(true);
  };

  const handleSaveContact = async () => {
    if (!contactForm.name.trim()) { notify.warning("Il nome del contatto è obbligatorio"); return; }
    try {
      setSavingContact(true);
      await suppliersApi.saveContact(id, { ...contactForm, id: editingContact?.id });
      setContacts(await suppliersApi.getContacts(id));
      setContactOpen(false);
    } catch (error) {
      console.error("Failed to save contact:", error);
      notify.error("Errore durante il salvataggio del contatto");
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteContact = async (c: SupplierContact) => {
    if (!confirm(`Eliminare il contatto ${c.name}?`)) return;
    try {
      await suppliersApi.deleteContact(c.id);
      setContacts(prev => prev.filter(x => x.id !== c.id));
    } catch (error) {
      console.error("Failed to delete contact:", error);
      notify.error("Errore durante l'eliminazione del contatto");
    }
  };

  if (!canView || loading) {
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
          <Link href="/suppliers" className="text-blue-600 hover:underline mt-4 inline-block">Torna alla lista</Link>
        </div>
      </DashboardLayout>
    );
  }

  const field = (key: keyof typeof EMPTY_FORM, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input id={key} value={formData[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} disabled={!isEditing} {...props} />
    </div>
  );

  const docHref = (d: PurchaseDocument) => (d.kind === "invoice" ? `/invoices/${d.id}` : `/purchases/${d.id}`);
  const docNumber = (d: PurchaseDocument) => (d.kind === "invoice" ? d.invoice.invoiceNumber : d.purchase.deliveryNoteNumber);
  const docDate = (d: PurchaseDocument) => (d.kind === "invoice" ? d.invoice.invoiceDate : d.purchase.deliveryNoteDate);
  const docAmount = (d: PurchaseDocument) => (d.kind === "invoice" ? d.invoice.totalAmount : d.purchase.totalAmount);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link href="/suppliers" className="mb-2 flex items-center text-slate-500 hover:text-slate-900">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Torna ai Fornitori
            </Link>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
              {isEditing ? "Modifica Fornitore" : supplier.name}
              {supplier.isTechnical && (
                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-500">Tecnico</span>
              )}
            </h1>
            {supplier.isTechnical && (
              <p className="mt-1 text-sm text-slate-500">Voce di servizio per inserire dati incompleti di fornitori vecchi.</p>
            )}
          </div>
          {!isEditing && (
            <div className="flex w-full gap-2 sm:w-auto">
              <Button onClick={() => setIsEditing(true)} variant="outline" className="flex-1 sm:flex-none">
                <Pencil className="mr-2 h-4 w-4" />
                Modifica
              </Button>
              {!supplier.isTechnical && (
                <Button onClick={() => setDeleteOpen(true)} variant="outline" className="flex-1 text-red-600 hover:text-red-700 sm:flex-none">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Elimina
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Acquisti" value={String(supplier.purchasesCount)} />
          <Kpi label="Ultimo acquisto" value={fmtDate(supplier.lastPurchaseDate)} />
          <Kpi label={`Speso ${CURRENT_YEAR}`} value={formatCurrency(supplier.spentYear)} />
          <Kpi label="Speso in totale" value={formatCurrency(supplier.spentTotal)} />
        </div>

        <Tabs defaultValue="anagrafica">
          <TabsList>
            <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
            <TabsTrigger value="contatti">Contatti{contacts.length > 0 ? ` (${contacts.length})` : ""}</TabsTrigger>
            <TabsTrigger value="documenti">Acquisti e fatture</TabsTrigger>
          </TabsList>

          <TabsContent value="anagrafica" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Dettagli Anagrafici</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {field("name", "Ragione Sociale / Nome *", { required: true, placeholder: "Inserisci il nome dell'azienda o del fornitore" })}

                  <div className="space-y-2">
                    <Label htmlFor="address">Indirizzo Sede</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Via Roma 10, 00100 Roma (RM)"
                      className="min-h-[80px]"
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {field("vatNumber", "Partita IVA / Codice Fiscale")}
                    {field("phone", "Telefono", { type: "tel" })}
                    {field("email", "Email", { type: "email" })}
                    {field("pec", "PEC", { type: "email" })}
                    {field("website", "Sito web", { placeholder: "https://" })}
                    {field("paymentTerms", "Condizioni di pagamento", { placeholder: "Es. bonifico 30 gg data fattura" })}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Note</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="min-h-[80px]"
                      disabled={!isEditing}
                    />
                  </div>

                  {isEditing && (
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="ghost" onClick={() => { setIsEditing(false); setFormData(toForm(supplier)); }}>
                        <X className="mr-2 h-4 w-4" />
                        Annulla
                      </Button>
                      <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                        {saving ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvataggio...</>) : (<><Save className="mr-2 h-4 w-4" />Salva Modifiche</>)}
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contatti" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Contatti</CardTitle>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openContact()}>
                  <Plus className="mr-2 h-4 w-4" />Nuovo contatto
                </Button>
              </CardHeader>
              <CardContent>
                {contacts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">
                    Nessun contatto. Aggiungi il referente commerciale, l&apos;amministrazione o l&apos;agente.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {contacts.map(c => (
                      <div key={c.id} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">{c.name}</div>
                            {c.role && <div className="text-xs text-slate-500">{c.role}</div>}
                          </div>
                          <div className="flex shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Modifica contatto" onClick={() => openContact(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" aria-label="Elimina contatto" onClick={() => handleDeleteContact(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          {c.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /><a href={`mailto:${c.email}`} className="truncate text-blue-600 hover:underline">{c.email}</a></div>}
                          {c.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /><a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a></div>}
                          {c.notes && <div className="text-xs text-slate-500">{c.notes}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {(supplier.email || supplier.phone || supplier.pec || supplier.website) && (
                  <div className="mt-4 border-t pt-3 text-xs text-slate-500">
                    <span className="font-medium">Recapiti generali: </span>
                    {[supplier.email, supplier.phone, supplier.pec && `PEC ${supplier.pec}`].filter(Boolean).join(" · ")}
                    {supplier.website && <span className="ml-2 inline-flex items-center gap-1"><Globe className="h-3 w-3" />{supplier.website}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documenti" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Acquisti, ordini e fatture</CardTitle></CardHeader>
              <CardContent>
                {docsLoading && docs.length === 0 ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
                ) : (
                  <div className={docsLoading ? "opacity-60" : ""}>
                    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                      <Table className="border-collapse">
                        <TableHeader>
                          <TableRow className="bg-slate-100 hover:bg-slate-100 dark:bg-muted">
                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tipo</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Numero</TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-600">Data</TableHead>
                            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-600">Importo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {docs.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="py-8 text-center text-slate-400">
                                <FileText className="mx-auto mb-2 h-10 w-10 opacity-20" />
                                Nessun documento per questo fornitore
                              </TableCell>
                            </TableRow>
                          ) : docs.map(d => (
                            <TableRow key={`${d.kind}-${d.id}`} className="cursor-pointer" onClick={() => router.push(docHref(d))}>
                              <TableCell className="py-2"><KindBadge kind={d.kind} /></TableCell>
                              <TableCell className="py-2 font-medium">{docNumber(d)}</TableCell>
                              <TableCell className="py-2 text-sm text-slate-600 dark:text-slate-300">{fmtDate(docDate(d))}</TableCell>
                              <TableCell className="py-2 text-right text-sm font-semibold">{docAmount(d) != null ? formatCurrency(Number(docAmount(d))) : "—"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <PaginationControls
                      page={docsPage}
                      totalPages={Math.ceil(docsTotal / DOCS_PAGE_SIZE) || 1}
                      loading={docsLoading}
                      onPageChange={setDocsPage}
                      totalItems={docsTotal}
                      itemLabel="documenti"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <SupplierDeleteDialog supplier={supplier} open={deleteOpen} onOpenChange={setDeleteOpen} onConfirm={handleDelete} />

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingContact ? "Modifica contatto" : "Nuovo contatto"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={contactForm.name} onChange={e => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Nome e cognome" />
            </div>
            <div className="space-y-1">
              <Label>Ruolo</Label>
              <Input value={contactForm.role} onChange={e => setContactForm({ ...contactForm, role: e.target.value })} placeholder="Es. Commerciale, Amministrazione, Agente" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={contactForm.email} onChange={e => setContactForm({ ...contactForm, email: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Telefono</Label>
                <Input type="tel" value={contactForm.phone} onChange={e => setContactForm({ ...contactForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Note</Label>
              <Textarea value={contactForm.notes} onChange={e => setContactForm({ ...contactForm, notes: e.target.value })} className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)}>Annulla</Button>
            <Button onClick={handleSaveContact} disabled={savingContact} className="bg-blue-600 hover:bg-blue-700">
              {savingContact && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
