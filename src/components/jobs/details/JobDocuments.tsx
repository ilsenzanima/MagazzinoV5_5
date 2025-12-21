"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Upload, Download, Trash2 } from "lucide-react"

export function JobDocuments() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-slate-800">Documenti Cantiere</h2>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Carica Documento
        </Button>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-slate-500">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">Nessun documento</h3>
          <p>Carica progetti, permessi, o foto del cantiere.</p>
          <Button className="mt-4" variant="secondary">
            Sfoglia file
          </Button>
        </CardContent>
      </Card>
      
      {/* Mock of what it will look like */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50 pointer-events-none filter blur-[1px]">
         <Card>
            <CardContent className="p-4 flex items-start gap-3">
                <div className="bg-red-100 p-2 rounded">
                    <FileText className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1 overflow-hidden">
                    <p className="font-medium truncate">Permesso_Costruire.pdf</p>
                    <p className="text-xs text-slate-500">2.4 MB • 12 Ott 2023</p>
                </div>
            </CardContent>
         </Card>
      </div>
    </div>
  )
}
