import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState, useRef, useMemo, useCallback, type ReactNode } from 'react';
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
import { ExternalLink } from 'lucide-react';

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

function copyText(text: string) {
  return navigator.clipboard.writeText(text).catch(() => {});
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const highlighted = useMemo(() => {
    try {
      if (language && language !== 'code' && hljs.getLanguage(language)) {
        return hljs.highlight(code, { language }).value;
      }
      const auto = hljs.highlightAuto(code);
      if (auto.relevance > 5) return auto.value;
    } catch {}
    return null;
  }, [code, language]);

  const handleCopy = useCallback(() => {
    copyText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  return (
    <div className="streaming-code-block" style={{
      background: 'var(--bg-code)',
      border: '1px solid var(--border-code)',
      borderRadius: 8,
      margin: '8px 0',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-code)',
        background: 'var(--bg-code-header)',
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>{language}</span>
        <button
          onClick={handleCopy}
          style={{
            fontSize: 12,
            color: copied ? 'var(--accent-green)' : 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 6px',
            borderRadius: 4,
            transition: 'color 150ms',
          }}
          data-testid="btn-copy-code"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <div style={{
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x pan-y',
      }}>
        <pre style={{
          padding: 16,
          margin: 0,
          minWidth: 0,
        }}>
          {highlighted ? (
            <code
              className="hljs"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
              dangerouslySetInnerHTML={{ __html: highlighted }}
            />
          ) : (
            <code style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--text-primary)',
            }}>{code}</code>
          )}
        </pre>
      </div>
    </div>
  );
}

function TableCopyButton({ extractTableText }: { extractTableText: () => string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    copyText(extractTableText());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [extractTableText]);

  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 2, marginBottom: 4 }}>
      <button
        onClick={handleCopy}
        style={{
          fontSize: 12,
          color: copied ? 'var(--accent-green)' : 'var(--text-secondary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 6px',
          borderRadius: 4,
          transition: 'color 150ms',
        }}
        data-testid="btn-copy-table"
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
        <span>{copied ? 'Copied!' : 'Copy'}</span>
      </button>
    </div>
  );
}

function TableBlock({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);
  const dragState = useRef<{ isDown: boolean; startX: number; scrollLeft: number }>({ isDown: false, startX: 0, scrollLeft: 0 });

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const canScroll = el.scrollWidth > el.clientWidth;
    const notAtEnd = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setShowFade(canScroll && notAtEnd);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const el = scrollRef.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    dragState.current = { isDown: true, startX: e.clientX, scrollLeft: el.scrollLeft };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
    el.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState.current.isDown) return;
    const el = scrollRef.current;
    if (!el) return;
    const dx = e.clientX - dragState.current.startX;
    el.scrollLeft = dragState.current.scrollLeft - dx;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current.isDown = false;
    const el = scrollRef.current;
    if (!el) return;
    el.style.cursor = 'grab';
    el.style.userSelect = '';
    el.releasePointerCapture(e.pointerId);
  }, []);

  const extractTableText = useCallback(() => {
    const container = containerRef.current;
    if (!container) return '';
    const rows = container.querySelectorAll('tr');
    const mdLines: string[] = [];
    let isFirstRow = true;
    rows.forEach(row => {
      const cells = row.querySelectorAll('th, td');
      const cellTexts: string[] = [];
      cells.forEach(cell => cellTexts.push((cell as HTMLElement).innerText.trim()));
      mdLines.push('| ' + cellTexts.join(' | ') + ' |');
      if (isFirstRow) {
        mdLines.push('| ' + cellTexts.map(() => '---').join(' | ') + ' |');
        isFirstRow = false;
      }
    });
    return mdLines.join('\n');
  }, []);

  return (
    <div ref={containerRef} style={{ margin: '16px 0', position: 'relative' }}>
      <TableCopyButton extractTableText={extractTableText} />
      <div
        ref={(el) => {
          (scrollRef as any).current = el;
          if (el) {
            requestAnimationFrame(checkScroll);
            if (el.scrollWidth > el.clientWidth) el.style.cursor = 'grab';
          }
        }}
        onScroll={checkScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        style={{
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
        }}
        data-testid="table-scroll-container"
      >
        <table className="ai-table-zebra" style={{ width: '100%', minWidth: 'max-content', borderCollapse: 'collapse', fontSize: 14 }}>
          {children}
        </table>
      </div>
      {showFade && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 24,
          bottom: 0,
          width: 40,
          background: 'linear-gradient(to right, transparent, var(--bg-main))',
          pointerEvents: 'none',
          borderRadius: '0 8px 8px 0',
        }} />
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
        overflowX: 'hidden',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
        minWidth: 0,
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
            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-icon)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {children}
              <ExternalLink style={{ width: 12, height: 12, opacity: 0.6, flexShrink: 0 }} />
            </a>
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
            <TableBlock>{children}</TableBlock>
          ),
          th: ({ children }) => (
            <th style={{
              borderBottom: '2px solid var(--border-medium)',
              padding: '8px 12px',
              textAlign: 'left',
              fontWeight: 600,
              color: 'var(--text-bright)',
              whiteSpace: 'nowrap',
            }}>{children}</th>
          ),
          td: ({ children }) => (
            <td style={{
              borderBottom: '1px solid var(--border-subtle)',
              padding: '8px 12px',
              whiteSpace: 'nowrap',
            }}>{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
