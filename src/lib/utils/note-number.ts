// Numero bolla: "12/PP26"; i trasferimenti hanno una numerazione loro: "T01/PP26".
// Ogni anno (suffisso /PPyy) entrambe le numerazioni ripartono.

// Parte numerica come va scritta: per i trasferimenti senza la T e con almeno due cifre
export const numberDigits = (value: string, isTransfer: boolean) => {
    const text = value.trim();
    if (!isTransfer) return text;
    const digits = text.replace(/^t/i, "").trim();
    return /^\d+$/.test(digits) ? digits.padStart(2, "0") : digits;
};

export const buildNoteNumber = (numberPart: string, yearSuffix: string, isTransfer: boolean) => {
    const digits = numberDigits(numberPart, isTransfer);
    return `${isTransfer && digits ? "T" : ""}${digits}/PP${yearSuffix}`;
};

// "T07/PP26" -> 7; null se non è un numero di trasferimento
export const transferSequence = (number: string) => {
    const match = /^T(\d+)\//.exec(number);
    return match ? Number(match[1]) : null;
};
