import { ClipboardList, Receipt } from "lucide-react";
import type { DocumentKind } from "@/lib/services/purchase-documents";

export const KIND_LABEL: Record<DocumentKind, string> = { purchase: "Acquisto", order: "Ordine", invoice: "Fattura" };

// Stessi colori dei banner di collegamento nella scheda del documento: fattura blu, ordine ambra, acquisto verde
const KIND_STYLE: Record<DocumentKind, string> = {
  purchase: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800",
  order: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800",
  invoice: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800",
};
const KIND_ICON: Record<DocumentKind, typeof Receipt> = { purchase: ClipboardList, order: ClipboardList, invoice: Receipt };

export function KindBadge({ kind }: { kind: DocumentKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${KIND_STYLE[kind]}`}>
      <Icon className="h-3.5 w-3.5" />
      {KIND_LABEL[kind]}
    </span>
  );
}
