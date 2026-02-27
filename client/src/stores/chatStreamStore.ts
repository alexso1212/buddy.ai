import { useSyncExternalStore, useCallback } from 'react';

interface StreamState {
  isStreaming: boolean;
  partialContent: string;
  thinkingContent: string;
  isThinking: boolean;
  tokenUsage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: string;
  completedAt?: number;
}

interface BackgroundStream {
  convId: number;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  decoder: TextDecoder;
  fullText: string;
  thinkingText: string;
  thinkingDuration: number;
  buffer: string;
  assistantMsgId: string;
  done: boolean;
}

const streamStates = new Map<number, StreamState>();
const backgroundStreams = new Map<number, BackgroundStream>();
const listeners = new Set<() => void>();

function emitChange() {
  listeners.forEach(l => l());
}

export function getStreamState(convId: number): StreamState | undefined {
  return streamStates.get(convId);
}

export function setStreamState(convId: number, state: Partial<StreamState>) {
  const current = streamStates.get(convId) || {
    isStreaming: false,
    partialContent: '',
    thinkingContent: '',
    isThinking: false,
  };
  streamStates.set(convId, { ...current, ...state });
  emitChange();
}

export function clearStreamState(convId: number) {
  streamStates.delete(convId);
  emitChange();
}

export function getStreamingConvIds(): number[] {
  const ids: number[] = [];
  streamStates.forEach((state, id) => {
    if (state.isStreaming) ids.push(id);
  });
  return ids;
}

export function useStreamingConvIds(): number[] {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);
  const getSnapshot = useCallback(() => {
    const ids: number[] = [];
    streamStates.forEach((state, id) => {
      if (state.isStreaming) ids.push(id);
    });
    return JSON.stringify(ids);
  }, []);
  const json = useSyncExternalStore(subscribe, getSnapshot);
  return JSON.parse(json);
}

export function isBackgroundStreamActive(convId: number): boolean {
  const bg = backgroundStreams.get(convId);
  return bg !== undefined && !bg.done;
}

export function takeoverStream(
  convId: number,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  fullText: string,
  thinkingText: string,
  thinkingDuration: number,
  assistantMsgId: string,
) {
  const bg: BackgroundStream = {
    convId,
    reader,
    decoder,
    fullText,
    thinkingText,
    thinkingDuration,
    buffer: '',
    assistantMsgId,
    done: false,
  };
  backgroundStreams.set(convId, bg);

  setStreamState(convId, { isStreaming: true, partialContent: fullText, thinkingContent: thinkingText });

  consumeBackgroundStream(bg).catch(err => {
    console.error(`[chatStreamStore] Background stream error for conv ${convId}:`, err);
  });
}

async function consumeBackgroundStream(bg: BackgroundStream) {
  try {
    while (true) {
      const { done, value } = await bg.reader.read();
      if (done) break;

      bg.buffer += bg.decoder.decode(value, { stream: true });
      const lines = bg.buffer.split('\n');
      bg.buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);
        if (raw === '[DONE]') continue;

        try {
          const evt = JSON.parse(raw);

          if (evt.type === 'token' && evt.content) {
            bg.fullText += evt.content;
            setStreamState(bg.convId, { partialContent: bg.fullText });
          } else if (evt.type === 'thinking' && evt.content) {
            bg.thinkingText += evt.content;
            if (!bg.thinkingDuration) bg.thinkingDuration = 0;
            setStreamState(bg.convId, { thinkingContent: bg.thinkingText, isThinking: true });
          } else if (evt.type === 'done') {
            if (evt.tokenUsage) {
              setStreamState(bg.convId, { tokenUsage: evt.tokenUsage });
            }
            if (evt.thinkingDuration) {
              bg.thinkingDuration = evt.thinkingDuration;
            }
            await saveBackgroundMessage(bg, evt.tokenUsage);
          }
        } catch {}
      }
    }

    if (bg.fullText && !bg.done) {
      await saveBackgroundMessage(bg, undefined);
    }
  } finally {
    bg.done = true;
    setStreamState(bg.convId, { isStreaming: false, isThinking: false, completedAt: Date.now() });
    emitChange();
  }
}

async function saveBackgroundMessage(bg: BackgroundStream, tokenUsage: any) {
  if (bg.done) return;
  bg.done = true;

  try {
    const metadata: Record<string, any> = {};
    if (bg.thinkingText) metadata.thinking = bg.thinkingText;
    if (bg.thinkingDuration) metadata.thinkingDuration = bg.thinkingDuration;
    if (tokenUsage) metadata.tokenUsage = tokenUsage;

    const token = localStorage.getItem('buddy_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    await fetch(`/api/conversations/${bg.convId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        role: 'assistant',
        content: bg.fullText,
        type: 'text',
        metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null,
      }),
    });
  } catch (err) {
    console.error(`[chatStreamStore] Failed to save background message for conv ${bg.convId}:`, err);
  }
}
