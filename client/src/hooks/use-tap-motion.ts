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

interface ElasticTiltOptions {
  maxTilt?: number;
  scale?: number;
  perspective?: number;
  glowColor?: string;
  glowIntensity?: number;
  duration?: number;
  vibrate?: number;
}

function computeTilt(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  maxTilt: number,
  scale: number,
  perspective: number,
) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = (clientX - cx) / (rect.width / 2);
  const dy = (clientY - cy) / (rect.height / 2);
  const clampedDx = Math.max(-1, Math.min(1, dx));
  const clampedDy = Math.max(-1, Math.min(1, dy));
  const rotateX = -clampedDy * maxTilt;
  const rotateY = clampedDx * maxTilt;
  return `perspective(${perspective}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
}

export function getElasticTiltProps(options?: ElasticTiltOptions) {
  const {
    maxTilt = 12,
    scale = 0.97,
    perspective = 400,
    glowColor = 'rgba(255,255,255,0.18)',
    glowIntensity = 0.12,
    duration = 200,
    vibrate: vib = 6,
  } = options || {};

  let pressed = false;
  let moveHandler: ((e: PointerEvent) => void) | null = null;
  let currentEl: HTMLElement | null = null;
  let origBoxShadow = '';
  let origFilter = '';

  const applyGlow = (el: HTMLElement) => {
    el.style.boxShadow = `0 0 20px ${glowColor}, 0 0 40px rgba(255,255,255,${glowIntensity * 0.5}), ${origBoxShadow ? origBoxShadow : ''}`.replace(/,\s*$/, '');
    el.style.filter = `brightness(1.15)`;
  };

  const removeGlow = (el: HTMLElement) => {
    el.style.boxShadow = origBoxShadow;
    el.style.filter = origFilter;
  };

  const press = (el: HTMLElement, clientX: number, clientY: number) => {
    if (pressed) return;
    pressed = true;
    currentEl = el;
    origBoxShadow = el.style.boxShadow || '';
    origFilter = el.style.filter || '';

    el.style.transition = `transform ${duration}ms cubic-bezier(0.34,1.56,0.64,1), box-shadow ${duration}ms ease, filter ${duration}ms ease`;
    el.style.transform = computeTilt(el, clientX, clientY, maxTilt, scale, perspective);
    el.style.willChange = 'transform';
    applyGlow(el);

    if (vib && navigator.vibrate) {
      try { navigator.vibrate(vib); } catch {}
    }

    moveHandler = (e: PointerEvent) => {
      if (!pressed || !currentEl) return;
      currentEl.style.transition = 'transform 60ms ease-out, box-shadow 150ms ease, filter 150ms ease';
      currentEl.style.transform = computeTilt(currentEl, e.clientX, e.clientY, maxTilt, scale, perspective);
    };
    window.addEventListener('pointermove', moveHandler);
  };

  const release = (el: HTMLElement) => {
    if (!pressed) return;
    pressed = false;
    currentEl = null;
    el.style.transition = `transform ${duration * 1.5}ms cubic-bezier(0.34,1.56,0.64,1), box-shadow ${duration}ms ease, filter ${duration}ms ease`;
    el.style.transform = 'perspective(400px) rotateX(0deg) rotateY(0deg) scale(1)';
    el.style.willChange = '';
    removeGlow(el);

    if (moveHandler) {
      window.removeEventListener('pointermove', moveHandler);
      moveHandler = null;
    }
  };

  return {
    onPointerDown: (e: any) => {
      const el = e.currentTarget as HTMLElement;
      el.setPointerCapture(e.pointerId);
      press(el, e.clientX, e.clientY);
    },
    onPointerUp: (e: any) => release(e.currentTarget as HTMLElement),
    onPointerLeave: (e: any) => release(e.currentTarget as HTMLElement),
    onPointerCancel: (e: any) => release(e.currentTarget as HTMLElement),
  };
}

export const elasticTiltProps = getElasticTiltProps();

export const elasticTiltSmallProps = getElasticTiltProps({
  maxTilt: 18,
  scale: 0.92,
  perspective: 300,
  glowIntensity: 0.15,
});

export const elasticTiltInputProps = getElasticTiltProps({
  maxTilt: 4,
  scale: 0.985,
  perspective: 800,
  glowColor: 'rgba(255,255,255,0.12)',
  glowIntensity: 0.08,
  duration: 250,
});
