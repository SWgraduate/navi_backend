import multer from "multer";

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export const uploadPdfMiddleware = multer ({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_PDF_SIZE_BYTES,
        files: 1,
    },

    fileFilter: (_req, file, cb) => {
        const isPdfMime = file.mimetype === "application/pdf";
        const hasPdfExtension = file.originalname.toLowerCase().endsWith(".pdf")

        if (!isPdfMime && !hasPdfExtension) {
            cb(new Error("Uploaded file is not a pdf file.\nPlease import PDF file."));
            return;
        }

        cb(null, true);
    },
});