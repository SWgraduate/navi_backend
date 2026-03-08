import crypto from "crypto";

export class ContentHashService {
    createHash(normalizedText: string): string {
        const hash = crypto.createHash("sha256");
        return hash.update(normalizedText).digest("hex");
    }

    shortHash(hash: string, length = 12): string {
        return hash.slice(0, length);
    }
}