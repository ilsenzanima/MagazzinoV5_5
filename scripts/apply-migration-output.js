/**
 * Applica al database i fileId Google Drive prodotti da migrate-storage-to-drive.js.
 * Sovrascrive file_url/document_url/document_urls con il fileId Drive (convenzione
 * già usata dall'app: vedi src/lib/services/purchases.ts uploadDocument).
 * Uso: node scripts/apply-migration-output.js <output.json>
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const outputPath = process.argv[2];
if (!outputPath) {
    console.error('Uso: node scripts/apply-migration-output.js <output.json>');
    process.exit(1);
}

const SINGLE_URL_TABLES = {
    job_documents: 'file_url',
    supplier_compliance_documents: 'file_url',
    shared_documents: 'file_url',
    shared_supplier_offers: 'file_url',
};

async function main() {
    const { results } = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    let ok = 0;
    const errors = [];

    for (const row of results) {
        const fileIds = row.mappings.map((m) => m.fileId);
        let update;

        if (SINGLE_URL_TABLES[row.table]) {
            update = { [SINGLE_URL_TABLES[row.table]]: fileIds[0] };
        } else if (row.table === 'purchases') {
            update = { document_url: fileIds[0], document_urls: fileIds };
        } else if (row.table === 'invoices') {
            update = { document_urls: fileIds };
        } else {
            console.warn(`Tabella senza regola di update: ${row.table}, salto`);
            continue;
        }

        const { error } = await supabase.from(row.table).update(update).eq('id', row.id);
        if (error) {
            console.error(`[${row.table}] ${row.id} ERRORE: ${error.message}`);
            errors.push({ table: row.table, id: row.id, error: error.message });
        } else {
            ok++;
            console.log(`[${row.table}] ${row.id} OK`);
        }
    }

    console.log(`\nFatto. ${ok} righe aggiornate, ${errors.length} errori.`);
    if (errors.length) {
        fs.writeFileSync(path.join(__dirname, 'apply-migration-errors.json'), JSON.stringify(errors, null, 2));
        console.log('Errori scritti in scripts/apply-migration-errors.json');
    }
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});
