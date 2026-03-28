import multer from "multer";

const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ALLOWED_MIME_TYPES = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
]);

const ALLOWED_EXTENSIONS_DISPLAY = [...ALLOWED_EXTENSIONS]
    .map(ext => ext.replace(".", "").toUpperCase())
    .join(", ");

function getFileExtension(fileName: string): string {
    const lastDotPosition = fileName.lastIndexOf(".");
    if (lastDotPosition < 0) return "";
    return fileName.slice(lastDotPosition).toLowerCase();
}

function isAllowedFile(file: Express.Multer.File): boolean {
    const isMimeTypeAllowed = ALLOWED_MIME_TYPES.has((file.mimetype || "").toLowerCase());
    const isExtensionAllowed = ALLOWED_EXTENSIONS.has(getFileExtension(file.originalname || ""));
    return isMimeTypeAllowed && isExtensionAllowed;
}

export const uploadDocumentMiddleware = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_DOCUMENT_SIZE_BYTES,
        files: 1,
    },
    fileFilter: (_req, file, cb) => {
        if (!isAllowedFile(file)) {
            cb(new Error(`Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS_DISPLAY}.`));
            return;
        }
        cb(null, true);
    },
});

/** @deprecated use uploadDocumentMiddleware instead */
export const uploadPdfMiddleware = uploadDocumentMiddleware;