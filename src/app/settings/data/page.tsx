"use client"

import { notify } from "@/lib/notify";;

import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, X, Loader2, Trash2, Pencil } from "lucide-react";
import { useState, useEffect } from "react";
import { suppliersApi, brandsApi, itemTypesApi, unitsApi, supplierGroupsApi, Supplier, Brand, ItemType, Unit, SupplierGroup } from "@/lib/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { warehousesApi } from "@/lib/services/warehouses";
import { proposalDocumentTypesApi, ProposalDocumentType } from "@/lib/services/proposal-document-types";
import { complianceDocumentTypesApi, ComplianceDocumentTypeConfig } from "@/lib/services/compliance-document-types";
import { jobSiteDocumentTypesApi, JobSiteDocumentType } from "@/lib/services/job-site-document-types";
import { jobConformitaDocumentTypesApi, JobConformitaDocumentType } from "@/lib/services/job-conformita-document-types";
import type { Warehouse } from "@/lib/types";

type RenameTarget = {
    kind: "supplier" | "brand" | "type" | "unit" | "warehouse" | "docType" | "complianceDocType" | "jobSiteDocType" | "jobConformitaDocType";
    id: string;
    name: string;
};

export default function SettingsInventoryPage() {
    // Units State
    const [units, setUnits] = useState<Unit[]>([]);
    const [loadingUnits, setLoadingUnits] = useState(true);
    const [newUnitName, setNewUnitName] = useState("");
    const [addingUnit, setAddingUnit] = useState(false);

    // Suppliers State
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [newSupplierName, setNewSupplierName] = useState("");
    const [addingSupplier, setAddingSupplier] = useState(false);

    // Supplier Groups State (fatturazione condivisa)
    const [supplierGroups, setSupplierGroups] = useState<SupplierGroup[]>([]);
    const [loadingSupplierGroups, setLoadingSupplierGroups] = useState(true);
    const [groupDialogOpen, setGroupDialogOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<SupplierGroup | null>(null);
    const [groupName, setGroupName] = useState("");
    const [groupSupplierIds, setGroupSupplierIds] = useState<string[]>([]);
    const [groupVisibleInPurchases, setGroupVisibleInPurchases] = useState(false);
    const [groupShowMembersInInvoices, setGroupShowMembersInInvoices] = useState(true);
    const [savingGroup, setSavingGroup] = useState(false);

    // Brands State
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loadingBrands, setLoadingBrands] = useState(true);
    const [newBrandName, setNewBrandName] = useState("");
    const [addingBrand, setAddingBrand] = useState(false);

    // Types State
    const [types, setTypes] = useState<ItemType[]>([]);
    const [loadingTypes, setLoadingTypes] = useState(true);
    const [newTypeName, setNewTypeName] = useState("");
    const [addingType, setAddingType] = useState(false);

    // Warehouses State
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loadingWarehouses, setLoadingWarehouses] = useState(true);
    const [newWarehouseName, setNewWarehouseName] = useState("");
    const [newWarehouseAddress, setNewWarehouseAddress] = useState("");
    const [newWarehouseIsPrimary, setNewWarehouseIsPrimary] = useState(false);
    const [addingWarehouse, setAddingWarehouse] = useState(false);

    // Proposal document types State
    const [docTypes, setDocTypes] = useState<ProposalDocumentType[]>([]);
    const [loadingDocTypes, setLoadingDocTypes] = useState(true);
    const [newDocTypeName, setNewDocTypeName] = useState("");
    const [addingDocType, setAddingDocType] = useState(false);

    // Compliance document types State
    const [complianceDocTypes, setComplianceDocTypes] = useState<ComplianceDocumentTypeConfig[]>([]);
    const [loadingComplianceDocTypes, setLoadingComplianceDocTypes] = useState(true);
    const [newComplianceDocTypeName, setNewComplianceDocTypeName] = useState("");
    const [addingComplianceDocType, setAddingComplianceDocType] = useState(false);

    // Job commessa document types State
    const [jobDocTypes, setJobDocTypes] = useState<JobSiteDocumentType[]>([]);
    const [loadingJobDocTypes, setLoadingJobDocTypes] = useState(true);
    const [newJobDocTypeName, setNewJobDocTypeName] = useState("");
    const [addingJobDocType, setAddingJobDocType] = useState(false);

    // Job conformita document types State
    const [jobConformitaDocTypes, setJobConformitaDocTypes] = useState<JobConformitaDocumentType[]>([]);
    const [loadingJobConformitaDocTypes, setLoadingJobConformitaDocTypes] = useState(true);
    const [newJobConformitaDocTypeName, setNewJobConformitaDocTypeName] = useState("");
    const [newJobConformitaDocTypeAllowsFolders, setNewJobConformitaDocTypeAllowsFolders] = useState(false);
    const [addingJobConformitaDocType, setAddingJobConformitaDocType] = useState(false);

    // Rename dialog state
    const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [renaming, setRenaming] = useState(false);

    useEffect(() => {
        loadSuppliers();
        loadSupplierGroups();
        loadBrands();
        loadTypes();
        loadUnits();
        loadWarehouses();
        loadDocTypes();
        loadComplianceDocTypes();
        loadJobDocTypes();
        loadJobConformitaDocTypes();
    }, []);

    const loadSuppliers = async () => {
        try {
            setLoadingSuppliers(true);
            const data = await suppliersApi.getAll();
            setSuppliers(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Failed to load suppliers", error);
            notify.error("Errore nel caricamento dei fornitori");
        } finally {
            setLoadingSuppliers(false);
        }
    };

    const loadSupplierGroups = async () => {
        try {
            setLoadingSupplierGroups(true);
            const data = await supplierGroupsApi.getAll();
            setSupplierGroups(data);
        } catch (error) {
            console.error("Failed to load supplier groups", error);
            notify.error("Errore nel caricamento dei gruppi fornitori");
        } finally {
            setLoadingSupplierGroups(false);
        }
    };

    const openGroupDialog = (group?: SupplierGroup) => {
        if (group) {
            setEditingGroup(group);
            setGroupName(group.name);
            setGroupSupplierIds(group.memberSupplierIds);
            setGroupVisibleInPurchases(group.visibleInPurchases);
            setGroupShowMembersInInvoices(group.showMembersInInvoices);
        } else {
            setEditingGroup(null);
            setGroupName("");
            setGroupSupplierIds([]);
            setGroupVisibleInPurchases(false);
            setGroupShowMembersInInvoices(true);
        }
        setGroupDialogOpen(true);
    };

    const toggleGroupSupplier = (id: string) => {
        setGroupSupplierIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };

    const handleSaveGroup = async () => {
        const name = groupName.trim();
        if (!name) return;
        if (groupSupplierIds.length < 2) {
            notify.warning("Seleziona almeno due fornitori da raggruppare.");
            return;
        }
        try {
            setSavingGroup(true);
            const options = { visibleInPurchases: groupVisibleInPurchases, showMembersInInvoices: groupShowMembersInInvoices };
            if (editingGroup) {
                await supplierGroupsApi.update(editingGroup.id, name, groupSupplierIds, options);
                if (name !== editingGroup.name) {
                    const updatedSupplier = await suppliersApi.update(editingGroup.billingSupplierId, { name });
                    setSuppliers(prev => prev.map(s => s.id === updatedSupplier.id ? updatedSupplier : s).sort((a, b) => a.name.localeCompare(b.name)));
                }
            } else {
                // Check for duplicates (case insensitive), same rule applied to regular suppliers
                if (suppliers.some(s => s.name.toLowerCase() === name.toLowerCase())) {
                    notify.warning("Esiste già un fornitore con questo nome.");
                    return;
                }
                // The billing entity is created as a normal supplier so it can
                // be selected like any other supplier when registering an invoice.
                const billingSupplier = await suppliersApi.create({ name });
                await supplierGroupsApi.create(name, billingSupplier.id, groupSupplierIds, options);
                setSuppliers(prev => [...prev, billingSupplier].sort((a, b) => a.name.localeCompare(b.name)));
            }
            setGroupDialogOpen(false);
            await loadSupplierGroups();
        } catch (error) {
            console.error("Failed to save supplier group", error);
            notify.error("Errore nel salvataggio del gruppo fornitori");
        } finally {
            setSavingGroup(false);
        }
    };

    const handleDeleteGroup = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo gruppo di fatturazione condivisa?")) return;
        try {
            await supplierGroupsApi.delete(id);
            setSupplierGroups(prev => prev.filter(g => g.id !== id));
        } catch (error) {
            console.error("Failed to delete supplier group", error);
            notify.error("Errore nell'eliminazione del gruppo");
        }
    };

    const loadBrands = async () => {
        try {
            setLoadingBrands(true);
            const data = await brandsApi.getAll();
            setBrands(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Failed to load brands", error);
            notify.error("Errore nel caricamento delle marche");
        } finally {
            setLoadingBrands(false);
        }
    };

    const loadTypes = async () => {
        try {
            setLoadingTypes(true);
            const data = await itemTypesApi.getAll();
            setTypes(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Failed to load types", error);
            notify.error("Errore nel caricamento dei tipi");
        } finally {
            setLoadingTypes(false);
        }
    };

    const loadUnits = async () => {
        try {
            setLoadingUnits(true);
            const data = await unitsApi.getAll();
            setUnits(data);
        } catch (error) {
            console.error("Failed to load units", error);
            notify.error("Errore nel caricamento delle unità");
        } finally {
            setLoadingUnits(false);
        }
    };

    const loadDocTypes = async () => {
        try {
            setLoadingDocTypes(true);
            const data = await proposalDocumentTypesApi.getAll();
            setDocTypes(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Failed to load proposal document types", error);
            notify.error("Errore nel caricamento dei tipi di documento offerte");
        } finally {
            setLoadingDocTypes(false);
        }
    };

    const loadComplianceDocTypes = async () => {
        try {
            setLoadingComplianceDocTypes(true);
            const data = await complianceDocumentTypesApi.getAll();
            setComplianceDocTypes(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Failed to load compliance document types", error);
            notify.error("Errore nel caricamento dei tipi di documento conformità");
        } finally {
            setLoadingComplianceDocTypes(false);
        }
    };

    const loadJobDocTypes = async () => {
        try {
            setLoadingJobDocTypes(true);
            const data = await jobSiteDocumentTypesApi.getAll();
            setJobDocTypes(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Failed to load job commessa document types", error);
            notify.error("Errore nel caricamento dei tipi di documento commessa");
        } finally {
            setLoadingJobDocTypes(false);
        }
    };

    const loadJobConformitaDocTypes = async () => {
        try {
            setLoadingJobConformitaDocTypes(true);
            const data = await jobConformitaDocumentTypesApi.getAll();
            setJobConformitaDocTypes(data.sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error) {
            console.error("Failed to load job conformita document types", error);
            notify.error("Errore nel caricamento dei tipi di documento conformità cantiere");
        } finally {
            setLoadingJobConformitaDocTypes(false);
        }
    };

    const handleAddSupplier = async () => {
        const nameToAdd = newSupplierName.trim();
        if (!nameToAdd) return;

        // Check for duplicates (case insensitive)
        if (suppliers.some(s => s.name.toLowerCase() === nameToAdd.toLowerCase())) {
            notify.warning("Esiste già un fornitore con questo nome.");
            return;
        }

        try {
            setAddingSupplier(true);
            const newSupplier = await suppliersApi.create({ name: nameToAdd });
            // Add and re-sort
            setSuppliers([...suppliers, newSupplier].sort((a, b) => a.name.localeCompare(b.name)));
            setNewSupplierName("");
        } catch (error) {
            console.error("Failed to add supplier", error);
            notify.error("Errore nell'aggiunta del fornitore");
        } finally {
            setAddingSupplier(false);
        }
    };

    const handleAddBrand = async () => {
        const nameToAdd = newBrandName.trim();
        if (!nameToAdd) return;

        // Check for duplicates (case insensitive)
        if (brands.some(b => b.name.toLowerCase() === nameToAdd.toLowerCase())) {
            notify.warning("Esiste già una marca con questo nome.");
            return;
        }

        try {
            setAddingBrand(true);
            const newBrand = await brandsApi.create(nameToAdd);
            // Add and re-sort
            setBrands([...brands, newBrand].sort((a, b) => a.name.localeCompare(b.name)));
            setNewBrandName("");
        } catch (error) {
            console.error("Failed to add brand", error);
            notify.error("Errore nell'aggiunta della marca");
        } finally {
            setAddingBrand(false);
        }
    };

    const handleAddType = async () => {
        const nameToAdd = newTypeName.trim();
        if (!nameToAdd) return;

        // Check for duplicates (case insensitive)
        if (types.some(t => t.name.toLowerCase() === nameToAdd.toLowerCase())) {
            notify.warning("Esiste già una tipologia con questo nome.");
            return;
        }

        try {
            setAddingType(true);
            const newType = await itemTypesApi.create(nameToAdd);
            // Add and re-sort
            setTypes([...types, newType].sort((a, b) => a.name.localeCompare(b.name)));
            setNewTypeName("");
        } catch (error) {
            console.error("Failed to add type", error);
            notify.error("Errore nell'aggiunta del tipo");
        } finally {
            setAddingType(false);
        }
    };

    const handleDeleteSupplier = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo fornitore?")) return;
        try {
            await suppliersApi.delete(id);
            setSuppliers(suppliers.filter(s => s.id !== id));
        } catch (error) {
            console.error("Failed to delete supplier", error);
            notify.error("Errore nell'eliminazione del fornitore");
        }
    };

    const handleDeleteBrand = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questa marca?")) return;
        try {
            await brandsApi.delete(id);
            setBrands(brands.filter(b => b.id !== id));
        } catch (error) {
            console.error("Failed to delete brand", error);
            notify.error("Errore nell'eliminazione della marca");
        }
    };

    const handleDeleteType = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questa tipologia?")) return;
        try {
            await itemTypesApi.delete(id);
            setTypes(types.filter(t => t.id !== id));
        } catch (error) {
            console.error("Failed to delete type", error);
            notify.error("Errore nell'eliminazione del tipo");
        }
    };

    const handleAddUnit = async () => {
        if (!newUnitName.trim()) return;
        try {
            setAddingUnit(true);
            const newUnit = await unitsApi.create(newUnitName);
            setUnits([...units, newUnit]);
            setNewUnitName("");
        } catch (error) {
            console.error("Failed to add unit", error);
            notify.error("Errore nell'aggiunta dell'unità");
        } finally {
            setAddingUnit(false);
        }
    };

    const handleDeleteUnit = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questa unità?")) return;
        try {
            await unitsApi.delete(id);
            setUnits(units.filter(u => u.id !== id));
        } catch (error) {
            console.error("Failed to delete unit", error);
            notify.error("Errore nell'eliminazione dell'unità");
        }
    };

    const loadWarehouses = async () => {
        try {
            setLoadingWarehouses(true);
            const data = await warehousesApi.getAll();
            setWarehouses(data);
        } catch (error) {
            console.error("Failed to load warehouses", error);
            notify.error("Errore nel caricamento dei magazzini");
        } finally {
            setLoadingWarehouses(false);
        }
    };

    const handleAddWarehouse = async () => {
        if (!newWarehouseName.trim()) return;
        try {
            setAddingWarehouse(true);
            const newWarehouse = await warehousesApi.create({
                name: newWarehouseName,
                address: newWarehouseAddress || undefined,
                isPrimary: newWarehouseIsPrimary
            });
            setWarehouses([...warehouses, newWarehouse]);
            setNewWarehouseName("");
            setNewWarehouseAddress("");
            setNewWarehouseIsPrimary(false);
        } catch (error) {
            console.error("Failed to add warehouse", error);
            notify.error("Errore nell'aggiunta del magazzino");
        } finally {
            setAddingWarehouse(false);
        }
    };

    const handleDeleteWarehouse = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo magazzino?")) return;
        try {
            await warehousesApi.delete(id);
            setWarehouses(warehouses.filter(w => w.id !== id));
        } catch (error) {
            console.error("Failed to delete warehouse", error);
            notify.error("Errore nell'eliminazione del magazzino");
        }
    };

    const handleTogglePrimary = async (id: string) => {
        try {
            await warehousesApi.update(id, { isPrimary: true });
            await loadWarehouses(); // Reload to reflect trigger changes
        } catch (error) {
            console.error("Failed to update warehouse", error);
            notify.error("Errore nell'aggiornamento del magazzino");
        }
    };

    const handleAddDocType = async () => {
        const nameToAdd = newDocTypeName.trim();
        if (!nameToAdd) return;
        if (docTypes.some(t => t.name.toLowerCase() === nameToAdd.toLowerCase())) {
            notify.warning("Esiste già un tipo di documento con questo nome.");
            return;
        }
        try {
            setAddingDocType(true);
            const newType = await proposalDocumentTypesApi.create(nameToAdd);
            setDocTypes([...docTypes, newType].sort((a, b) => a.name.localeCompare(b.name)));
            setNewDocTypeName("");
        } catch (error) {
            console.error("Failed to add proposal document type", error);
            notify.error("Errore nell'aggiunta del tipo di documento");
        } finally {
            setAddingDocType(false);
        }
    };

    const handleDeleteDocType = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo tipo di documento?")) return;
        try {
            await proposalDocumentTypesApi.delete(id);
            setDocTypes(docTypes.filter(t => t.id !== id));
        } catch (error) {
            console.error("Failed to delete proposal document type", error);
            notify.error("Errore nell'eliminazione del tipo di documento");
        }
    };

    const handleAddComplianceDocType = async () => {
        const nameToAdd = newComplianceDocTypeName.trim();
        if (!nameToAdd) return;
        if (complianceDocTypes.some(t => t.name.toLowerCase() === nameToAdd.toLowerCase())) {
            notify.warning("Esiste già un tipo di documento con questo nome.");
            return;
        }
        try {
            setAddingComplianceDocType(true);
            const newType = await complianceDocumentTypesApi.create(nameToAdd);
            setComplianceDocTypes([...complianceDocTypes, newType].sort((a, b) => a.name.localeCompare(b.name)));
            setNewComplianceDocTypeName("");
        } catch (error) {
            console.error("Failed to add compliance document type", error);
            notify.error("Errore nell'aggiunta del tipo di documento");
        } finally {
            setAddingComplianceDocType(false);
        }
    };

    const handleDeleteComplianceDocType = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo tipo di documento?")) return;
        try {
            await complianceDocumentTypesApi.delete(id);
            setComplianceDocTypes(complianceDocTypes.filter(t => t.id !== id));
        } catch (error) {
            console.error("Failed to delete compliance document type", error);
            notify.error("Errore nell'eliminazione del tipo di documento");
        }
    };

    const handleAddJobDocType = async () => {
        const nameToAdd = newJobDocTypeName.trim();
        if (!nameToAdd) return;
        if (jobDocTypes.some(t => t.name.toLowerCase() === nameToAdd.toLowerCase())) {
            notify.warning("Esiste già un tipo di documento con questo nome.");
            return;
        }
        try {
            setAddingJobDocType(true);
            const newType = await jobSiteDocumentTypesApi.create(nameToAdd);
            setJobDocTypes([...jobDocTypes, newType].sort((a, b) => a.name.localeCompare(b.name)));
            setNewJobDocTypeName("");
        } catch (error) {
            console.error("Failed to add job commessa document type", error);
            notify.error("Errore nell'aggiunta del tipo di documento");
        } finally {
            setAddingJobDocType(false);
        }
    };

    const handleDeleteJobDocType = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo tipo di documento?")) return;
        try {
            await jobSiteDocumentTypesApi.delete(id);
            setJobDocTypes(jobDocTypes.filter(t => t.id !== id));
        } catch (error) {
            console.error("Failed to delete job commessa document type", error);
            notify.error("Errore nell'eliminazione del tipo di documento");
        }
    };

    const handleAddJobConformitaDocType = async () => {
        const nameToAdd = newJobConformitaDocTypeName.trim();
        if (!nameToAdd) return;
        if (jobConformitaDocTypes.some(t => t.name.toLowerCase() === nameToAdd.toLowerCase())) {
            notify.warning("Esiste già un tipo di documento con questo nome.");
            return;
        }
        try {
            setAddingJobConformitaDocType(true);
            const newType = await jobConformitaDocumentTypesApi.create(nameToAdd, newJobConformitaDocTypeAllowsFolders);
            setJobConformitaDocTypes([...jobConformitaDocTypes, newType].sort((a, b) => a.name.localeCompare(b.name)));
            setNewJobConformitaDocTypeName("");
            setNewJobConformitaDocTypeAllowsFolders(false);
        } catch (error) {
            console.error("Failed to add job conformita document type", error);
            notify.error("Errore nell'aggiunta del tipo di documento");
        } finally {
            setAddingJobConformitaDocType(false);
        }
    };

    const handleToggleJobConformitaDocTypeFolders = async (id: string, allowsFolders: boolean) => {
        try {
            const updated = await jobConformitaDocumentTypesApi.setAllowsFolders(id, allowsFolders);
            setJobConformitaDocTypes(prev => prev.map(t => t.id === id ? updated : t));
        } catch (error) {
            console.error("Failed to toggle allowsFolders", error);
            notify.error("Errore nell'aggiornamento del tipo di documento");
        }
    };

    const handleDeleteJobConformitaDocType = async (id: string) => {
        if (!confirm("Sei sicuro di voler eliminare questo tipo di documento?")) return;
        try {
            await jobConformitaDocumentTypesApi.delete(id);
            setJobConformitaDocTypes(jobConformitaDocTypes.filter(t => t.id !== id));
        } catch (error) {
            console.error("Failed to delete job conformita document type", error);
            notify.error("Errore nell'eliminazione del tipo di documento");
        }
    };

    const openRename = (kind: RenameTarget["kind"], id: string, name: string) => {
        setRenameTarget({ kind, id, name });
        setRenameValue(name);
    };

    const handleRename = async () => {
        if (!renameTarget) return;
        const newName = renameValue.trim();
        if (!newName) return;
        try {
            setRenaming(true);
            switch (renameTarget.kind) {
                case "supplier": {
                    const updated = await suppliersApi.update(renameTarget.id, { name: newName });
                    setSuppliers(prev => prev.map(s => s.id === renameTarget.id ? updated : s).sort((a, b) => a.name.localeCompare(b.name)));
                    break;
                }
                case "brand": {
                    const updated = await brandsApi.update(renameTarget.id, newName);
                    setBrands(prev => prev.map(b => b.id === renameTarget.id ? updated : b).sort((a, b) => a.name.localeCompare(b.name)));
                    break;
                }
                case "type": {
                    const updated = await itemTypesApi.update(renameTarget.id, newName);
                    setTypes(prev => prev.map(t => t.id === renameTarget.id ? updated : t).sort((a, b) => a.name.localeCompare(b.name)));
                    break;
                }
                case "unit": {
                    const updated = await unitsApi.update(renameTarget.id, newName);
                    setUnits(prev => prev.map(u => u.id === renameTarget.id ? updated : u));
                    break;
                }
                case "warehouse": {
                    const updated = await warehousesApi.update(renameTarget.id, { name: newName });
                    setWarehouses(prev => prev.map(w => w.id === renameTarget.id ? updated : w));
                    break;
                }
                case "docType": {
                    const updated = await proposalDocumentTypesApi.update(renameTarget.id, newName);
                    setDocTypes(prev => prev.map(t => t.id === renameTarget.id ? updated : t).sort((a, b) => a.name.localeCompare(b.name)));
                    break;
                }
                case "complianceDocType": {
                    const updated = await complianceDocumentTypesApi.update(renameTarget.id, newName);
                    setComplianceDocTypes(prev => prev.map(t => t.id === renameTarget.id ? updated : t).sort((a, b) => a.name.localeCompare(b.name)));
                    break;
                }
                case "jobSiteDocType": {
                    const updated = await jobSiteDocumentTypesApi.update(renameTarget.id, newName);
                    setJobDocTypes(prev => prev.map(t => t.id === renameTarget.id ? updated : t).sort((a, b) => a.name.localeCompare(b.name)));
                    break;
                }
                case "jobConformitaDocType": {
                    const updated = await jobConformitaDocumentTypesApi.update(renameTarget.id, newName);
                    setJobConformitaDocTypes(prev => prev.map(t => t.id === renameTarget.id ? updated : t).sort((a, b) => a.name.localeCompare(b.name)));
                    break;
                }
            }
            setRenameTarget(null);
        } catch (error) {
            console.error("Failed to rename", error);
            notify.error("Errore durante la rinomina");
        } finally {
            setRenaming(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-medium">Impostazioni Elenchi</h3>
                <p className="text-sm text-muted-foreground">
                    Gestisci le liste predefinite per prodotti, fornitori e magazzini.
                </p>
            </div>
            <Separator />

            <Tabs defaultValue="suppliers">
                <TabsList className="flex-wrap h-auto gap-1">
                    <TabsTrigger value="suppliers">Fornitori</TabsTrigger>
                    <TabsTrigger value="supplierGroups">Fatturazione Condivisa</TabsTrigger>
                    <TabsTrigger value="brands">Marche</TabsTrigger>
                    <TabsTrigger value="types">Tipologie</TabsTrigger>
                    <TabsTrigger value="units">Unità di Misura</TabsTrigger>
                    <TabsTrigger value="warehouses">Magazzini</TabsTrigger>
                    <TabsTrigger value="docTypes">Documenti Offerte</TabsTrigger>
                    <TabsTrigger value="complianceDocTypes">Documenti Conformità</TabsTrigger>
                    <TabsTrigger value="jobDocTypes">Documenti Cantiere</TabsTrigger>
                    <TabsTrigger value="jobConformitaDocTypes">Documenti Conformità Cantiere</TabsTrigger>
                </TabsList>

                <TabsContent value="suppliers" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Fornitori</CardTitle>
                            <CardDescription>Gestisci l'elenco dei fornitori approvati.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nuovo Fornitore..."
                                    className="max-w-sm"
                                    value={newSupplierName}
                                    onChange={(e) => setNewSupplierName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddSupplier()}
                                />
                                <Button
                                    size="icon"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={handleAddSupplier}
                                    disabled={addingSupplier || !newSupplierName.trim()}
                                >
                                    {addingSupplier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                </Button>
                            </div>

                            {loadingSuppliers ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Caricamento fornitori...
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {suppliers.map(supplier => (
                                        <Badge key={supplier.id} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-1 text-sm">
                                            {supplier.name}
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => openRename("supplier", supplier.id, supplier.name)}
                                            >
                                                <Pencil className="h-3 w-3 text-slate-500" />
                                            </button>
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => handleDeleteSupplier(supplier.id)}
                                            >
                                                <X className="h-3 w-3 text-slate-500" />
                                            </button>
                                        </Badge>
                                    ))}
                                    {suppliers.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">Nessun fornitore presente.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="supplierGroups" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Fatturazione Condivisa</CardTitle>
                                <CardDescription>
                                    Raggruppa due o più fornitori il cui acquisti vengono fatturati da un fornitore terzo. Quando crei una fattura selezionando il gruppo, vedrai gli acquisti di tutti i fornitori associati.
                                </CardDescription>
                            </div>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => openGroupDialog()}>
                                <Plus className="h-4 w-4 mr-2" /> Nuovo Gruppo
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {loadingSupplierGroups ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Caricamento gruppi...
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {supplierGroups.map(group => (
                                        <div key={group.id} className="flex items-start justify-between p-3 border rounded-lg bg-white dark:bg-slate-800">
                                            <div>
                                                <span className="font-medium">{group.name}</span>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Bolle aggregate da: {group.memberSupplierIds
                                                        .map(id => suppliers.find(s => s.id === id)?.name)
                                                        .filter(Boolean)
                                                        .join(", ")}
                                                </p>
                                                <div className="flex gap-2 mt-2">
                                                    {group.visibleInPurchases && (
                                                        <Badge variant="outline" className="text-xs">Visibile in Ordini/Acquisti</Badge>
                                                    )}
                                                    {!group.showMembersInInvoices && (
                                                        <Badge variant="outline" className="text-xs">Senza aggregazione in fattura</Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="sm" onClick={() => openGroupDialog(group)} className="text-slate-600 hover:text-slate-800">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteGroup(group.id)} className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {supplierGroups.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">Nessun gruppo di fatturazione condivisa presente.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="brands" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Marche</CardTitle>
                            <CardDescription>Aggiungi o rimuovi le marche disponibili.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nuova Marca..."
                                    className="max-w-sm"
                                    value={newBrandName}
                                    onChange={(e) => setNewBrandName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddBrand()}
                                />
                                <Button
                                    size="icon"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={handleAddBrand}
                                    disabled={addingBrand || !newBrandName.trim()}
                                >
                                    {addingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                </Button>
                            </div>
                            {loadingBrands ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Caricamento marche...
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {brands.map(brand => (
                                        <Badge key={brand.id} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-1 text-sm">
                                            {brand.name}
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => openRename("brand", brand.id, brand.name)}
                                            >
                                                <Pencil className="h-3 w-3 text-slate-500" />
                                            </button>
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => handleDeleteBrand(brand.id)}
                                            >
                                                <X className="h-3 w-3 text-slate-500" />
                                            </button>
                                        </Badge>
                                    ))}
                                    {brands.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">Nessuna marca presente.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="types" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Tipologie</CardTitle>
                            <CardDescription>Categorie merceologiche dei prodotti.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nuova Tipologia..."
                                    className="max-w-sm"
                                    value={newTypeName}
                                    onChange={(e) => setNewTypeName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddType()}
                                />
                                <Button
                                    size="icon"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={handleAddType}
                                    disabled={addingType || !newTypeName.trim()}
                                >
                                    {addingType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                </Button>
                            </div>
                            {loadingTypes ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Caricamento tipologie...
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {types.map(type => (
                                        <Badge key={type.id} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-1 text-sm">
                                            {type.name}
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => openRename("type", type.id, type.name)}
                                            >
                                                <Pencil className="h-3 w-3 text-slate-500" />
                                            </button>
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => handleDeleteType(type.id)}
                                            >
                                                <X className="h-3 w-3 text-slate-500" />
                                            </button>
                                        </Badge>
                                    ))}
                                    {types.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">Nessuna tipologia presente.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="units" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Unità di Misura</CardTitle>
                            <CardDescription>Unità di misura disponibili per i prodotti.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nuova Unità..."
                                    className="max-w-sm"
                                    value={newUnitName}
                                    onChange={(e) => setNewUnitName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddUnit()}
                                />
                                <Button
                                    size="icon"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={handleAddUnit}
                                    disabled={addingUnit || !newUnitName.trim()}
                                >
                                    {addingUnit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                </Button>
                            </div>
                            {loadingUnits ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Caricamento unità...
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {units.map(unit => (
                                        <Badge key={unit.id} variant="outline" className="pl-3 pr-1 py-1 flex items-center gap-1 text-sm">
                                            {unit.name}
                                            <button
                                                className="hover:bg-slate-100 rounded-full p-0.5 transition-colors"
                                                onClick={() => openRename("unit", unit.id, unit.name)}
                                            >
                                                <Pencil className="h-3 w-3 text-slate-500" />
                                            </button>
                                            <button
                                                className="hover:bg-slate-100 rounded-full p-0.5 transition-colors"
                                                onClick={() => handleDeleteUnit(unit.id)}
                                            >
                                                <X className="h-3 w-3 text-slate-500" />
                                            </button>
                                        </Badge>
                                    ))}
                                    {units.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">Nessuna unità presente.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="warehouses" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestione Magazzini</CardTitle>
                            <CardDescription>Magazzini disponibili per presenze e bolle di consegna.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Nome Magazzino..."
                                        className="max-w-sm"
                                        value={newWarehouseName}
                                        onChange={(e) => setNewWarehouseName(e.target.value)}
                                    />
                                    <Input
                                        placeholder="Indirizzo (opzionale)..."
                                        className="flex-1"
                                        value={newWarehouseAddress}
                                        onChange={(e) => setNewWarehouseAddress(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="isPrimary"
                                        checked={newWarehouseIsPrimary}
                                        onChange={(e) => setNewWarehouseIsPrimary(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300"
                                    />
                                    <label htmlFor="isPrimary" className="text-sm text-muted-foreground">
                                        Imposta come principale
                                    </label>
                                    <Button
                                        size="sm"
                                        className="ml-auto bg-blue-600 hover:bg-blue-700"
                                        onClick={handleAddWarehouse}
                                        disabled={addingWarehouse || !newWarehouseName.trim()}
                                    >
                                        {addingWarehouse ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-2" /> Aggiungi</>}
                                    </Button>
                                </div>
                            </div>

                            {loadingWarehouses ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Caricamento magazzini...
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {warehouses.map(warehouse => (
                                        <div key={warehouse.id} className="flex items-start justify-between p-3 border rounded-lg bg-white dark:bg-slate-800">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{warehouse.name}</span>
                                                    {warehouse.isPrimary && (
                                                        <Badge variant="default" className="bg-blue-600">Principale</Badge>
                                                    )}
                                                </div>
                                                {warehouse.address && (
                                                    <p className="text-sm text-muted-foreground mt-1">{warehouse.address}</p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                {!warehouse.isPrimary && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleTogglePrimary(warehouse.id)}
                                                    >
                                                        Rendi principale
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => openRename("warehouse", warehouse.id, warehouse.name)}
                                                    className="text-slate-600 hover:text-slate-800"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteWarehouse(warehouse.id)}
                                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {warehouses.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">Nessun magazzino presente.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="docTypes" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Documenti Offerte</CardTitle>
                            <CardDescription>Tipi di documento selezionabili quando si carica un documento su una proposta/offerta.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nuovo Tipo Documento..."
                                    className="max-w-sm"
                                    value={newDocTypeName}
                                    onChange={(e) => setNewDocTypeName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddDocType()}
                                />
                                <Button
                                    size="icon"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={handleAddDocType}
                                    disabled={addingDocType || !newDocTypeName.trim()}
                                >
                                    {addingDocType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                </Button>
                            </div>
                            {loadingDocTypes ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Caricamento tipi documento...
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {docTypes.map(docType => (
                                        <Badge key={docType.id} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-1 text-sm">
                                            {docType.name}
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => openRename("docType", docType.id, docType.name)}
                                            >
                                                <Pencil className="h-3 w-3 text-slate-500" />
                                            </button>
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => handleDeleteDocType(docType.id)}
                                            >
                                                <X className="h-3 w-3 text-slate-500" />
                                            </button>
                                        </Badge>
                                    ))}
                                    {docTypes.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">Nessun tipo di documento presente.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="complianceDocTypes" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Documenti Conformità</CardTitle>
                            <CardDescription>Tipi di documento selezionabili quando si carica un documento di conformità per un fornitore.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nuovo Tipo Documento..."
                                    className="max-w-sm"
                                    value={newComplianceDocTypeName}
                                    onChange={(e) => setNewComplianceDocTypeName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddComplianceDocType()}
                                />
                                <Button
                                    size="icon"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={handleAddComplianceDocType}
                                    disabled={addingComplianceDocType || !newComplianceDocTypeName.trim()}
                                >
                                    {addingComplianceDocType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                </Button>
                            </div>
                            {loadingComplianceDocTypes ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Caricamento tipi documento...
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {complianceDocTypes.map(docType => (
                                        <Badge key={docType.id} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-1 text-sm">
                                            {docType.name}
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => openRename("complianceDocType", docType.id, docType.name)}
                                            >
                                                <Pencil className="h-3 w-3 text-slate-500" />
                                            </button>
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => handleDeleteComplianceDocType(docType.id)}
                                            >
                                                <X className="h-3 w-3 text-slate-500" />
                                            </button>
                                        </Badge>
                                    ))}
                                    {complianceDocTypes.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">Nessun tipo di documento presente.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="jobDocTypes" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Documenti Cantiere</CardTitle>
                            <CardDescription>Tipi di documento selezionabili quando si carica un documento di cantiere.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Nuovo Tipo Documento..."
                                    className="max-w-sm"
                                    value={newJobDocTypeName}
                                    onChange={(e) => setNewJobDocTypeName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddJobDocType()}
                                />
                                <Button
                                    size="icon"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={handleAddJobDocType}
                                    disabled={addingJobDocType || !newJobDocTypeName.trim()}
                                >
                                    {addingJobDocType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                </Button>
                            </div>
                            {loadingJobDocTypes ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Caricamento tipi documento...
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {jobDocTypes.map(docType => (
                                        <Badge key={docType.id} variant="secondary" className="pl-3 pr-1 py-1 flex items-center gap-1 text-sm">
                                            {docType.name}
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => openRename("jobSiteDocType", docType.id, docType.name)}
                                            >
                                                <Pencil className="h-3 w-3 text-slate-500" />
                                            </button>
                                            <button
                                                className="hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                                                onClick={() => handleDeleteJobDocType(docType.id)}
                                            >
                                                <X className="h-3 w-3 text-slate-500" />
                                            </button>
                                        </Badge>
                                    ))}
                                    {jobDocTypes.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">Nessun tipo di documento presente.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="jobConformitaDocTypes" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Documenti Conformità Cantiere</CardTitle>
                            <CardDescription>Tipi di documento selezionabili quando si carica un documento nella tab Conformità di una commessa.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    placeholder="Nuovo Tipo Documento..."
                                    className="max-w-sm"
                                    value={newJobConformitaDocTypeName}
                                    onChange={(e) => setNewJobConformitaDocTypeName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddJobConformitaDocType()}
                                />
                                <div className="flex items-center gap-1.5">
                                    <Switch
                                        id="newJobConformitaDocTypeAllowsFolders"
                                        checked={newJobConformitaDocTypeAllowsFolders}
                                        onCheckedChange={setNewJobConformitaDocTypeAllowsFolders}
                                    />
                                    <Label htmlFor="newJobConformitaDocTypeAllowsFolders" className="text-xs cursor-pointer text-slate-600">Consenti cartelle</Label>
                                </div>
                                <Button
                                    size="icon"
                                    className="bg-blue-600 hover:bg-blue-700"
                                    onClick={handleAddJobConformitaDocType}
                                    disabled={addingJobConformitaDocType || !newJobConformitaDocTypeName.trim()}
                                >
                                    {addingJobConformitaDocType ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                </Button>
                            </div>
                            {loadingJobConformitaDocTypes ? (
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Caricamento tipi documento...
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {jobConformitaDocTypes.map(docType => (
                                        <div key={docType.id} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border bg-slate-50 dark:bg-slate-800">
                                            <span className="text-sm font-medium">{docType.name}</span>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <div className="flex items-center gap-1.5">
                                                    <Switch
                                                        checked={docType.allowsFolders}
                                                        onCheckedChange={(v) => handleToggleJobConformitaDocTypeFolders(docType.id, v)}
                                                    />
                                                    <span className="text-xs text-slate-500">Consenti cartelle</span>
                                                </div>
                                                <button
                                                    className="hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-1 transition-colors"
                                                    onClick={() => openRename("jobConformitaDocType", docType.id, docType.name)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5 text-slate-500" />
                                                </button>
                                                <button
                                                    className="hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full p-1 transition-colors"
                                                    onClick={() => handleDeleteJobConformitaDocType(docType.id)}
                                                >
                                                    <X className="h-3.5 w-3.5 text-slate-500" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {jobConformitaDocTypes.length === 0 && (
                                        <p className="text-sm text-muted-foreground italic">Nessun tipo di documento presente.</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Supplier group dialog */}
            <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingGroup ? "Modifica Gruppo" : "Nuovo Gruppo di Fatturazione Condivisa"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1">
                            <Label>Nome Gruppo</Label>
                            <Input
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                placeholder="Es. Fatturazione condivisa XYZ"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Fornitori associati (seleziona almeno 2)</Label>
                            <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                                {suppliers.filter(s => s.id !== editingGroup?.billingSupplierId).map(supplier => (
                                    <label key={supplier.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                                        <Checkbox
                                            checked={groupSupplierIds.includes(supplier.id)}
                                            onCheckedChange={() => toggleGroupSupplier(supplier.id)}
                                        />
                                        <span className="text-sm">{supplier.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 border-t pt-3">
                            <div>
                                <Label className="text-sm">Mostra in Ordini e Acquisti</Label>
                                <p className="text-xs text-muted-foreground">
                                    Se attivo, il fornitore "{groupName || 'di fatturazione'}" è selezionabile anche per registrare ordini e bolle. Se disattivo, è disponibile solo per le fatture.
                                </p>
                            </div>
                            <Switch checked={groupVisibleInPurchases} onCheckedChange={setGroupVisibleInPurchases} />
                        </div>
                        <div className="flex items-center justify-between gap-4 border-t pt-3">
                            <div>
                                <Label className="text-sm">Aggrega bolle dei fornitori associati</Label>
                                <p className="text-xs text-muted-foreground">
                                    Se attivo, selezionando questo fornitore in una fattura vedrai anche le bolle non fatturate dei fornitori associati. Se disattivo, vedrai solo le sue bolle.
                                </p>
                            </div>
                            <Switch checked={groupShowMembersInInvoices} onCheckedChange={setGroupShowMembersInInvoices} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGroupDialogOpen(false)}>Annulla</Button>
                        <Button onClick={handleSaveGroup} disabled={savingGroup || !groupName.trim()}>
                            {savingGroup && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salva
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename dialog */}
            <Dialog open={!!renameTarget} onOpenChange={(v) => !v && setRenameTarget(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Rinomina</DialogTitle></DialogHeader>
                    <div className="space-y-1 py-2">
                        <Label>Nome</Label>
                        <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameTarget(null)}>Annulla</Button>
                        <Button onClick={handleRename} disabled={renaming || !renameValue.trim()}>
                            {renaming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salva
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
