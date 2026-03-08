export class TextNormalizationService {
  normalize(rawText: string): string {
    return rawText
      .replace(/\r\n/g, "\n")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  isEffectivelyEmpty(text: string): boolean {
    return text.replace(/\s+/g, "").length === 0;
  }
}