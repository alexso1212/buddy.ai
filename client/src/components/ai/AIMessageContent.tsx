import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, type ReactNode } from 'react';

interface AIMessageContentProps {
  content: string;
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(code).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-code)',
      borderRadius: 8,
      overflow: 'hidden',
      margin: '16px 0',
    }}>
      <div style={{
        background: 'var(--bg-code-header)',
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>{language}</span>
        <button
          onClick={handleCopy}
          style={{
            fontSize: 12, color: 'var(--text-secondary)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}
          data-testid="code-copy-button"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre style={{ padding: '14px 16px', margin: 0, overflowX: 'auto' }}>
        <code style={{
          fontFamily: "var(--font-mono)",
          fontSize: 13.5,
          lineHeight: 1.55,
          color: 'var(--text-primary)',
        }}>{code}</code>
      </pre>
    </div>
  );
}

export default function AIMessageContent({ content }: AIMessageContentProps) {
  return (
    <div
      style={{
        fontFamily: "Georgia, 'Noto Serif SC', 'Source Han Serif SC', serif",
        fontSize: '16px',
        lineHeight: '1.65',
        letterSpacing: '0.02em',
        color: 'var(--text-primary)',
      }}
      data-testid="ai-message-content"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p style={{ marginBottom: 16, marginTop: 0 }}>{children}</p>
          ),
          h1: ({ children }) => (
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-bright)', margin: '28px 0 14px', fontFamily: 'inherit' }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-bright)', margin: '24px 0 12px', fontFamily: 'inherit' }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-bright)', margin: '24px 0 12px', fontFamily: 'inherit' }}>{children}</h3>
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em style={{ fontStyle: 'italic' }}>{children}</em>
          ),
          ul: ({ children }) => (
            <ul style={{ paddingLeft: 20, marginBottom: 16, marginTop: 0 }}>{children}</ul>
          ),
          ol: ({ children }) => (
            <ol style={{ paddingLeft: 20, marginBottom: 16, marginTop: 0 }}>{children}</ol>
          ),
          li: ({ children }) => (
            <li style={{ marginBottom: 8, color: 'var(--text-primary)' }}>{children}</li>
          ),
          a: ({ children, href }) => (
            <a href={href} style={{ color: 'var(--brand-icon)', textDecoration: 'underline' }}>{children}</a>
          ),
          blockquote: ({ children }) => (
            <blockquote style={{
              borderLeft: '3px solid var(--brand)',
              paddingLeft: 16,
              margin: '16px 0',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
            }}>{children}</blockquote>
          ),
          pre: ({ children }) => {
            const codeChild = children as any;
            const props = codeChild?.props || {};
            const className = props.className || '';
            const language = className ? className.replace('language-', '') : 'code';
            const rawCode = String(props.children || '').replace(/\n$/, '');
            return <CodeBlock language={language} code={rawCode} />;
          },
          code: ({ children, className }) => {
            if (className) {
              return <code className={className}>{children}</code>;
            }
            return (
              <code style={{
                background: 'var(--bg-code)',
                borderRadius: 4,
                padding: '2px 6px',
                fontFamily: "var(--font-mono)",
                fontSize: 14,
                color: '#E8C89A',
              }}>{children}</code>
            );
          },
          hr: () => (
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-subtle)', margin: '24px 0' }} />
          ),
          table: ({ children }) => (
            <div style={{ overflowX: 'auto', margin: '16px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th style={{ borderBottom: '2px solid var(--border-medium)', padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-bright)' }}>{children}</th>
          ),
          td: ({ children }) => (
            <td style={{ borderBottom: '1px solid var(--border-subtle)', padding: '8px 12px' }}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
