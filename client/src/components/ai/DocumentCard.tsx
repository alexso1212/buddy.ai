import { FileText, Download } from 'lucide-react';

interface DocumentCardProps {
  title: string;
  fileName: string;
  downloadUrl: string;
}

export default function DocumentCard({ title, fileName, downloadUrl }: DocumentCardProps) {
  return (
    <div
      style={{
        marginTop: 12,
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--bg-secondary)',
      }}
      data-testid="document-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: 'rgba(59, 130, 246, 0.1)',
          }}
        >
          <FileText size={22} style={{ color: 'var(--brand-icon)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontWeight: 500,
              fontSize: 14,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0,
            }}
          >
            {title}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, margin: 0 }}>
            Word 文档 · .docx
          </p>
        </div>
        <a
          href={downloadUrl}
          download={fileName}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: 'var(--brand)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 8,
            textDecoration: 'none',
            flexShrink: 0,
            transition: 'opacity 150ms',
          }}
          data-testid="btn-download-document"
        >
          <Download size={14} />
          下载
        </a>
      </div>
    </div>
  );
}
