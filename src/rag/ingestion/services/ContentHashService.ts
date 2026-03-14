import crypto from "crypto";
import { logger } from "src/utils/log";

export class ContentHashService {
    createHash(normalizedText: string): string {
        try {
            if (!normalizedText?.trim()) {
                throw new Error("Cannot hash empty text");
            }

            const hash = crypto.createHash("sha256");
            return hash.update(normalizedText).digest("hex");
        } catch (error) {
            logger.e("Hash creation failed", error);
            throw new Error(
                `Failed to create content hash: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    shortHash(hash: string, length = 12): string {
        return hash.slice(0, length);
    }
}