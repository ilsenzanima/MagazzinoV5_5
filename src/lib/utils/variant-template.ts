// Schede personalizzate per la variante degli articoli.
//
// Ogni tipologia può avere una scheda: un elenco di campi (misure, scelte, testo) e un modello di testo.
// Una scheda può avere dei SOTTOTIPI (es. nelle Porte: porta, telaio, maniglione…): non sono nuove
// tipologie, servono solo a scegliere quali campi chiedere. I valori inseriti compongono in modo uniforme
// il campo «variante / modello» e vengono salvati anche come dati strutturati (variant_attributes).

export type VariantFieldKind = 'number' | 'text' | 'choice';

export interface VariantField {
    key: string;
    label: string;
    kind: VariantFieldKind;
    unit?: string;                                  // mostrata accanto al campo (es. mm)
    options?: string[];                             // scelte proposte (kind = choice)
    open?: boolean;                                 // lista aperta: si può scrivere un valore nuovo
    required?: boolean;
    showIf?: { key: string; equals: string };       // campo condizionato da un altro (es. Ante = 2A)
    default?: string;
    hideWhenDefault?: boolean;                      // il valore standard non compare nella variante
    hint?: string;
    fillsPackQuantity?: boolean;                    // il valore è anche la quantità per confezione
    packWhenUnit?: string;                          // ...ma solo con questa unità dell'articolo (es. KG)
    hideFromVariant?: boolean;                      // dato strutturato: non compare nel testo della variante
}

// Coefficiente suggerito dalle misure: area (lastre in MQ) o lunghezza in metri (profili in ML)
export interface VariantCoefficientRule {
    kind: 'area' | 'length';
    widthKey?: string;                              // solo per l'area
    lengthKey: string;                              // campo in mm
    whenUnit: string;                               // si applica solo con questa unità (MQ, ML)
}

// Confezione calcolata dai fogli: con unità MQ sono i m² (fogli × area del foglio), con PZ i fogli stessi
export interface VariantPackRule {
    sheetsKey: string;
    widthKey: string;
    lengthKey: string;
}

export interface VariantSection {
    // Es. "{larghezza}x{ala}x{lunghezza} [sp.{spessore}]": i gruppi tra [ ] compaiono solo se tutti
    // i campi al loro interno sono compilati.
    pattern: string;
    fields: VariantField[];
    coefficient?: VariantCoefficientRule;
    packFromSheets?: VariantPackRule;
}

export interface VariantSubtype extends VariantSection {
    key: string;
    label: string;
    suggestedName?: string;                         // nome proposto se il nome è ancora vuoto
}

export interface VariantTemplate extends VariantSection {
    version: number;
    subtypeLabel?: string;                          // es. "Componente"
    subtypes?: VariantSubtype[];
}

export type VariantValues = Record<string, string>;

// Il sottotipo scelto si salva insieme agli altri valori
export const SUBTYPE_KEY = '_sottotipo';

const TOKEN = /\{([a-zA-Z0-9_]+)\}/g;

export const hasSubtypes = (template: VariantTemplate | null | undefined): boolean =>
    !!template?.subtypes && template.subtypes.length > 0;

export const findSubtype = (template: VariantTemplate | null | undefined, values: VariantValues): VariantSubtype | null =>
    template?.subtypes?.find(s => s.key === values[SUBTYPE_KEY]) ?? null;

// Campi, modello e regola del coefficiente validi per i valori inseriti (null se serve ancora scegliere il sottotipo)
export const effectiveSection = (template: VariantTemplate | null | undefined, values: VariantValues): VariantSection | null => {
    if (!template) return null;
    if (hasSubtypes(template)) return findSubtype(template, values);
    return template;
};

export const isFieldVisible = (field: VariantField, values: VariantValues): boolean => {
    if (!field.showIf) return true;
    return (values[field.showIf.key] ?? '').trim() === field.showIf.equals;
};

// Numeri con la virgola decimale; il testo non numerico resta com'è
export const formatNumberValue = (raw: string): string => {
    const trimmed = raw.trim().replace(',', '.');
    if (trimmed === '') return '';
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return raw.trim();
    return String(n).replace('.', ',');
};

const renderField = (field: VariantField | undefined, values: VariantValues): string => {
    if (!field || !isFieldVisible(field, values)) return '';
    const raw = (values[field.key] ?? '').trim();
    if (raw === '') return '';
    if (field.hideWhenDefault && field.default !== undefined && raw === field.default) return '';
    return field.kind === 'number' ? formatNumberValue(raw) : raw;
};

export const composeVariant = (template: VariantTemplate | null | undefined, values: VariantValues): string => {
    const section = effectiveSection(template, values);
    if (!section) return '';
    const byKey = new Map(section.fields.map(f => [f.key, f]));
    const render = (text: string): { out: string; allFilled: boolean } => {
        let allFilled = true;
        const out = text.replace(TOKEN, (_, key: string) => {
            const value = renderField(byKey.get(key), values);
            if (value === '') allFilled = false;
            return value;
        });
        return { out, allFilled };
    };

    // 1. gruppi facoltativi [ ... ]
    const withGroups = section.pattern.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
        const { out, allFilled } = render(inner);
        return allFilled ? out : '';
    });
    // 2. campi singoli, poi spazi in eccesso
    return render(withGroups).out.replace(/\s+/g, ' ').trim();
};

