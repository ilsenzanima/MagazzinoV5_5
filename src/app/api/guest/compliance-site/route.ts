import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper per generare Signed URL per i file salvati su Supabase Storage o link a Google Drive
async function createSignedUrl(admin: any, fileUrl: string): Promise<string> {
    if (!fileUrl) return "";
    // Se è un ID di Drive (es. non contiene '/')
    if (!fileUrl.includes("/")) {
        return `/api/drive/download?fileId=${encodeURIComponent(fileUrl)}`;
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
            return NextResponse.json({ error: "Credenziali non valide" }, { status: 401 });
        }

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

            // --- CATEGORIA 1: Documenti Personalizzati (propri della commessa) ---
            const { data: rawJobDocs, error: jobDocsError } = await admin
                .from("job_documents")
                .select(`
                    id, name, notes, file_url, file_type, file_size, category, created_at,
                    job_conformita_document_types (name),
                    job_site_document_types (name)
                `)
                .eq("job_id", jobId)
                .eq("category", "conformita")
                .is("deleted_at", null);

            if (jobDocsError) throw jobDocsError;

            const customDocuments = [];
            for (const doc of (rawJobDocs || [])) {
                const signedUrl = await createSignedUrl(admin, doc.file_url);
                const typeName = getRelationName(doc.job_conformita_document_types) || 
                                 getRelationName(doc.job_site_document_types) || 
                                 "Generico";

                customDocuments.push({
                    id: doc.id,
                    name: doc.name,
                    notes: doc.notes,
                    fileUrl: signedUrl,
                    fileType: doc.file_type,
                    fileSize: doc.file_size,
                    typeName,
                    createdAt: doc.created_at,
                });
            }

            // --- CATEGORIA 2: Documenti Associati (conformità fornitori) ---
            const { data: rawAssocDocs, error: assocDocsError } = await admin
                .from("job_compliance_associations")
                .select(`
                    id, custom_name, custom_notes, created_at,
                    supplier_compliance_documents (
                        id, name, file_url, file_type, file_size, notes, created_at,
                        suppliers (name),
                        compliance_document_types (name)
                    )
                `)
                .eq("job_id", jobId)
                .is("deleted_at", null);

            if (assocDocsError) throw assocDocsError;

            const associatedDocuments = [];
            for (const assocDoc of (rawAssocDocs || [])) {
                const doc = assocDoc.supplier_compliance_documents as any;
                if (!doc) continue;
                const signedUrl = await createSignedUrl(admin, doc.file_url);
                associatedDocuments.push({
                    id: assocDoc.id,
                    name: assocDoc.custom_name || doc.name,
                    notes: assocDoc.custom_notes || doc.notes,
                    fileUrl: signedUrl,
                    fileType: doc.file_type,
                    fileSize: doc.file_size,
                    supplierName: getRelationName(doc.suppliers) || "Sconosciuto",
                    typeName: getRelationName(doc.compliance_document_types) || "Generico",
                    createdAt: assocDoc.created_at,
                });
            }

            // --- CATEGORIA 3: Documenti DDT/Bolle ---
            
            // A. Trova i purchase_id collegati alla commessa per tracciare i DDT
            const [directPurchases, itemPurchases, deliveryItems] = await Promise.all([
                admin.from("purchases").select("id, delivery_note_number, document_urls").eq("job_id", jobId).is("deleted_at", null),
                admin.from("purchase_items").select("purchase_id").eq("job_id", jobId),
                admin
                    .from("delivery_note_items")
                    .select("purchase_item_id, delivery_notes!inner(job_id)")
                    .eq("delivery_notes.job_id", jobId)
                    .not("purchase_item_id", "is", null),
            ]);

            if (directPurchases.error) throw directPurchases.error;
            if (itemPurchases.error) throw itemPurchases.error;
            if (deliveryItems.error) throw deliveryItems.error;

            const purchaseIds = new Set<string>();
            const purchaseMap = new Map<string, any>(); // Per mappare id acquisto a numero DDT

            (directPurchases.data || []).forEach((p: any) => {
                purchaseIds.add(p.id);
                purchaseMap.set(p.id, p);
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

            if (purchaseIds.size > 0) {
                const purchaseIdList = Array.from(purchaseIds);

                // 1. Documenti di conformità legati a questi acquisti (da DDT fornitori)
                const { data: supplierDocs, error: supplierDocsError } = await admin
                    .from("supplier_compliance_documents")
                    .select(`
                        id, name, file_url, file_type, file_size, notes, created_at, purchase_id,
                        suppliers (name),
                        compliance_document_types (name)
                    `)
                    .in("purchase_id", purchaseIdList)
                    .is("deleted_at", null);

                if (supplierDocsError) throw supplierDocsError;

                // Esclusioni DDT impostate in commessa
                const { data: exclusions, error: exclError } = await admin
                    .from("job_ddt_document_exclusions")
                    .select("compliance_document_id")
                    .eq("job_id", jobId);

                if (exclError) throw exclError;
                const excludedSet = new Set((exclusions || []).map(e => e.compliance_document_id));

                const filteredSupplierDocs = (supplierDocs || []).filter(d => !excludedSet.has(d.id));

                for (const doc of filteredSupplierDocs) {
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

                    ddtDocuments.push({
                        id: doc.id,
                        name: doc.name,
                        notes: doc.notes ? `DDT Fornitore: ${ddtNumber}. Note: ${doc.notes}` : `DDT Fornitore: ${ddtNumber}`,
                        fileUrl: signedUrl,
                        fileType: doc.file_type,
                        fileSize: doc.file_size,
                        supplierName: getRelationName(doc.suppliers) || "Sconosciuto",
                        typeName: getRelationName(doc.compliance_document_types) || "Conformità DDT",
                        createdAt: doc.created_at,
                        kind: "ddt_supplier_compliance",
                    });
                }

                // 2. I file fisici dei DDT fornitore (i file pdf/immagini caricati all'acquisto)
                // Carichiamo tutti gli acquisti per ricavare i document_urls
                const { data: allPurchasesDetails, error: purchDetailsError } = await admin
                    .from("purchases")
                    .select("id, delivery_note_number, delivery_note_date, document_urls, suppliers(name)")
                    .in("id", purchaseIdList)
                    .is("deleted_at", null);

                if (purchDetailsError) throw purchDetailsError;

                for (const p of (allPurchasesDetails || [])) {
                    if (p.document_urls && p.document_urls.length > 0) {
                        let docIndex = 1;
                        for (const url of p.document_urls) {
                            const signedUrl = await createSignedUrl(admin, url);
                            // Estrae l'estensione o tipo
                            const ext = url.split(".").pop()?.toLowerCase() || "pdf";
                            const suppName = getRelationName(p.suppliers) || "Sconosciuto";
                            ddtDocuments.push({
                                id: `${p.id}-doc-${docIndex}`,
                                name: `DDT Fornitore ${p.delivery_note_number}`,
                                notes: `File DDT allegato all'acquisto del ${new Date(p.delivery_note_date).toLocaleDateString("it-IT")} - Fornitore: ${suppName}`,
                                fileUrl: signedUrl,
                                fileType: ext,
                                fileSize: null,
                                supplierName: suppName,
                                typeName: "DDT Fornitore (Bolla)",
                                createdAt: p.delivery_note_date,
                                kind: "ddt_supplier_file",
                            });
                            docIndex++;
                        }
                    }
                }
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
                .is("deleted_at", null)
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
