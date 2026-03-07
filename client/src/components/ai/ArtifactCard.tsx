import StarburstIndicator from "./StarburstIndicator";

interface ArtifactCardProps {
  title: string;
  extension: string;
  onClick?: () => void;
  isGenerating?: boolean;
  messageId?: string;
}

const CODE_EXTENSIONS = new Set([
  "html", "jsx", "tsx", "py", "ts", "js", "css", "svg", "mermaid",
]);

const SUBTITLE_MAP: Record<string, { icon: "document" | "code"; label: string }> = {
  md: { icon: "document", label: "File \u00B7 MD" },
  txt: { icon: "document", label: "File \u00B7 TXT" },
  pdf: { icon: "document", label: "File \u00B7 PDF" },
  html: { icon: "code", label: "Code \u00B7 HTML" },
  jsx: { icon: "code", label: "Code \u00B7 JSX" },
  tsx: { icon: "code", label: "Code \u00B7 TSX" },
  py: { icon: "code", label: "Code \u00B7 Python" },
  ts: { icon: "code", label: "Code \u00B7 TS" },
  js: { icon: "code", label: "Code \u00B7 JS" },
  css: { icon: "code", label: "Code \u00B7 CSS" },
  svg: { icon: "code", label: "Code \u00B7 SVG" },
  mermaid: { icon: "code", label: "Code \u00B7 Mermaid" },
};

function getFileInfo(extension: string) {
  const ext = extension.replace(/^\./, "").toLowerCase();
  const mapped = SUBTITLE_MAP[ext];
  if (mapped) return mapped;
  const isCode = CODE_EXTENSIONS.has(ext);
  return {
    icon: isCode ? ("code" as const) : ("document" as const),
    label: isCode ? `Code \u00B7 ${ext.toUpperCase()}` : `File \u00B7 ${ext.toUpperCase()}`,
  };
}

function DocumentIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e8e8e8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <polyline points="14,3 14,8 19,8" />
      <path d="M8 13c1-1 2 1 3 0s2 1 3 0" fill="none" />
      <path d="M8 16.5c1-1 2 1 3 0s2 1 3 0" fill="none" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="1" />
      <polyline points="9,8 5.5,12 9,16" fill="none" stroke="#e8e8e8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="15,8 18.5,12 15,16" fill="none" stroke="#e8e8e8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="13" y1="7" x2="11" y2="17" stroke="#e8e8e8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function ArtifactCard({ title, extension, onClick, isGenerating, messageId }: ArtifactCardProps) {
  const { icon, label } = getFileInfo(extension);

  return (
    <div>
      <div
        data-testid={messageId ? `card-artifact-${messageId}` : "artifact-card"}
        onClick={onClick}
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid #3a3a3a",
          borderRadius: 16,
          padding: 10,
          margin: "6px 0",
          display: "flex",
          alignItems: "center",
          gap: 12,
          cursor: "pointer",
          animation: "artifactSlideUp 250ms ease forwards",
          transition: "background 150ms ease, border-color 150ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#333";
          e.currentTarget.style.borderColor = "#555";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--bg-secondary)";
          e.currentTarget.style.borderColor = "#3a3a3a";
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            flexShrink: 0,
            background: "#333333",
            border: "1px solid #3a3a3a",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          data-testid="artifact-card-thumbnail"
        >
          {icon === "code" ? <CodeIcon /> : <DocumentIcon />}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span
            data-testid="artifact-card-title"
            style={{
              color: "#e8e8e8",
              fontSize: 15,
              fontWeight: 500,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </span>
          <span
            data-testid="artifact-card-subtitle"
            style={{
              color: "#6b6b6b",
              fontSize: 13,
            }}
          >
            {label}
          </span>
        </div>
      </div>

      {isGenerating && <BackgroundProcessingBanner />}
    </div>
  );
}

function BackgroundProcessingBanner() {
  return (
    <div
      data-testid="artifact-processing-banner"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 0",
      }}
    >
      <StarburstIndicator visible />
      <span style={{ color: "#a0a0a0", fontSize: 13 }}>
        Claude is responding in the background.
      </span>
    </div>
  );
}

export { BackgroundProcessingBanner };
