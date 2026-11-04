// Commesse dello stesso cantiere (catena di "nuovo inizio"): per ognuna, le altre della catena in ordine di data
import type { JobChainItem } from "@/lib/types";

export function buildJobLinks(rows: JobChainItem[]): Map<string, JobChainItem[]> {
    const byId = new Map(rows.map(r => [r.id, r]));
    // gruppi: ogni commessa si unisce a quella da cui parte
    const parent = new Map<string, string>();
    const find = (id: string): string => {
        let root = id;
        while (parent.get(root) && parent.get(root) !== root) root = parent.get(root)!;
        return root;
    };
    rows.forEach(r => parent.set(r.id, r.id));
    rows.forEach(r => {
        if (r.originJobId && byId.has(r.originJobId)) parent.set(find(r.id), find(r.originJobId));
    });
    const groups = new Map<string, JobChainItem[]>();
    rows.forEach(r => {
        const key = find(r.id);
        groups.set(key, [...(groups.get(key) ?? []), r]);
    });
    const out = new Map<string, JobChainItem[]>();
    groups.forEach(members => {
        if (members.length < 2) return;
        const sorted = [...members].sort((a, b) => String(a.startDate ?? "").localeCompare(String(b.startDate ?? "")));
        members.forEach(m => out.set(m.id, sorted.filter(x => x.id !== m.id)));
    });
    return out;
}
