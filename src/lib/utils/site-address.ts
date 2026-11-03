// Indirizzo del cantiere scritto in un unico campo di testo (commesse) -> campi separati (offerte)

export interface ParsedSiteAddress {
    street: string;
    streetNumber: string;
    postalCode: string;
    city: string;
    province: string;
}

const STREET_START = /^(via|viale|v\.|piazza|piazzale|corso|largo|strada|vicolo|loc\.|località|localita|borgo|contrada|frazione|fraz\.)\b/i;
const clean = (t: string) => t.replace(/^[\s,\-–]+|[\s,\-–]+$/g, "").replace(/\s{2,}/g, " ");

// Riconoscimento a buon fine: se non riesce a separare i pezzi mette tutto nella via, e l'utente corregge
export function parseSiteAddress(text: string | null | undefined): ParsedSiteAddress {
    let rest = String(text ?? "").trim();
    const out: ParsedSiteAddress = { street: "", streetNumber: "", postalCode: "", city: "", province: "" };
    if (!rest) return out;

    const prov = rest.match(/\(\s*([A-Za-z]{2})\s*\)/);
    if (prov) {
        out.province = prov[1].toUpperCase();
        rest = clean(rest.replace(prov[0], " "));
    }

    const cap = rest.match(/\b(\d{5})\b/);
    let before = rest;
    if (cap && cap.index !== undefined) {
        out.postalCode = cap[1];
        before = clean(rest.slice(0, cap.index));
        out.city = clean(rest.slice(cap.index + cap[0].length));
    }

    // "Via Roma, 10" / "Via Roma 10"
    const withNumber = before.match(/^(.*?)[,\s]+(\d+[\w/-]*)$/);
    if (withNumber && STREET_START.test(withNumber[1])) {
        out.street = clean(withNumber[1]);
        out.streetNumber = withNumber[2];
    } else if (!cap) {
        // senza CAP: "Via Udine, 43 Gradisca d'Isonzo"
        const withCity = before.match(/^(.*?)[,\s]+(\d+[\w/-]*)\s+(\D.+)$/);
        if (withCity && STREET_START.test(withCity[1])) {
            out.street = clean(withCity[1]);
            out.streetNumber = withCity[2];
            out.city = clean(withCity[3]);
        } else if (STREET_START.test(before)) {
            out.street = before;
        } else if (before) {
            // solo un luogo ("TOLMEZZO")
            out.city = before;
        }
    } else {
        out.street = before;
    }

    if (!out.street && !out.city && !out.postalCode) out.street = String(text ?? "").trim();
    return out;
}
