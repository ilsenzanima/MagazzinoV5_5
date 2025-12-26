"use client";

import { useEffect, useState, useMemo } from "react";
import { deliveryNotesApi, DeliveryNote, DeliveryNoteItem } from "@/lib/api";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export default function PrintDeliveryNotePage({ params }: { params: { id: string } }) {
  const [note, setNote] = useState<DeliveryNote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNote = async () => {
      try {
        const data = await deliveryNotesApi.getById(params.id);
        setNote(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadNote();
  }, [params.id]);

  useEffect(() => {
      if (!loading && note) {
          setTimeout(() => {
            window.print();
          }, 500);
      }
  }, [loading, note]);

  // Group items logic consistent with detail page
  const groupedItems = useMemo(() => {
    if (!note?.items) return [];
    
    const grouped = new Map<string, DeliveryNoteItem>();
    
    note.items.forEach(item => {
        const key = item.inventoryId;
        
        if (grouped.has(key)) {
            const existing = grouped.get(key)!;
            grouped.set(key, {
                ...existing,
                quantity: existing.quantity + item.quantity,
            });
        } else {
            grouped.set(key, { ...item });
        }
    });
    
    return Array.from(grouped.values());
  }, [note]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>;
  if (!note) return <div>Bolla non trovata</div>;

  return (
    <div className="bg-white min-h-screen text-black p-8 max-w-[210mm] mx-auto print:p-0 print:max-w-none">
        <style jsx global>{`
            @media print {
                @page { margin: 10mm; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
        `}</style>
        {/* Header with Logo and Company Info */}
        <div className="flex justify-between items-start mb-8 pb-4 border-b-2 border-gray-800">
            <div className="w-1/2">
                 <div className="relative w-64 h-24 mb-2">
                    <Image 
                        src="/opi_logo.jpg" 
                        alt="OPI Logo" 
                        fill
                        className="object-contain object-left"
                        priority
                    />
                 </div>
            </div>
            <div className="w-1/2 text-right text-xs leading-relaxed">
                <h2 className="font-bold text-lg text-[#003366]">OPI Firesafe S.r.l.</h2>
                <p>Via della Tecnica, 10</p>
                <p>33048 San Giovanni al Natisone (UD)</p>
                <p>P.IVA 02817540306</p>
                <p>Tel. +39 0432 756111</p>
                <p>info@opifiresafe.it - www.opifiresafe.it</p>
            </div>
        </div>

        {/* Document Title and Meta */}
        <div className="mb-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold uppercase border-b-2 border-gray-800 pb-1">Documento di Trasporto (D.D.T.)</h1>
                <div className="text-right">
                    <p className="text-sm text-gray-600">Numero Documento</p>
                    <p className="text-xl font-bold">{note.number}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm">
                {/* Left Column: Dates and Transport */}
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <p className="font-bold text-gray-600">Data Documento</p>
                            <p>{format(new Date(note.date), 'dd/MM/yyyy')}</p>
                         </div>
                         <div>
                            <p className="font-bold text-gray-600">Causale</p>
                            <p>{note.causal || '-'}</p>
                         </div>
                    </div>
                    
                    <div className="border p-3 rounded bg-gray-50">
                        <p className="font-bold text-gray-600 mb-2 border-b pb-1">Trasporto</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <p className="text-xs text-gray-500">Vettore</p>
                                <p>{note.transportMean || 'Mittente'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Porto</p>
                                <p>Franco</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Aspetto Beni</p>
                                <p>{note.appearance || 'A vista'}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">N. Colli</p>
                                <p>{note.packagesCount || '-'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Recipient and Destination */}
                <div className="space-y-4">
                    <div className="border p-4 rounded border-gray-300">
                        <p className="font-bold text-gray-600 mb-1">Destinatario / Committente</p>
                        {note.jobCode && <p className="font-bold text-[#003366]">Commessa: {note.jobCode}</p>}
                        <p className="font-medium">{note.jobDescription}</p>
                        {/* If we had client info explicitly, we'd put it here */}
                    </div>
                    
                    <div className="border p-4 rounded border-gray-300">
                         <p className="font-bold text-gray-600 mb-1">Luogo di Destinazione</p>
                         <p>{note.deliveryLocation || note.jobAddress || note.pickupLocation || '-'}</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Items Table */}
        <div className="mb-8">
            <table className="w-full text-sm border-collapse">
                <thead>
                    <tr className="bg-[#003366] text-white">
                        <th className="text-left p-2 border border-[#003366] w-[15%]">Codice</th>
                        <th className="text-left p-2 border border-[#003366]">Descrizione</th>
                        <th className="text-center p-2 border border-[#003366] w-[10%]">U.M.</th>
                        <th className="text-right p-2 border border-[#003366] w-[10%]">Q.tà</th>
                    </tr>
                </thead>
                <tbody>
                    {groupedItems.map((item, idx) => (
                        <tr key={idx} className="border-b border-gray-200 break-inside-avoid">
                            <td className="p-2 border-l border-r border-gray-300 font-mono text-xs">{item.inventoryCode}</td>
                            <td className="p-2 border-r border-gray-300">
                                <p className="font-bold">{item.inventoryName}</p>
                                {item.inventoryDescription && <p className="text-xs text-gray-500">{item.inventoryDescription}</p>}
                            </td>
                            <td className="p-2 border-r border-gray-300 text-center">{item.inventoryUnit}</td>
                            <td className="p-2 border-r border-gray-300 text-right font-bold">{item.quantity}</td>
                        </tr>
                    ))}
                    {/* Empty rows filler if needed, but usually not for web print */}
                </tbody>
            </table>
        </div>

        {/* Notes */}
        {note.notes && (
            <div className="mb-8 border p-3 rounded bg-gray-50 text-sm">
                <p className="font-bold text-gray-600">Note:</p>
                <p>{note.notes}</p>
            </div>
        )}

        {/* Footer Signatures */}
        <div className="mt-auto pt-8 border-t-2 border-gray-800">
            <div className="grid grid-cols-3 gap-8 text-sm">
                <div className="text-center">
                    <div className="mb-12 border-b border-black"></div>
                    <p className="font-bold">Firma Conducente</p>
                </div>
                 <div className="text-center">
                    <div className="mb-12 border-b border-black"></div>
                    <p className="font-bold">Firma Trasportatore</p>
                </div>
                 <div className="text-center">
                    <div className="mb-12 border-b border-black"></div>
                    <p className="font-bold">Firma Destinatario</p>
                </div>
            </div>
            
            <div className="mt-8 text-center text-xs text-gray-400">
                <p>OPI Firesafe S.r.l. - Documento generato digitalmente il {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
            </div>
        </div>
    </div>
  );
}
