import { useCallback, useRef } from "react";

interface TapMotionOptions {
  scale?: number;
  duration?: number;
  vibrate?: number;
}

interface TapMotionHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

const DEFAULT_SCALE = 0.96;
const DEFAULT_DURATION = 120;
const DEFAULT_VIBRATE = 6;

export function useTapMotion(options?: TapMotionOptions): TapMotionHandlers {
  const { scale = DEFAULT_SCALE, duration = DEFAULT_DURATION, vibrate = DEFAULT_VIBRATE } = options || {};
  const activeRef = useRef(false);

  const press = useCallback((el: HTMLElement) => {
    if (activeRef.current) return;
    activeRef.current = true;
    el.style.transition = `transform ${duration}ms cubic-bezier(0.25,0.1,0.25,1)`;
    el.style.transform = `scale(${scale})`;
    if (vibrate && navigator.vibrate) {
      try { navigator.vibrate(vibrate); } catch {}
    }
  }, [scale, duration, vibrate]);

  const release = useCallback((el: HTMLElement) => {
    if (!activeRef.current) return;
    activeRef.current = false;
    el.style.transition = `transform ${duration}ms cubic-bezier(0.25,0.1,0.25,1)`;
    el.style.transform = "scale(1)";
  }, [duration]);

  const onMouseDown = useCallback((e: React.MouseEvent) => press(e.currentTarget as HTMLElement), [press]);
  const onMouseUp = useCallback((e: React.MouseEvent) => release(e.currentTarget as HTMLElement), [release]);
  const onMouseLeave = useCallback((e: React.MouseEvent) => release(e.currentTarget as HTMLElement), [release]);
  const onTouchStart = useCallback((e: React.TouchEvent) => press(e.currentTarget as HTMLElement), [press]);
  const onTouchEnd = useCallback((e: React.TouchEvent) => release(e.currentTarget as HTMLElement), [release]);

  return { onMouseDown, onMouseUp, onMouseLeave, onTouchStart, onTouchEnd };
}

export function getTapMotionProps(scale = DEFAULT_SCALE, duration = DEFAULT_DURATION, vibrate = DEFAULT_VIBRATE) {
  const press = (el: HTMLElement) => {
    el.style.transition = `transform ${duration}ms cubic-bezier(0.25,0.1,0.25,1)`;
    el.style.transform = `scale(${scale})`;
    if (vibrate && navigator.vibrate) {
      try { navigator.vibrate(vibrate); } catch {}
    }
  };
  const release = (el: HTMLElement) => {
    el.style.transition = `transform ${duration}ms cubic-bezier(0.25,0.1,0.25,1)`;
    el.style.transform = "scale(1)";
  };
  return {
    onMouseDown: (e: any) => press(e.currentTarget),
    onMouseUp: (e: any) => release(e.currentTarget),
    onMouseLeave: (e: any) => release(e.currentTarget),
    onTouchStart: (e: any) => press(e.currentTarget),
    onTouchEnd: (e: any) => release(e.currentTarget),
  };
}

export const tapMotionProps = getTapMotionProps();
