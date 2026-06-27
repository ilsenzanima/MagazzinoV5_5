/**
 * Migrazione una tantum: scarica i file ancora ospitati su Supabase Storage
 * (URL pubblici salvati nelle colonne file_url/document_url/document_urls)
 * e li carica su Google Drive, producendo un file di mapping con i nuovi
 * fileId. NON tocca il database: l'aggiornamento delle colonne va fatto
 * separatamente (via Supabase MCP) leggendo l'output di questo script.
 * NON elimina i file originali da Supabase Storage.
 *
 * Uso: node scripts/migrate-storage-to-drive.js <dataset.json> <output.json>
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { google } = require('googleapis');

const datasetPath = process.argv[2];
const outputPath = process.argv[3];

if (!datasetPath || !outputPath) {
    console.error('Uso: node scripts/migrate-storage-to-drive.js <dataset.json> <output.json>');
    process.exit(1);
}

function getOAuthClient() {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Variabili GOOGLE_DRIVE_* non configurate in .env.local');
    }
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
}

const drive = google.drive({ version: 'v3', auth: getOAuthClient() });
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;

const folderCache = new Map();

async function findOrCreateFolder(name, parentId) {
    const key = `${parentId}::${name}`;
    if (folderCache.has(key)) return folderCache.get(key);

    const safeName = name.replace(/'/g, "\\'");
    const existing = await drive.files.list({
        q: `'${parentId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    let id;
    if (existing.data.files && existing.data.files.length > 0) {
        id = existing.data.files[0].id;
    } else {
        const created = await drive.files.create({
            requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
            fields: 'id',
        });
        id = created.data.id;
    }
    folderCache.set(key, id);
    return id;
}

async function ensureFolderPath(segments) {
    let parentId = ROOT_FOLDER_ID;
    for (const segment of segments) {
        parentId = await findOrCreateFolder(segment, parentId);
    }
    return parentId;
}

function guessMimeType(fileName) {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const map = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        doc: 'application/msword',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        xls: 'application/vnd.ms-excel',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return map[ext] || 'application/octet-stream';
}

function fileNameFromUrl(url) {
    const last = url.split('/').pop() || 'documento';
    try {
        return decodeURIComponent(last);
    } catch {
        return last;
    }
}

async function uploadBufferToDrive(folderId, fileName, buffer) {
    const { Readable } = require('stream');
    const res = await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: { mimeType: guessMimeType(fileName), body: Readable.from(buffer) },
        fields: 'id, name, webViewLink',
    });
    return { fileId: res.data.id, name: res.data.name, webViewLink: res.data.webViewLink };
}

async function downloadFromUrl(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} scaricando ${url}`);
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

async function migrateOne(url, folderPathSegments) {
    const buffer = await downloadFromUrl(url);
    const fileName = fileNameFromUrl(url);
    const folderId = await ensureFolderPath(folderPathSegments);
    const uploaded = await uploadBufferToDrive(folderId, fileName, buffer);
    return uploaded.fileId;
}

const TABLE_HANDLERS = {
    job_documents: (row) => ({
        urls: [row.file_url],
        folderPath: ['Cantieri', `${row.code} ${row.name}`.trim(), 'Documenti'],
    }),
    supplier_compliance_documents: (row) => ({
        urls: [row.file_url],
        folderPath: ['Fornitori', row.supplier_name || 'Senza fornitore', 'Compliance'],
    }),
    purchases: (row) => ({
        urls: Array.isArray(row.document_urls) && row.document_urls.length ? row.document_urls : [row.document_url].filter(Boolean),
        folderPath: ['Fornitori', row.supplier_name || 'Senza fornitore', 'Acquisti'],
    }),
    invoices: (row) => ({
        urls: row.document_urls || [],
        folderPath: ['Fornitori', row.supplier_name || 'Senza fornitore', 'Fatture'],
    }),
    shared_documents: (row) => ({
        urls: [row.file_url],
        folderPath: row.job_code
            ? ['Cantieri', `${row.job_code} ${row.job_name}`.trim(), 'Condivisi']
            : ['Proposte', row.proposal_id || 'Senza proposta'],
    }),
    shared_supplier_offers: (row) => ({
        urls: [row.file_url],
        folderPath: row.job_code
            ? ['Cantieri', `${row.job_code} ${row.job_name}`.trim(), 'Offerte Fornitori']
            : ['Proposte', row.proposal_id || 'Senza proposta'],
    }),
};

async function main() {
    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
    const results = [];
    const errors = [];

    for (const [table, rows] of Object.entries(dataset)) {
        const handler = TABLE_HANDLERS[table];
        if (!handler) {
            console.warn(`Nessun handler per la tabella ${table}, salto`);
            continue;
        }
        let i = 0;
        for (const row of rows) {
            i++;
            const { urls, folderPath } = handler(row);
            const validUrls = urls.filter((u) => typeof u === 'string' && u.includes('/public/documents/'));
            if (!validUrls.length) continue;

            const newFileIds = [];
            for (const url of validUrls) {
                try {
                    const fileId = await migrateOne(url, folderPath);
                    newFileIds.push({ oldUrl: url, fileId });
                    console.log(`[${table}] (${i}/${rows.length}) ${row.id} OK -> ${fileId}`);
                } catch (err) {
                    console.error(`[${table}] (${i}/${rows.length}) ${row.id} ERRORE: ${err.message}`);
                    errors.push({ table, id: row.id, url, error: err.message });
                }
            }
            if (newFileIds.length) {
                results.push({ table, id: row.id, mappings: newFileIds });
            }
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify({ results, errors }, null, 2));
    console.log(`\nFatto. ${results.length} righe migrate, ${errors.length} errori.`);
    console.log(`Output scritto in ${outputPath}`);
}

main().catch((err) => {
    console.error('Errore fatale:', err);
    process.exit(1);
});
