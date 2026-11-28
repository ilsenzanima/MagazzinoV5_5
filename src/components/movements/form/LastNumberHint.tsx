"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { deliveryNotesApi } from "@/lib/services/delivery-notes";
import { buildNoteNumber, numberDigits } from "@/lib/utils/note-number";

type NumberInfo = Awaited<ReturnType<typeof deliveryNotesApi.getNumberInfo>>;

interface Props {
    numberPart: string;
    yearSuffix: string;
    draftId?: string;
    transfer: boolean;
    onUse: (numberPart: string) => void;
}

// Sotto il campo Numero di una bolla nuova: ultimo numero usato, prossimo proposto e avviso di doppione
export function LastNumberHint({ numberPart, yearSuffix, draftId, transfer, onUse }: Props) {
    const [result, setResult] = useState<{ number: string; yearSuffix: string; transfer: boolean; info: NumberInfo } | null>(null);
    const number = buildNoteNumber(numberPart, yearSuffix, transfer);

    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(() => {
            deliveryNotesApi.getNumberInfo(yearSuffix, number, draftId, transfer)
                .then((info) => { if (!cancelled) setResult({ number, yearSuffix, transfer, info }); })
                .catch((error) => console.error("Failed to load last number", error));
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [number, yearSuffix, draftId, transfer]);

    if (!result || result.yearSuffix !== yearSuffix || result.transfer !== transfer) return null;
    const { lastNote, lastDraft, alreadyUsed } = result.info;
    const next = numberDigits(String(Math.max(lastNote?.numberInt ?? 0, lastDraft?.numberInt ?? 0) + 1), transfer);
    const describe = (n: { number: string; date: string }) => `${n.number} del ${format(new Date(n.date), "dd/MM/yyyy")}`;
    // Le bozze contano solo se hanno un numero più avanti dell'ultima bolla
    const draftAhead = lastDraft && lastDraft.numberInt > (lastNote?.numberInt ?? 0) ? lastDraft : null;

    return (
        <div className="mt-1 space-y-0.5 text-xs">
            {alreadyUsed && result.number === number && (
                <p className="font-medium text-red-600 dark:text-red-400">Il numero {number} è già usato da un&apos;altra bolla.</p>
            )}
            <p className="text-slate-500">
                {lastNote
                    ? `${transfer ? "Ultimo trasferimento" : "Ultima bolla"}: ${describe(lastNote)}.`
                    : `${transfer ? "Nessun trasferimento con la T" : "Nessuna bolla"} /PP${yearSuffix} finora.`}
                {draftAhead && ` In bozza: ${describe(draftAhead)}.`}
                {number !== buildNoteNumber(next, yearSuffix, transfer) && (
                    <button type="button" onClick={() => onUse(next)} className="ml-1 font-medium text-blue-700 underline dark:text-blue-300">
                        Usa {transfer ? `T${next}` : next}
                    </button>
                )}
            </p>
        </div>
    );
}
