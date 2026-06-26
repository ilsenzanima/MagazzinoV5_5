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

export async function deleteFile(fileId: string): Promise<void> {
    const drive = getDriveClient();
    await drive.files.delete({ fileId });
}

export async function downloadFile(fileId: string): Promise<Buffer> {
    const drive = getDriveClient();
    const res = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
    );
    return Buffer.from(res.data as ArrayBuffer);
}
