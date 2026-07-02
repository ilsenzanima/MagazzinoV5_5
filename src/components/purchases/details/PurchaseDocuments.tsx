"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Upload, Trash2, ExternalLink, Loader2, Camera } from "lucide-react"
import { purchasesApi } from "@/lib/api"
import { useState } from "react"
import { DocumentScanner } from "@/components/ui/document-scanner"
import { notify } from "@/lib/notify"
import { createClient } from "@/lib/supabase/client"
import { deleteDriveFileIfApplicable } from "@/lib/services/utils"
import { useBatchUpload } from "@/hooks/useBatchUpload"
import { UploadStatusBar } from "@/components/ui/upload-status-row"

interface PurchaseDocumentsProps {
  purchaseId: string;
  documentUrls?: string[];
  onUpdate: () => void;
  isOrder?: boolean;
  supplierName?: string;
}

export function PurchaseDocuments({ purchaseId, documentUrls = [], onUpdate, isOrder = false, supplierName }: PurchaseDocumentsProps) {
  const supabase = createClient();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const batchUpload = useBatchUpload();

  const openDocument = async (url: string) => {
    if (!url.includes('/')) {
      window.open(`/api/drive/download?fileId=${encodeURIComponent(url)}&fileName=documento.pdf`, '_blank');
      return;
    }
    try {
      const path = url.split('/public/documents/')[1];
      if (!path) { window.open(url, '_blank'); return; }
      const { data, error } = await supabase.storage.from('documents').createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) { window.open(url, '_blank'); return; }
      window.open(data.signedUrl, '_blank');
    } catch {
      window.open(url, '_blank');
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (!files.length) return;
    setIsUploading(true);
    setUploadingFiles(files);
    const uploadedUrls: string[] = [];
    const { failedCount } = await batchUpload.run(files, async (file) => {
      const url = await purchasesApi.uploadDocument(file, supplierName);
      uploadedUrls.push(url);
    });
    try {
      if (uploadedUrls.length) {
        const updated = [...documentUrls, ...uploadedUrls];
        await purchasesApi.update(purchaseId, { documentUrls: updated });
        onUpdate();
      }
      if (failedCount > 0) {
        notify.error(failedCount > 1 ? `${failedCount} documenti non caricati` : "Errore durante il caricamento del documento");
      }
    } catch (error) {
      console.error("Failed to save uploaded documents", error);
      notify.error("Errore durante il salvataggio dei documenti caricati");
    } finally {
      setIsUploading(false);
      setUploadingFiles([]);
      batchUpload.reset();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await uploadFiles(files);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) await uploadFiles(files);
  };

  const handleScanComplete = async (pdfBlob: Blob) => {
    const file = new File([pdfBlob], `scan_${Date.now()}.pdf`, { type: 'application/pdf' });
    await uploadFiles([file]);
  };

  const handleDelete = async (index: number) => {
    if (!confirm("Sei sicuro di voler eliminare questo documento?")) return;
    try {
      setDeletingIndex(index);
      const removedUrl = documentUrls[index];
      const updated = documentUrls.filter((_, i) => i !== index);
      await purchasesApi.update(purchaseId, { documentUrls: updated });
      await deleteDriveFileIfApplicable(removedUrl);
      onUpdate();
    } catch (error) {
      console.error("Failed to delete document", error);
      notify.error("Errore durante l'eliminazione del documento");
    } finally {
      setDeletingIndex(null);
    }
  };

  return (
    <>
      <Card
        className={`transition-colors duration-200 ${isDragging ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 py-4">
          <CardTitle className="text-base font-semibold">{isOrder ? "Documenti (Ordine)" : "Documenti (DDT / Fattura)"}</CardTitle>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowScanner(true)}
              disabled={isUploading}
            >
              <Camera className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Scansiona</span>
            </Button>
            <div className="relative">
              <input
                type="file"
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={handleFileUpload}
                disabled={isUploading}
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <Button variant="outline" size="sm" disabled={isUploading}>
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                <span className="hidden sm:inline">{isUploading ? "Caricamento..." : "Carica"}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {uploadingFiles.length > 0 && (
            <div className="space-y-2 mb-3">
              {uploadingFiles.map((file, index) => (
                <div key={index} className="p-3 border dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{file.name}</p>
                  <UploadStatusBar state={batchUpload.statuses[index]} />
                </div>
              ))}
            </div>
          )}
          {documentUrls.length > 0 ? (
            <div className="space-y-2">
              {documentUrls.map((url, index) => (
                <div key={index} className="flex items-center justify-between p-3 border dark:border-slate-700 rounded-md bg-slate-50 dark:bg-slate-800">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded flex-shrink-0">
                      <FileText className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="overflow-hidden min-w-0">
                      <p className="font-medium text-sm truncate text-slate-900 dark:text-slate-100">
                        Documento {documentUrls.length > 1 ? index + 1 : "Allegato"}
                      </p>
                      <button
                        onClick={() => openDocument(url)}
                        className="text-xs text-blue-600 hover:underline flex items-center mt-0.5"
                      >
                        Apri Documento <ExternalLink className="h-3 w-3 ml-1" />
                      </button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 flex-shrink-0"
                    onClick={() => handleDelete(index)}
                    disabled={deletingIndex !== null}
                  >
                    {deletingIndex === index ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 border-2 border-dashed dark:border-slate-600 rounded-md bg-slate-50/50 dark:bg-slate-800/50">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {isDragging ? "Rilascia i file qui..." : "Trascina qui uno o più file o usa il pulsante Carica"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <DocumentScanner
        open={showScanner}
        onOpenChange={setShowScanner}
        onScanComplete={handleScanComplete}
      />
    </>
  );
}
