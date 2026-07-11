import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ensureFileLinkShareable } from "@/lib/google-drive";
import { isImageFileType } from "@/lib/image-file-types";

// Helper per generare Signed URL per i file salvati su Supabase Storage o link a Google Drive
async function createSignedUrl(admin: any, fileUrl: string, fileType?: string | null): Promise<string> {
    if (!fileUrl) return "";
    // Se è un ID di Drive (es. non contiene '/'): l'endpoint /api/drive/download richiede una
    // sessione Supabase, che un ospite anonimo non ha mai. Rendiamo il file leggibile da chiunque
    // abbia il link. Le immagini passano dal nostro proxy (serve i byte da 'self', rispettando la
    // CSP img-src e permettendo l'uso in <img> per la galleria); gli altri file aprono il viewer
    // di Drive in anteprima nel browser invece di forzare il download (come uc?export=download).
    if (!fileUrl.includes("/")) {
        try {
            await ensureFileLinkShareable(fileUrl);
            if (isImageFileType(fileType)) {
                return `/api/guest/drive-image?fileId=${encodeURIComponent(fileUrl)}`;
            }
            return `https://drive.google.com/file/d/${encodeURIComponent(fileUrl)}/view`;
        } catch {
            return "";
        }
    }
    try {
        const path = fileUrl.split("/public/documents/")[1];
        if (!path) return fileUrl;
        const { data, error } = await admin.storage.from("documents").createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) return fileUrl;
        return data.signedUrl;
    } catch {
        return fileUrl;
    }
}

// Helper per estrarre in modo sicuro il campo 'name' da relazioni che possono essere oggetti o array di oggetti
function getRelationName(rel: any): string {
    if (!rel) return "";
    if (Array.isArray(rel)) {
        return rel[0]?.name || "";
    }
    return rel.name || "";
}

// Rate limiting anti brute-force: nessuna infrastruttura Redis/KV disponibile,
// quindi i tentativi vengono tracciati su tabella Supabase (persistente tra invocazioni serverless)
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_ATTEMPTS_PER_SITE_IP = 8;
const MAX_ATTEMPTS_PER_IP = 30;

function getClientIp(req: NextRequest): string {
    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();
    return req.headers.get("x-real-ip") || "unknown";
}

async function isRateLimited(admin: any, siteId: string, ip: string): Promise<boolean> {
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

    const [{ count: siteIpCount }, { count: ipCount }] = await Promise.all([
        admin
            .from("guest_login_attempts")
            .select("id", { count: "exact", head: true })
            .eq("guest_site_id", siteId)
            .eq("ip_address", ip)
            .eq("success", false)
            .gte("created_at", since),
        admin
            .from("guest_login_attempts")
            .select("id", { count: "exact", head: true })
            .eq("ip_address", ip)
            .eq("success", false)
            .gte("created_at", since),
    ]);

    return (siteIpCount ?? 0) >= MAX_ATTEMPTS_PER_SITE_IP || (ipCount ?? 0) >= MAX_ATTEMPTS_PER_IP;
}

async function recordAttempt(admin: any, siteId: string | null, ip: string, success: boolean): Promise<void> {
    await admin.from("guest_login_attempts").insert({ guest_site_id: siteId, ip_address: ip, success });
}

