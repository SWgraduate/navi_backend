import { logger } from "src/utils/log";

export class TextNormalizationService {
  normalize(rawText: string): string {
    try {
      if (!rawText) {
        return "";
      }

      const normalized = rawText
        .replace(/\r\n/g, "\n")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      logger.i(
        `Text normalized: ${rawText.length} chars → ${normalized.length} chars`
      );

      return normalized;
    } catch (error) {
      logger.e("Text normalization failed", error);
      throw new Error(
        `Failed to normalize text: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  isEffectivelyEmpty(text: string): boolean {
    return text.replace(/\s+/g, "").length === 0;
  }
}