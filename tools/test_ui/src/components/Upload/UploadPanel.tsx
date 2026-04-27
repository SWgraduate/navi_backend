import { useState } from "react";
import { uploadPdf, type UploadPdfResponse } from "../../api/uploadApi";

export const UploadPanel = () => {
  const [userId, setUserId] = useState("test-user");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadPdfResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onUpload = async () => {
    if (!file) {
      setError("Please select a PDF file.");
      return;
    }

    if (!userId.trim()) {
      setError("Please enter a userId.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await uploadPdf({ file, userId: userId.trim(), role });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: "768px",
        width: "100%",
        margin: "16px auto 0",
        padding: "0 20px",
      }}
    >
      <div
        style={{
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          padding: "12px",
          backgroundColor: "var(--input-bg)",
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: "10px" }}>PDF Upload (RAG)</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: "8px", marginBottom: "8px" }}>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="userId"
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              background: "var(--bg-color)",
              color: "var(--text-primary)",
            }}
          />

          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "user" | "admin")}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              background: "var(--bg-color)",
              color: "var(--text-primary)",
            }}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            style={{ color: "var(--text-primary)" }}
          />

          <button
            onClick={onUpload}
            disabled={loading || !file || !userId.trim()}
            style={{
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              padding: "8px 12px",
              background: "var(--accent-color)",
              color: "#fff",
              cursor: loading || !file || !userId.trim() ? "not-allowed" : "pointer",
              opacity: loading || !file || !userId.trim() ? 0.7 : 1,
            }}
          >
            {loading ? "Uploading..." : "Upload PDF"}
          </button>
        </div>

        {error && (
          <div style={{ color: "#ff8a8a", marginTop: "10px", whiteSpace: "pre-wrap" }}>{error}</div>
        )}

        {result && (
          <pre
            style={{
              marginTop: "10px",
              padding: "10px",
              borderRadius: "8px",
              background: "var(--bg-color)",
              border: "1px solid var(--border-color)",
              color: "var(--text-secondary)",
              overflowX: "auto",
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
};
