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
import { Copy, Check, Share2, ExternalLink, ChevronDown } from 'lucide-react';

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

function ActionButton({ onClick, icon, label, doneLabel, doneIcon, testId }: {
  onClick: () => Promise<void> | void;
  icon: ReactNode;
  label: string;
  doneLabel: string;
  doneIcon: ReactNode;
  testId?: string;
}) {
  const [done, setDone] = useState(false);

  const handleClick = useCallback(async () => {
    try {
      await onClick();
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {}
  }, [onClick]);

  return (
    <button
      onClick={handleClick}
      style={{
        fontSize: 12,
        color: 'var(--text-secondary)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        borderRadius: 4,
        transition: 'background 150ms',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      data-testid={testId || `btn-${label.toLowerCase()}`}
    >
      {done ? doneIcon : icon}
      <span>{done ? doneLabel : label}</span>
    </button>
  );
}

function copyText(text: string) {
  return navigator.clipboard.writeText(text);
}

async function shareText(text: string) {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch {}
  }
  await navigator.clipboard.writeText(text);
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const lines = useMemo(() => code.split('\n'), [code]);
  const lineCount = lines.length;
  const [collapsed, setCollapsed] = useState(lineCount > 30);
  const displayCode = collapsed ? lines.slice(0, 15).join('\n') : code;
  const displayLines = collapsed ? lines.slice(0, 15) : lines;

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

  return (
    <div style={{
      background: 'var(--bg-code)',
      borderRadius: 8,
      overflow: 'hidden',
      margin: '16px 0',
    }}>
      <div style={{
        background: 'var(--bg-code-header)',
        padding: '6px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>{language}</span>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.5, fontFamily: 'var(--font-sans)' }}>{lineCount} lines</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <ActionButton
            onClick={() => copyText(code)}
            icon={<Copy className="w-3.5 h-3.5" />}
            label="Copy"
            doneLabel="Copied!"
            doneIcon={<Check className="w-3.5 h-3.5" />}
            testId="btn-copy-code"
          />
          <ActionButton
            onClick={() => shareText(code)}
            icon={<Share2 className="w-3.5 h-3.5" />}
            label="Share"
            doneLabel="Shared!"
            doneIcon={<Check className="w-3.5 h-3.5" />}
            testId="btn-share-code"
          />
        </div>
      </div>
      <div style={{
        overflowX: 'auto',
        overflowY: collapsed ? 'hidden' : 'auto',
        maxHeight: collapsed ? 'none' : 400,
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x pan-y',
      }}>
        <div style={{ display: 'flex' }}>
          <div style={{
            padding: '14px 0',
            paddingLeft: 12,
            paddingRight: 8,
            borderRight: '1px solid rgba(255,255,255,0.06)',
            userSelect: 'none',
            textAlign: 'right',
            minWidth: 36,
            flexShrink: 0,
            position: 'sticky',
            left: 0,
            background: 'var(--bg-code)',
            zIndex: 1,
          }}>
            {displayLines.map((_, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: '1.55em', color: 'rgba(255,255,255,0.2)', fontFamily: 'var(--font-mono)' }}>
                {i + 1}
              </div>
            ))}
          </div>
          <pre style={{
            padding: '14px 16px',
            margin: 0,
            flex: 1,
            minWidth: 0,
            overflowX: 'auto',
          }}>
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
          </pre>
        </div>
      </div>
      {lineCount > 30 && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            width: '100%',
            padding: '8px',
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--brand)',
            background: 'rgba(174,86,48,0.08)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
          data-testid="btn-toggle-code-collapse"
        >
          <ChevronDown style={{ width: 14, height: 14, transform: collapsed ? 'rotate(0)' : 'rotate(180deg)', transition: 'transform 200ms' }} />
          {collapsed ? `展开剩余 ${lineCount - 15} 行` : '收起'}
        </button>
      )}
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
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 2,
        marginBottom: 4,
      }}>
        <ActionButton
          onClick={() => copyText(extractTableText())}
          icon={<Copy className="w-3.5 h-3.5" />}
          label="Copy"
          doneLabel="Copied!"
          doneIcon={<Check className="w-3.5 h-3.5" />}
          testId="btn-copy-table"
        />
        <ActionButton
          onClick={() => shareText(extractTableText())}
          icon={<Share2 className="w-3.5 h-3.5" />}
          label="Share"
          doneLabel="Shared!"
          doneIcon={<Check className="w-3.5 h-3.5" />}
          testId="btn-share-table"
        />
      </div>
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
