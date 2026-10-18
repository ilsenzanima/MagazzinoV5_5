// Calcoli di una riga di acquisto/ordine: pezzi, quantità, prezzo e totale restano coerenti tra loro.
// Stesse regole della tabella della pagina «Nuovo acquisto», per usarle anche nel modale a pagine.

export interface LineAmounts {
    pieces: string;
    quantity: string;
    price: string;
    total: string;
}

// Il coefficiente converte i pezzi nell'unità dell'articolo (es. 1 lastra = 3 MQ)
export function applyPieces(v: LineAmounts, coefficient: number, piecesStr: string): LineAmounts {
    const pieces = parseFloat(piecesStr);
    if (isNaN(pieces)) return { ...v, pieces: piecesStr, quantity: "", total: "" };
    const quantity = (pieces * coefficient).toFixed(2);
    const price = parseFloat(v.price);
    const total = !isNaN(price) && price > 0 ? (parseFloat(quantity) * price).toFixed(2) : v.total;
    return { ...v, pieces: piecesStr, quantity, total };
}

export function applyQuantity(v: LineAmounts, coefficient: number, quantityStr: string): LineAmounts {
    const quantity = parseFloat(quantityStr);
    if (isNaN(quantity)) return { ...v, quantity: quantityStr, pieces: "", total: "" };
    const pieces = coefficient !== 1 ? (quantity / coefficient).toFixed(2) : quantityStr;
    const price = parseFloat(v.price);
    const total = !isNaN(price) && price > 0 ? (quantity * price).toFixed(2) : v.total;
    return { ...v, quantity: quantityStr, pieces, total };
}

// Confezioni intere: la quantità è confezioni x quantità per confezione
export function applyPacks(v: LineAmounts, coefficient: number, packQuantity: number, packsStr: string): LineAmounts {
    const packs = parseFloat(packsStr);
    if (isNaN(packs) || !(packQuantity > 0)) return applyQuantity(v, coefficient, "");
    const quantity = Number((packs * packQuantity).toFixed(2));
    return applyQuantity(v, coefficient, String(quantity));
}

// Quante confezioni corrispondono alla quantità (nessun numero se non è un multiplo sensato)
export function packsFromQuantity(quantityStr: string, packQuantity: number | null | undefined): number | null {
    const quantity = parseFloat(quantityStr);
    if (isNaN(quantity) || !packQuantity || packQuantity <= 0) return null;
    return Number((quantity / packQuantity).toFixed(2));
}

export function applyPrice(v: LineAmounts, priceStr: string): LineAmounts {
    const price = parseFloat(priceStr);
    const quantity = parseFloat(v.quantity);
    const total = !isNaN(price) && !isNaN(quantity) && quantity > 0 ? (price * quantity).toFixed(2) : v.total;
    return { ...v, price: priceStr, total };
}

// Dal totale della riga (es. letto dalla bolla) si ricava il prezzo unitario
export function applyTotal(v: LineAmounts, totalStr: string): LineAmounts {
    const total = parseFloat(totalStr);
    const quantity = parseFloat(v.quantity);
    if (isNaN(total) || isNaN(quantity) || quantity === 0) return { ...v, total: totalStr };
    return { ...v, price: (total / quantity).toFixed(5), total: totalStr };
}

export type PriceCheckKind = "none" | "ok" | "higher" | "lower" | "pack";

export interface PriceCheck {
    kind: PriceCheckKind;
    message: string;
    suggestedPrice?: number;   // prezzo unitario proposto quando sembra riferito alla confezione
}

// Confronto del prezzo unitario inserito con quello di riferimento (stessa unità di misura dell'articolo)
export function checkPrice(opts: {
    price: number;
    reference: number | null | undefined;
    packQuantity?: number | null;
    unit?: string;
    tolerance?: number;      // scostamento accettato, 0,3 = 30%
}): PriceCheck {
    const { price, reference, packQuantity, unit = "", tolerance = 0.3 } = opts;
    if (!(price > 0) || !reference || !(reference > 0)) return { kind: "none", message: "" };

    // Prezzo di una confezione intera inserito al posto di quello unitario
    if (packQuantity && packQuantity > 1) {
        const packReference = reference * packQuantity;
        if (price / reference > 1 + tolerance && Math.abs(price / packReference - 1) <= 0.25) {
            const unitPrice = price / packQuantity;
            return {
                kind: "pack",
                suggestedPrice: Number(unitPrice.toFixed(5)),
                message: `Sembra il prezzo di una confezione intera (${packQuantity} ${unit}). Per ${unit || "unità"} sarebbe € ${unitPrice.toFixed(4)}.`.replace("  ", " "),
            };
        }
    }

    const delta = price / reference - 1;
    const percent = Math.round(Math.abs(delta) * 100);
    if (delta > tolerance) return { kind: "higher", message: `Il prezzo è più alto del ${percent}% rispetto al riferimento.` };
    if (delta < -tolerance) return { kind: "lower", message: `Il prezzo è più basso del ${percent}% rispetto al riferimento.` };
    return { kind: "ok", message: "In linea con il prezzo di riferimento." };
}