export async function POST(req: NextRequest) {
    try {
        const { siteId, passcode } = await req.json();

        if (!siteId || !passcode) {
            return NextResponse.json({ error: "Parametri mancanti" }, { status: 400 });
        }

        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
            return NextResponse.json({ error: "Configurazione server errata" }, { status: 500 });
        }

        // Creazione client admin con service role per bypassare RLS
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
            auth: { persistSession: false },
        });

        const clientIp = getClientIp(req);

        if (await isRateLimited(admin, siteId, clientIp)) {
            return NextResponse.json(
                { error: "Troppi tentativi falliti. Riprova tra qualche minuto." },
                { status: 429 }
            );
        }

        // 1. Valida il cantiere ospite e il passcode
        const { data: site, error: siteError } = await admin
            .from("guest_sites")
            .select("*")
            .eq("id", siteId)
            .eq("passcode", passcode)
            .is("deleted_at", null)
            .maybeSingle();

        if (siteError) throw siteError;
        if (!site) {
            await recordAttempt(admin, siteId, clientIp, false);
            return NextResponse.json({ error: "Credenziali non valide" }, { status: 401 });
        }

        await recordAttempt(admin, siteId, clientIp, true);

        // 2. Recupera le commesse associate al cantiere (storico)
        const { data: associations, error: assocError } = await admin
            .from("guest_site_jobs")
            .select(`
                id,
                custom_notes,
                job_id,
                jobs (
                    id,
                    code,
                    name,
                    description,
                    start_date,
                    end_date,
                    site_address,
                    status
                )
            `)
            .eq("guest_site_id", siteId)
            .is("deleted_at", null)
            .order("created_at", { ascending: true });

        if (assocError) throw assocError;

        const jobsData = [];

        // 3. Per ciascuna commessa, estrae i documenti delle 3 categorie
        for (const assoc of (associations || [])) {
            const job = assoc.jobs as any;
            if (!job) continue;

            const jobId = job.id;

            // --- CATEGORIA 1: Documenti Personalizzati (conformità propria della commessa) ---
            const [rawJobDocsResult, jobFoldersResult] = await Promise.all([
                admin
                    .from("job_documents")
                    .select(`
                        id, name, notes, file_url, file_type, file_size, category, created_at,
                        conformita_document_type_id, folder_id,
                        job_conformita_document_types (name),
                        job_site_document_types (name)
                    `)
                    .eq("job_id", jobId)
                    .eq("category", "conformita"),
                admin
                    .from("job_document_folders")
                    .select("id, document_type_id, name")
                    .eq("job_id", jobId)
                    .is("deleted_at", null),
            ]);

            if (rawJobDocsResult.error) throw rawJobDocsResult.error;
            if (jobFoldersResult.error) throw jobFoldersResult.error;

            const rawJobDocs = rawJobDocsResult.data;
            const folderNameById = new Map<string, string>(
                (jobFoldersResult.data || []).map((f: any) => [f.id, f.name])
            );

            const customDocEntries = await Promise.all((rawJobDocs || []).map(async (doc: any) => {
                const signedUrl = await createSignedUrl(admin, doc.file_url, doc.file_type);
                const typeName = getRelationName(doc.job_conformita_document_types) ||
                                 getRelationName(doc.job_site_document_types) ||
                                 "Generico";

                return {
                    id: doc.id,
                    name: doc.name,
                    notes: doc.notes,
                    fileUrl: signedUrl,
                    fileType: doc.file_type,
                    fileSize: doc.file_size,
                    typeName,
                    typeId: doc.conformita_document_type_id as string | null,
                    folderId: doc.folder_id as string | null,
                    createdAt: doc.created_at,
                };
            }));

            // Raggruppa: Tipo documento -> Cartella (o "senza cartella") -> documenti,
            // rispecchiando la stessa struttura usata nella gestione conformità della commessa.
            const typeOrder: string[] = [];
            const typeGroups = new Map<string, { typeId: string | null; typeName: string; folderOrder: string[]; folders: Map<string, { folderId: string | null; folderName: string | null; documents: typeof customDocEntries }> }>();

            for (const doc of customDocEntries) {
                const typeKey = doc.typeId || "__untyped__";
                if (!typeGroups.has(typeKey)) {
                    typeGroups.set(typeKey, { typeId: doc.typeId, typeName: doc.typeName, folderOrder: [], folders: new Map() });
                    typeOrder.push(typeKey);
                }
                const typeGroup = typeGroups.get(typeKey)!;
                const folderKey = doc.folderId || "__root__";
                if (!typeGroup.folders.has(folderKey)) {
                    typeGroup.folders.set(folderKey, {
                        folderId: doc.folderId,
                        folderName: doc.folderId ? (folderNameById.get(doc.folderId) || "Cartella") : null,
                        documents: [],
                    });
                    typeGroup.folderOrder.push(folderKey);
                }
                typeGroup.folders.get(folderKey)!.documents.push(doc);
            }

            const customDocuments = typeOrder.map(typeKey => {
                const g = typeGroups.get(typeKey)!;
                return {
                    typeId: g.typeId,
                    typeName: g.typeName,
                    folders: g.folderOrder.map(folderKey => g.folders.get(folderKey)!),
                };
            });

            // --- CATEGORIA 2: Documenti Associati (conformità fornitori) ---
            // Nota: la tabella storica "job_compliance_associations" è stata sostituita da
            // "shared_compliance_associations" (condivisa tra proposte e commesse) e non contiene più dati.
            const { data: rawAssocDocs, error: assocDocsError } = await admin
                .from("shared_compliance_associations")
                .select(`
                    id, custom_name, custom_notes, created_at,
                    supplier_compliance_documents (
                        id, name, file_url, file_size, notes, created_at,
                        suppliers (name),
                        compliance_document_types (name)
                    )
                `)
                .eq("job_id", jobId)
                .is("deleted_at", null);

            if (assocDocsError) throw assocDocsError;

            const associatedDocuments = (await Promise.all((rawAssocDocs || []).map(async (assocDoc: any) => {
                const doc = assocDoc.supplier_compliance_documents as any;
                if (!doc) return null;
                const signedUrl = await createSignedUrl(admin, doc.file_url);
                const fileExt = (doc.file_url || "").split(".").pop()?.toLowerCase() || "pdf";
                return {
                    id: assocDoc.id,
                    name: assocDoc.custom_name || doc.name,
                    notes: assocDoc.custom_notes || doc.notes,
                    fileUrl: signedUrl,
                    fileType: fileExt,
                    fileSize: doc.file_size,
                    supplierName: getRelationName(doc.suppliers) || "Sconosciuto",
                    typeName: getRelationName(doc.compliance_document_types) || "Generico",
                    createdAt: assocDoc.created_at,
                };
            }))).filter(Boolean);

            // --- CATEGORIA 3: Documenti DDT/Bolle ---
            
            // A. Trova i purchase_id collegati alla commessa per tracciare i DDT
            const [directPurchases, itemPurchases, deliveryItems, manuallyAssociatedPurchases] = await Promise.all([
                admin.from("purchases").select("id, delivery_note_number, document_urls").eq("job_id", jobId).is("deleted_at", null),
                admin.from("purchase_items").select("purchase_id").eq("job_id", jobId),
                admin
                    .from("delivery_note_items")
                    .select("purchase_item_id, delivery_notes!inner(job_id)")
                    .eq("delivery_notes.job_id", jobId)
                    .not("purchase_item_id", "is", null),
                admin.from("purchases").select("id, delivery_note_number, document_urls").like("notes", `%[associated_job:${jobId}]%`).is("deleted_at", null),
            ]);

            if (directPurchases.error) throw directPurchases.error;
            if (itemPurchases.error) throw itemPurchases.error;
            if (deliveryItems.error) throw deliveryItems.error;
            if (manuallyAssociatedPurchases.error) throw manuallyAssociatedPurchases.error;

            const purchaseIds = new Set<string>();
            const purchaseMap = new Map<string, any>(); // Per mappare id acquisto a numero DDT
            // Solo gli acquisti associati manualmente dalla sezione DDT/Bolle alimentano
            // i certificati di conformità automatici (categoria "Conf. Ass. DDT").
            const purchaseIdsForCompliance = new Set<string>();

            (directPurchases.data || []).forEach((p: any) => {
                purchaseIds.add(p.id);
                purchaseMap.set(p.id, p);
            });
            (manuallyAssociatedPurchases.data || []).forEach((p: any) => {
                purchaseIds.add(p.id);
                purchaseMap.set(p.id, p);
                purchaseIdsForCompliance.add(p.id);
            });
            (itemPurchases.data || []).forEach((pi: any) => {
                if (pi.purchase_id) purchaseIds.add(pi.purchase_id);
            });

            const purchaseItemIds = (deliveryItems.data || []).map((d: any) => d.purchase_item_id).filter(Boolean);
            if (purchaseItemIds.length > 0) {
                const { data: piRows, error: piError } = await admin
                    .from("purchase_items")
                    .select("id, purchase_id")
                    .in("id", purchaseItemIds);
                if (piError) throw piError;
                (piRows || []).forEach((pi: any) => {
                    if (pi.purchase_id) purchaseIds.add(pi.purchase_id);
                });
            }

            const ddtDocuments = [];

            if (purchaseIdsForCompliance.size > 0) {
                // Documenti di conformità legati agli acquisti associati manualmente (da DDT/Bolle)
                const { data: supplierDocs, error: supplierDocsError } = await admin
                    .from("supplier_compliance_documents")
                    .select(`
                        id, name, file_url, file_size, notes, created_at, purchase_id,
                        suppliers (name),
                        compliance_document_types (name)
                    `)
                    .in("purchase_id", Array.from(purchaseIdsForCompliance))
                    .is("deleted_at", null);

                if (supplierDocsError) throw supplierDocsError;

                const supplierComplianceDocs = await Promise.all((supplierDocs || []).map(async (doc: any) => {
                    const signedUrl = await createSignedUrl(admin, doc.file_url);
                    // Cerca il numero DDT dell'acquisto
                    let ddtNumber = "";
                    const purch = purchaseMap.get(doc.purchase_id);
                    if (purch) {
                        ddtNumber = purch.delivery_note_number;
                    } else {
                        // Carica i dettagli dell'acquisto mancante
                        const { data: pDetail } = await admin.from("purchases").select("delivery_note_number").eq("id", doc.purchase_id).maybeSingle();
                        if (pDetail) ddtNumber = pDetail.delivery_note_number;
                    }

                    const fileExt = (doc.file_url || "").split(".").pop()?.toLowerCase() || "pdf";
                    return {
                        id: doc.id,
                        name: doc.name,
                        notes: doc.notes ? `DDT Fornitore: ${ddtNumber}. Note: ${doc.notes}` : `DDT Fornitore: ${ddtNumber}`,
                        fileUrl: signedUrl,
                        fileType: fileExt,
                        fileSize: doc.file_size,
                        supplierName: getRelationName(doc.suppliers) || "Sconosciuto",
                        typeName: getRelationName(doc.compliance_document_types) || "Conformità DDT",
                        createdAt: doc.created_at,
                        kind: "ddt_supplier_compliance",
                    };
                }));
                ddtDocuments.push(...supplierComplianceDocs);
            }

            if (purchaseIds.size > 0) {
                const purchaseIdList = Array.from(purchaseIds);

                // I file fisici dei DDT fornitore (i file pdf/immagini caricati all'acquisto)
                // Carichiamo tutti gli acquisti per ricavare i document_urls
                const { data: allPurchasesDetails, error: purchDetailsError } = await admin
                    .from("purchases")
                    .select("id, delivery_note_number, delivery_note_date, document_urls, suppliers(name)")
                    .in("id", purchaseIdList)
                    .is("deleted_at", null);

                if (purchDetailsError) throw purchDetailsError;

                const purchaseFileEntries: { purchase: any; url: string; docIndex: number }[] = [];
                for (const p of (allPurchasesDetails || [])) {
                    (p.document_urls || []).forEach((url: string, i: number) => {
                        purchaseFileEntries.push({ purchase: p, url, docIndex: i + 1 });
                    });
                }

                const purchaseFileDocuments = await Promise.all(purchaseFileEntries.map(async ({ purchase: p, url, docIndex }) => {
                    const signedUrl = await createSignedUrl(admin, url);
                    // Estrae l'estensione o tipo
                    const ext = (url || "").split(".").pop()?.toLowerCase() || "pdf";
                    const suppName = getRelationName(p.suppliers) || "Sconosciuto";
                    const formattedDate = p.delivery_note_date ? new Date(p.delivery_note_date).toLocaleDateString("it-IT") : "";
                    return {
                        id: `${p.id}-doc-${docIndex}`,
                        name: `DDT ${p.delivery_note_number}${formattedDate ? ` DEL ${formattedDate}` : ""}`,
                        notes: `Fornitore: ${suppName}`,
                        fileUrl: signedUrl,
                        fileType: ext,
                        fileSize: null,
                        supplierName: suppName,
                        typeName: "DDT Fornitore (Bolla)",
                        createdAt: p.delivery_note_date,
                        kind: "ddt_supplier_file",
                    };
                }));
                ddtDocuments.push(...purchaseFileDocuments);
            }

            // 3. Le bolle interne OPI (DDT OPI di tipo 'exit' e 'sale')
            const { data: opiDeliveryNotes, error: opiError } = await admin
                .from("delivery_notes")
                .select(`
                    id, number, date, type, causal, pickup_location, delivery_location, notes,
                    delivery_note_items (
                        id, quantity, pieces, coefficient,
                        inventory (name, model, code, unit)
                    )
                `)
                .eq("job_id", jobId)
                .in("type", ["exit", "sale"])
                .order("date", { ascending: false });

            if (opiError) throw opiError;

            const internalDeliveryNotes = (opiDeliveryNotes || []).map((dn: any) => ({
                id: dn.id,
                number: dn.number,
                date: dn.date,
                type: dn.type,
                causal: dn.causal,
                pickupLocation: dn.pickup_location,
                deliveryLocation: dn.delivery_location,
                notes: dn.notes,
                items: (dn.delivery_note_items || []).map((item: any) => ({
                    id: item.id,
                    quantity: item.quantity,
                    pieces: item.pieces,
                    coefficient: item.coefficient,
                    name: item.inventory?.name || "Articolo sconosciuto",
                    model: item.inventory?.model || "",
                    code: item.inventory?.code || "",
                    unit: item.inventory?.unit || "",
                })),
            }));

            jobsData.push({
                jobId,
                code: job.code,
                name: job.name,
                description: job.description,
                startDate: job.start_date,
                endDate: job.end_date,
                siteAddress: job.site_address,
                status: job.status,
                customNotes: assoc.custom_notes || "",
                documents: {
                    custom: customDocuments,
                    associated: associatedDocuments,
                    ddt: ddtDocuments,
                    internalNotes: internalDeliveryNotes,
                },
            });
        }

        return NextResponse.json({
            site: {
                id: site.id,
                name: site.name,
                address: site.address,
            },
            jobs: jobsData,
        });

    } catch (error: any) {
        console.error("Errore API Route ospiti:", error);
        return NextResponse.json({ error: "Errore interno del server: " + error.message }, { status: 500 });
    }
}