// Campi obbligatori ancora vuoti (solo tra quelli visibili); se manca il sottotipo è quello il primo
export const missingRequiredFields = (template: VariantTemplate | null | undefined, values: VariantValues): VariantField[] => {
    if (!template) return [];
    if (hasSubtypes(template) && !findSubtype(template, values)) {
        return [{ key: SUBTYPE_KEY, label: template.subtypeLabel || 'Sottotipo', kind: 'choice', required: true }];
    }
    const section = effectiveSection(template, values);
    return (section?.fields ?? []).filter(f =>
        f.required && isFieldVisible(f, values) && (values[f.key] ?? '').trim() === ''
    );
};

// Valori predefiniti; con i sottotipi servono quelli del sottotipo scelto
export const defaultValues = (template: VariantTemplate | null | undefined, subtypeKey?: string): VariantValues => {
    const values: VariantValues = {};
    if (!template) return values;
    if (hasSubtypes(template)) {
        const sub = template.subtypes!.find(s => s.key === subtypeKey);
        if (!sub) return values;
        values[SUBTYPE_KEY] = sub.key;
        for (const f of sub.fields) if (f.default !== undefined) values[f.key] = f.default;
        return values;
    }
    for (const f of template.fields) if (f.default !== undefined) values[f.key] = f.default;
    return values;
};

// Dei valori inseriti tiene solo i campi visibili e non vuoti (è quello che si salva)
export const cleanValues = (template: VariantTemplate | null | undefined, values: VariantValues): VariantValues => {
    const result: VariantValues = {};
    const section = effectiveSection(template, values);
    if (!section) return result;
    if (hasSubtypes(template)) result[SUBTYPE_KEY] = values[SUBTYPE_KEY];
    for (const f of section.fields) {
        if (!isFieldVisible(f, values)) continue;
        const v = (values[f.key] ?? '').trim();
        if (v !== '') result[f.key] = f.kind === 'number' ? formatNumberValue(v) : v;
    }
    return result;
};

// Valore del campo che coincide con la quantità per confezione (se la scheda lo prevede)
export const packQuantityFrom = (template: VariantTemplate | null | undefined, values: VariantValues): string => {
    const field = effectiveSection(template, values)?.fields.find(f => f.fillsPackQuantity);
    if (!field) return '';
    const raw = (values[field.key] ?? '').trim().replace(',', '.');
    const n = Number(raw);
    return raw !== '' && Number.isFinite(n) && n > 0 ? String(n) : '';
};

const toNumber = (raw: string | undefined): number | null => {
    const n = Number((raw ?? '').trim().replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
};

// Coefficiente suggerito dalle misure e dall'unità scelta: area in m² (lastre in MQ) o lunghezza in m (profili in ML)
export const coefficientFrom = (
    template: VariantTemplate | null | undefined,
    values: VariantValues,
    unit: string
): number | null => {
    const rule = effectiveSection(template, values)?.coefficient;
    if (!rule || rule.whenUnit.toLowerCase() !== unit.trim().toLowerCase()) return null;
    const length = toNumber(values[rule.lengthKey]);
    if (length === null) return null;
    if (rule.kind === 'length') return Math.round((length / 1000) * 10000) / 10000;
    const width = toNumber(rule.widthKey ? values[rule.widthKey] : undefined);
    if (width === null) return null;
    return Math.round((width * length / 1_000_000) * 10000) / 10000;
};

// Quantità per confezione suggerita dalla scheda e dall'unità scelta: dai fogli per confezione
// (m² con MQ, pezzi con PZ) oppure dal campo che coincide con la confezione (es. peso in KG)
export const suggestedPackQuantity = (
    template: VariantTemplate | null | undefined,
    values: VariantValues,
    unit: string
): number | null => {
    const section = effectiveSection(template, values);
    if (!section) return null;
    const u = unit.trim().toLowerCase();

    const rule = section.packFromSheets;
    if (rule) {
        const sheets = toNumber(values[rule.sheetsKey]);
        if (sheets !== null) {
            if (u === 'pz') return sheets;
            if (u === 'mq') {
                const w = toNumber(values[rule.widthKey]);
                const l = toNumber(values[rule.lengthKey]);
                if (w !== null && l !== null) return Math.round((sheets * w * l / 1_000_000) * 10000) / 10000;
            }
        }
    }

    const field = section.fields.find(f => f.fillsPackQuantity && (!f.packWhenUnit || f.packWhenUnit.toLowerCase() === u));
    if (field && isFieldVisible(field, values)) return toNumber(values[field.key]);
    return null;
};

// Chiave a partire dall'etichetta (per l'editor delle schede)
export const keyFromLabel = (label: string): string =>
    label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'campo';
