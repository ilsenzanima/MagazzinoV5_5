import { google } from 'googleapis';

/**
 * Modulo server-only per l'integrazione con Google Drive.
 * Soluzione temporanea (account personale) in attesa dello storage nativo
 * che IT fornirà sui propri server. Non importare questo file da componenti client.
 */

if (typeof window !== 'undefined') {
    throw new Error('google-drive.ts è server-only, non può essere importato da codice client');
}

function getOAuthClient() {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Variabili GOOGLE_DRIVE_* non configurate');
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
}

function getDriveClient() {
    return google.drive({ version: 'v3', auth: getOAuthClient() });
}

function getRootFolderId(): string {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) throw new Error('GOOGLE_DRIVE_FOLDER_ID non configurato');
    return folderId;
}

/**
 * Trova una sottocartella per nome dentro il parent indicato, oppure la crea.
 */
async function findOrCreateFolder(name: string, parentId: string): Promise<string> {
    const drive = getDriveClient();
    const safeName = name.replace(/'/g, "\\'");

    const existing = await drive.files.list({
        q: `'${parentId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    if (existing.data.files && existing.data.files.length > 0) {
        return existing.data.files[0].id!;
    }

    const created = await drive.files.create({
        requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        },
        fields: 'id',
    });

    return created.data.id!;
}

/**
 * Risolve/crea il percorso di cartelle indicato (es. ["Cantieri", "COM-001 Nome", "Foto"])
 * partendo dalla cartella radice configurata. Ritorna l'id della cartella finale.
 */
export async function ensureFolderPath(segments: string[]): Promise<string> {
    let parentId = getRootFolderId();
    for (const segment of segments) {
        parentId = await findOrCreateFolder(segment, parentId);
    }
    return parentId;
}

export interface UploadResult {
    fileId: string;
    name: string;
    webViewLink: string;
}

/**
 * Carica un file nella cartella indicata. Il file diventa accessibile solo
 * tramite link condiviso generato da getShareableLink, non è pubblico di default.
 */
export async function uploadFile(
    folderId: string,
    fileName: string,
    mimeType: string,
    body: Buffer
): Promise<UploadResult> {
    const drive = getDriveClient();
    const { Readable } = await import('stream');

    const res = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [folderId],
        },
        media: {
            mimeType,
            body: Readable.from(body),
        },
        fields: 'id, name, webViewLink',
    });

    return {
        fileId: res.data.id!,
        name: res.data.name!,
        webViewLink: res.data.webViewLink!,
    };
}

/**
 * Genera un link di download diretto per un file (richiede che il chiamante
 * sia autenticato sul sito; il file su Drive resta privato salvo questo link).
 */
export async function getFileDownloadUrl(fileId: string): Promise<string> {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Rende il file accessibile a chiunque abbia il link (usare solo per
 * documenti non sensibili, oppure generare link con scadenza quando
 * servirà davvero la condivisione temporanea).
 */
export async function makeFileLinkShareable(fileId: string): Promise<void> {
    const drive = getDriveClient();
    await drive.permissions.create({
        fileId,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });
}

/**
 * Come makeFileLinkShareable, ma non crea un permesso duplicato se il file
 * è già condiviso "anyone: reader" (idempotente).
 */
export async function ensureFileLinkShareable(fileId: string): Promise<void> {
    const drive = getDriveClient();
    const { data } = await drive.permissions.list({ fileId, fields: 'permissions(type, role)' });
    const alreadyShared = data.permissions?.some(p => p.type === 'anyone' && p.role === 'reader');
    if (alreadyShared) return;
    await drive.permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
    });
}

const OFFICE_MIME_TYPES = new Set([
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export function isOfficeMimeType(mimeType: string): boolean {
    return OFFICE_MIME_TYPES.has(mimeType);
}

export async function getFileMetadata(fileId: string): Promise<{ mimeType: string; name: string }> {
    const drive = getDriveClient();
    const { data } = await drive.files.get({ fileId, fields: 'mimeType, name' });
    return { mimeType: data.mimeType || 'application/octet-stream', name: data.name || 'documento' };
}

export async function deleteFile(fileId: string): Promise<void> {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
}

/**
 * Trova una sottocartella per nome dentro il parent indicato, senza crearla.
 */
async function findFolder(name: string, parentId: string): Promise<string | null> {
    const drive = getDriveClient();
    const safeName = name.replace(/'/g, "\\'");

    const existing = await drive.files.list({
        q: `'${parentId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    return existing.data.files?.[0]?.id ?? null;
}

/**
 * Rinomina la cartella al percorso indicato aggiungendo il prefisso "ELIMINATO - ",
 * per segnalare visivamente su Drive che l'entità collegata è stata eliminata
 * definitivamente (la cartella non viene rimossa, va pulita manualmente).
 * Non fa nulla se la cartella non esiste o è già marcata.
 */
export async function markFolderDeleted(segments: string[]): Promise<void> {
    let parentId = getRootFolderId();
    for (const segment of segments) {
        const id = await findFolder(segment, parentId);
        if (!id) return;
        parentId = id;
    }

    const drive = getDriveClient();
    const current = await drive.files.get({ fileId: parentId, fields: 'name' });
    const name = current.data.name || '';
    if (name.startsWith('ELIMINATO - ')) return;
    await drive.files.update({ fileId: parentId, requestBody: { name: `ELIMINATO - ${name}` } });
}

export async function downloadFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
    const drive = getDriveClient();
    const [metadata, res] = await Promise.all([
        drive.files.get({ fileId, fields: 'mimeType, name' }),
        drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' }),
    ]);
    return {
        buffer: Buffer.from(res.data as ArrayBuffer),
        mimeType: metadata.data.mimeType || 'application/octet-stream',
        name: metadata.data.name || 'documento',
    };
}

/**
 * --- Funzioni generiche per la migrazione one-off verso una nuova credenziale OAuth ---
 * Permettono di operare su un client Drive arbitrario (vecchio o nuovo refresh token)
 * invece di quello di default letto dalle env var.
 */

export function createDriveClient(refreshToken: string) {
    const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('Variabili GOOGLE_DRIVE_* non configurate');
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Risale la catena di cartelle genitrici del file partendo dal vecchio client,
 * fino alla cartella radice indicata (esclusa), per ricostruire il percorso reale
 * (es. ["Cantieri", "COM-001 Nome", "Commessa"]) senza doverlo indovinare dal codice.
 */
export async function resolveFilePath(
    drive: ReturnType<typeof createDriveClient>,
    fileId: string,
    rootFolderId: string
): Promise<{ name: string; mimeType: string; segments: string[] }> {
    const file = await drive.files.get({ fileId, fields: 'name, mimeType, parents' });
    const name = file.data.name || fileId;
    const mimeType = file.data.mimeType || 'application/octet-stream';

    const segments: string[] = [];
    let currentParents = file.data.parents;
    let guard = 0;
    while (currentParents && currentParents.length > 0 && currentParents[0] !== rootFolderId && guard < 20) {
        const parentId = currentParents[0];
        const parent = await drive.files.get({ fileId: parentId, fields: 'name, parents' });
        segments.unshift(parent.data.name || parentId);
        currentParents = parent.data.parents;
        guard++;
    }

    return { name, mimeType, segments };
}

async function findOrCreateFolderWith(
    drive: ReturnType<typeof createDriveClient>,
    name: string,
    parentId: string
): Promise<string> {
    const safeName = name.replace(/'/g, "\\'");
    const existing = await drive.files.list({
        q: `'${parentId}' in parents and name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        spaces: 'drive',
    });
    if (existing.data.files && existing.data.files.length > 0) return existing.data.files[0].id!;

    const created = await drive.files.create({
        requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
        fields: 'id',
    });
    return created.data.id!;
}

export async function ensureFolderPathWith(
    drive: ReturnType<typeof createDriveClient>,
    rootFolderId: string,
    segments: string[]
): Promise<string> {
    let parentId = rootFolderId;
    for (const segment of segments) {
        parentId = await findOrCreateFolderWith(drive, segment, parentId);
    }
    return parentId;
}

export async function createRootFolder(
    drive: ReturnType<typeof createDriveClient>,
    name: string
): Promise<string> {
    const created = await drive.files.create({
        requestBody: { name, mimeType: 'application/vnd.google-apps.folder' },
        fields: 'id',
    });
    return created.data.id!;
}

export async function downloadFileWith(
    drive: ReturnType<typeof createDriveClient>,
    fileId: string
): Promise<Buffer> {
    const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return Buffer.from(res.data as ArrayBuffer);
}

export async function uploadFileWith(
    drive: ReturnType<typeof createDriveClient>,
    folderId: string,
    fileName: string,
    mimeType: string,
    body: Buffer
): Promise<string> {
    const { Readable } = await import('stream');
    const res = await drive.files.create({
        requestBody: { name: fileName, parents: [folderId] },
        media: { mimeType, body: Readable.from(body) },
        fields: 'id',
    });
    return res.data.id!;
}
