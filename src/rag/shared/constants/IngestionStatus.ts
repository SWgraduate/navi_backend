export const INGESTION_STATUS = {
    PENDING: "pending",
    PROCESSING: "processing",
    PROCESSED: "processed",
    FAILED: "failed",
} as const;

export type IngestionStatus = (typeof INGESTION_STATUS)[keyof typeof INGESTION_STATUS];