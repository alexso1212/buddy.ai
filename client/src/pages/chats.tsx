import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Search, ChevronRight, Plus, Star } from "lucide-react";
import { tapMotionProps } from "@/hooks/use-tap-motion";

interface Conversation {
  id: number;
  title: string;
  starred: boolean;
  projectId: number | null;
  projectName: string | null;
  updatedAt: string;
  lastMessageAt: string | null;
  matchSnippets?: string[];
}

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: { text: string; highlight: boolean }[] = [];
  let lastIdx = 0;

  while (true) {
    const idx = lowerText.indexOf(lowerQuery, lastIdx);
    if (idx === -1) {
      parts.push({ text: text.slice(lastIdx), highlight: false });
      break;
    }
    if (idx > lastIdx) parts.push({ text: text.slice(lastIdx, idx), highlight: false });
    parts.push({ text: text.slice(idx, idx + query.length), highlight: true });
    lastIdx = idx + query.length;
  }

  return (
    <>
      {parts.map((p, i) =>
        p.highlight ? (
          <span key={i} style={{ background: '#000', color: '#ECECEC', padding: '1px 3px', borderRadius: 3, fontWeight: 600 }}>{p.text}</span>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </>
  );
}

export default function ChatsPage() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimerRef = useRef<number>(0);

  const { data: conversationsData } = useQuery<{ data: Conversation[] }>({
    queryKey: ['/api/conversations'],
  });
  const conversations = conversationsData?.data || [];

  const [searchResults, setSearchResults] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await apiRequest("GET", `/api/conversations/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const json = await res.json();
        setSearchResults(json.data || []);
      } catch {
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [searchQuery]);

  const isSearchMode = searchQuery.trim().length > 0;
  const displayList = isSearchMode ? searchResults : conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'var(--bg-primary)',
    }}>
      <div style={{ height: 56 }} className="md:hidden" />

      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }} data-testid="chats-list-container">
        {displayList.length === 0 && !isSearching ? (
          <div style={{ padding: '60px 28px', textAlign: 'center' }}>
            <p style={{ fontSize: 16, color: '#9A9893', lineHeight: 1.5 }}>
              {isSearchMode ? '没有找到匹配的对话' : '还没有对话'}
            </p>
            {!isSearchMode && (
              <p style={{ fontSize: 14, color: '#7A7874', marginTop: 8 }}>
                点击右下角 + 开始新对话
              </p>
            )}
          </div>
        ) : (
          displayList.map((conv) => (
            <div
              key={conv.id}
              onClick={() => navigate(`/agent?conv=${conv.id}`)}
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                transition: 'background 150ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              onTouchStart={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                try { navigator.vibrate?.(6); } catch {}
              }}
              onTouchEnd={e => { e.currentTarget.style.background = 'transparent'; }}
              onTouchMove={e => { e.currentTarget.style.background = 'transparent'; }}
              onTouchCancel={e => { e.currentTarget.style.background = 'transparent'; }}
              data-testid={`chat-item-${conv.id}`}
            >
              <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {conv.starred && <Star size={14} color="#C4703F" fill="#C4703F" style={{ flexShrink: 0 }} />}
                  <div style={{
                    fontSize: 16,
                    fontWeight: 400,
                    color: '#ECECEC',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {isSearchMode ? <HighlightText text={conv.title} query={searchQuery} /> : conv.title}
                  </div>
                </div>

                {isSearchMode && conv.matchSnippets && conv.matchSnippets.length > 0 ? (
                  <div style={{ marginTop: 6 }}>
                    {conv.matchSnippets.slice(0, 2).map((snippet, i) => (
                      <div key={i} style={{
                        fontSize: 13,
                        color: '#9A9893',
                        lineHeight: 1.4,
                        marginTop: i > 0 ? 4 : 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        <HighlightText text={snippet} query={searchQuery} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    fontSize: 13,
                    color: '#7A7874',
                    marginTop: 4,
                  }}>
                    {getRelativeTime(conv.lastMessageAt || conv.updatedAt)}
                  </div>
                )}
              </div>

              <ChevronRight size={18} color="#7A7874" style={{ flexShrink: 0 }} />
            </div>
          ))
        )}
      </div>

      <div style={{
        flexShrink: 0,
        padding: '12px 16px',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          flex: 1,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 20,
          padding: '0 16px',
          height: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <Search size={18} color="#7A7874" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              color: '#ECECEC',
            }}
            data-testid="input-search-chats"
          />
        </div>

        <button
          {...tapMotionProps}
          onClick={() => navigate('/agent')}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'linear-gradient(145deg, rgba(174,86,48,0.85) 0%, rgba(174,86,48,0.65) 100%)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 2px 10px rgba(174,86,48,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          data-testid="button-new-chat"
        >
          <Plus size={22} color="#FFFFFF" />
        </button>
      </div>
    </div>
  );
}
