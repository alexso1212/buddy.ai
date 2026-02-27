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

const streamStates = new Map<number, StreamState>();
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
