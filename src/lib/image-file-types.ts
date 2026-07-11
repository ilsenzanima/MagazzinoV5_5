// Estensioni immagine riconosciute per decidere se aprire un file nella galleria
// foto invece che come link/download generico. Nessuna dipendenza da React/DOM,
// così è utilizzabile sia lato client (componenti) che lato server (API route).
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif", "avif", "svg"]);

export function isImageFileType(fileType?: string | null): boolean {
    if (!fileType) return false;
    return IMAGE_EXTENSIONS.has(fileType.toLowerCase().replace(".", ""));
}
