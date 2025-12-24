"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Upload, Trash2, ExternalLink, Loader2 } from "lucide-react"
import { purchasesApi } from "@/lib/api"
import { useState } from "react"

interface PurchaseDocumentsProps {
  purchaseId: string;
  documentUrl?: string | null;
  onUpdate: () => void;
}

export function PurchaseDocuments({ purchaseId, documentUrl, onUpdate }: PurchaseDocumentsProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const url = await purchasesApi.uploadDocument(file);
      await purchasesApi.update(purchaseId, { documentUrl: url });
      onUpdate();
    } catch (error) {
      console.error("Failed to upload document", error);
      alert("Errore durante il caricamento del documento");
    } finally {
      setIsUploading(false);
      // Reset input value to allow re-uploading same file if needed
      e.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!confirm("Sei sicuro di voler eliminare il documento?")) return;

    try {
      setIsDeleting(true);
      await purchasesApi.update(purchaseId, { documentUrl: null }); 
      onUpdate();
    } catch (error) {
      console.error("Failed to delete document", error);
      alert("Errore durante l'eliminazione del documento");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <CardTitle className="text-base font-semibold">Documento (DDT / Fattura)</CardTitle>
        {!documentUrl && (
          <div className="relative">
             <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={handleFileUpload}
                disabled={isUploading}
                accept=".pdf,.jpg,.jpeg,.png"
              />
            <Button variant="outline" size="sm" disabled={isUploading}>
              {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {isUploading ? "Caricamento..." : "Carica"}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {documentUrl ? (
          <div className="flex items-center justify-between p-3 border rounded-md bg-slate-50">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-blue-100 p-2 rounded flex-shrink-0">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="overflow-hidden min-w-0">
                <p className="font-medium text-sm truncate text-slate-900">Documento Allegato</p>
                <a 
                  href={documentUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center mt-0.5"
                >
                  Apri Documento <ExternalLink className="h-3 w-3 ml-1" />
                </a>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-slate-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 border-2 border-dashed rounded-md bg-slate-50/50">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nessun documento allegato</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
