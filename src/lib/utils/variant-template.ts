// Schede personalizzate per la variante degli articoli.
//
// Ogni tipologia può avere una scheda: un elenco di campi (misure, scelte, testo) e un modello di testo.
// I valori inseriti compongono in modo uniforme il campo «variante / modello» e vengono salvati anche
// come dati strutturati (variant_attributes), così si possono cercare e filtrare.

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
}

export interface VariantTemplate {
    version: number;
    // Es. "{larghezza}x{ala}x{lunghezza} [sp. {spessore}]": i gruppi tra [ ] compaiono solo se tutti
    // i campi al loro interno sono compilati.
    pattern: string;
    fields: VariantField[];
}

export type VariantValues = Record<string, string>;

const TOKEN = /\{([a-zA-Z0-9_]+)\}/g;

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
    if (!template) return '';
    const byKey = new Map(template.fields.map(f => [f.key, f]));
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
    const withGroups = template.pattern.replace(/\[([^\]]*)\]/g, (_, inner: string) => {
        const { out, allFilled } = render(inner);
        return allFilled ? out : '';
    });
    // 2. campi singoli, poi spazi in eccesso
    return render(withGroups).out.replace(/\s+/g, ' ').trim();
};

// Campi obbligatori ancora vuoti (solo tra quelli visibili)
export const missingRequiredFields = (template: VariantTemplate | null | undefined, values: VariantValues): VariantField[] => {
    if (!template) return [];
    return template.fields.filter(f =>
        f.required && isFieldVisible(f, values) && (values[f.key] ?? '').trim() === ''
    );
};

export const defaultValues = (template: VariantTemplate | null | undefined): VariantValues => {
    const values: VariantValues = {};
    for (const f of template?.fields ?? []) {
        if (f.default !== undefined) values[f.key] = f.default;
    }
    return values;
};

// Dei valori inseriti tiene solo i campi visibili e non vuoti (è quello che si salva)
export const cleanValues = (template: VariantTemplate | null | undefined, values: VariantValues): VariantValues => {
    const result: VariantValues = {};
    for (const f of template?.fields ?? []) {
        if (!isFieldVisible(f, values)) continue;
        const v = (values[f.key] ?? '').trim();
        if (v !== '') result[f.key] = f.kind === 'number' ? formatNumberValue(v) : v;
    }
    return result;
};

// Valore del campo che coincide con la quantità per confezione (se la scheda lo prevede)
export const packQuantityFrom = (template: VariantTemplate | null | undefined, values: VariantValues): string => {
    const field = template?.fields.find(f => f.fillsPackQuantity);
    if (!field) return '';
    const raw = (values[field.key] ?? '').trim().replace(',', '.');
    const n = Number(raw);
    return raw !== '' && Number.isFinite(n) && n > 0 ? String(n) : '';
};

// Un campo scelto libera: nome della chiave a partire dall'etichetta (per l'editor delle schede)
export const keyFromLabel = (label: string): string =>
    label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'campo';
