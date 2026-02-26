import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useMemo, type ReactNode } from 'react';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import rust from 'highlight.js/lib/languages/rust';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('css', css);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('rust', rust);

interface AIMessageContentProps {
  content: string;
}

const CODE_COLLAPSE_THRESHOLD = 20;
const CODE_VISIBLE_LINES = 15;

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const lines = useMemo(() => code.split('\n'), [code]);
  const shouldCollapse = lines.length > CODE_COLLAPSE_THRESHOLD;
  const showLineNumbers = lines.length > 1;

  const displayCode = useMemo(() => {
    if (shouldCollapse && !isExpanded) {
      return lines.slice(0, CODE_VISIBLE_LINES).join('\n');
    }
    return code;
  }, [code, lines, shouldCollapse, isExpanded]);

  const highlighted = useMemo(() => {
    try {
      if (language && language !== 'code' && hljs.getLanguage(language)) {
        return hljs.highlight(displayCode, { language }).value;
      }
      const auto = hljs.highlightAuto(displayCode);
      if (auto.relevance > 5) return auto.value;
    } catch {}
    return null;
  }, [displayCode, language]);

  const displayLineCount = shouldCollapse && !isExpanded ? CODE_VISIBLE_LINES : lines.length;

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
      <pre style={{ padding: '14px 16px', margin: 0, overflowX: 'auto', display: showLineNumbers ? 'flex' : 'block' }}>
        {showLineNumbers && (
          <div
            style={{
              userSelect: 'none',
              textAlign: 'right',
              paddingRight: 12,
              marginRight: 12,
              borderRight: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 255, 255, 0.3)',
              minWidth: '2em',
              flexShrink: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: 13.5,
              lineHeight: 1.55,
            }}
            aria-hidden="true"
            data-testid="code-line-numbers"
          >
            {Array.from({ length: displayLineCount }, (_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {highlighted ? (
            <code
              className="hljs"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13.5,
                lineHeight: 1.55,
              }}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          ) : (
            <code style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13.5,
              lineHeight: 1.55,
              color: 'var(--text-primary)',
            }}>{displayCode}</code>
          )}
        </div>
      </pre>
      {shouldCollapse && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            width: '100%',
            padding: 8,
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.5)',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'var(--font-sans)',
            borderRadius: '0 0 8px 8px',
            transition: 'background 150ms, color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
          data-testid="code-expand-button"
        >
          {isExpanded ? '收起' : `展开全部 (${lines.length} 行)`}
        </button>
      )}
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
                color: 'var(--brand-icon)',
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
