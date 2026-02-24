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

interface ElasticDeformOptions {
  maxStretch?: number;
  maxTranslate?: number;
  baseScale?: number;
  glowSpread?: number;
  glowStrength?: number;
  duration?: number;
  vibrate?: number;
}

function computeDeform(
  el: HTMLElement,
  clientX: number,
  clientY: number,
  maxStretch: number,
  maxTranslate: number,
  baseScale: number,
) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const rawDx = clientX - cx;
  const rawDy = clientY - cy;
  const dist = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
  const maxDist = Math.max(rect.width, rect.height);
  const norm = Math.min(dist / maxDist, 1.5);

  const dx = maxDist > 0 ? rawDx / maxDist : 0;
  const dy = maxDist > 0 ? rawDy / maxDist : 0;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let scaleX = baseScale;
  let scaleY = baseScale;

  if (absDx > absDy) {
    scaleX = baseScale + norm * maxStretch * 0.6;
    scaleY = baseScale - norm * maxStretch * 0.35;
  } else if (absDy > absDx) {
    scaleY = baseScale + norm * maxStretch * 0.6;
    scaleX = baseScale - norm * maxStretch * 0.35;
  } else {
    scaleX = baseScale + norm * maxStretch * 0.2;
    scaleY = baseScale + norm * maxStretch * 0.2;
  }

  scaleX = Math.max(baseScale - maxStretch, Math.min(baseScale + maxStretch, scaleX));
  scaleY = Math.max(baseScale - maxStretch, Math.min(baseScale + maxStretch, scaleY));

  const tx = dx * norm * maxTranslate;
  const ty = dy * norm * maxTranslate;

  return { scaleX, scaleY, tx, ty, dx, dy, norm };
}

function computeGlow(
  dx: number,
  dy: number,
  norm: number,
  glowSpread: number,
  glowStrength: number,
) {
  const intensity = 0.15 + norm * glowStrength;
  const spreadPx = glowSpread + norm * glowSpread * 0.5;

  const offsetX = dx * spreadPx * 0.6;
  const offsetY = dy * spreadPx * 0.6;

  const base = `0 0 ${spreadPx}px rgba(255,255,255,${intensity * 0.5})`;
  const directional = `${offsetX}px ${offsetY}px ${spreadPx * 1.5}px rgba(255,255,255,${intensity})`;
  const inner = `inset ${offsetX * 0.3}px ${offsetY * 0.3}px ${spreadPx * 0.6}px rgba(255,255,255,${intensity * 0.3})`;

  return `${directional}, ${base}, ${inner}`;
}

export function getElasticDeformProps(options?: ElasticDeformOptions) {
  const {
    maxStretch = 0.08,
    maxTranslate = 6,
    baseScale = 0.97,
    glowSpread = 16,
    glowStrength = 0.25,
    duration = 180,
    vibrate: vib = 6,
  } = options || {};

  let pressed = false;
  let moveHandler: ((e: PointerEvent) => void) | null = null;
  let currentEl: HTMLElement | null = null;
  let origBoxShadow = '';
  let origFilter = '';

  const applyDeform = (el: HTMLElement, clientX: number, clientY: number, fast: boolean) => {
    const { scaleX, scaleY, tx, ty, dx, dy, norm } = computeDeform(el, clientX, clientY, maxStretch, maxTranslate, baseScale);
    const glow = computeGlow(dx, dy, norm, glowSpread, glowStrength);

    const dur = fast ? 50 : duration;
    el.style.transition = `transform ${dur}ms cubic-bezier(0.25,0.46,0.45,0.94), box-shadow ${dur}ms ease, filter ${dur}ms ease`;
    el.style.transform = `translate(${tx}px, ${ty}px) scaleX(${scaleX.toFixed(4)}) scaleY(${scaleY.toFixed(4)})`;
    el.style.boxShadow = origBoxShadow ? `${glow}, ${origBoxShadow}` : glow;
    el.style.filter = `brightness(${1 + norm * 0.18})`;
  };

  const press = (el: HTMLElement, clientX: number, clientY: number) => {
    if (pressed) return;
    pressed = true;
    currentEl = el;
    origBoxShadow = el.style.boxShadow || '';
    origFilter = el.style.filter || '';
    el.style.willChange = 'transform, box-shadow, filter';

    applyDeform(el, clientX, clientY, false);

    if (vib && navigator.vibrate) {
      try { navigator.vibrate(vib); } catch {}
    }

    moveHandler = (e: PointerEvent) => {
      if (!pressed || !currentEl) return;
      applyDeform(currentEl, e.clientX, e.clientY, true);
    };
    window.addEventListener('pointermove', moveHandler);
  };

  const release = (el: HTMLElement) => {
    if (!pressed) return;
    pressed = false;
    currentEl = null;

    el.style.transition = `transform ${duration * 2}ms cubic-bezier(0.34,1.56,0.64,1), box-shadow ${duration}ms ease, filter ${duration}ms ease`;
    el.style.transform = 'translate(0px, 0px) scaleX(1) scaleY(1)';
    el.style.boxShadow = origBoxShadow;
    el.style.filter = origFilter;
    el.style.willChange = '';

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

export const elasticDeformProps = getElasticDeformProps();

export const elasticDeformSmallProps = getElasticDeformProps({
  maxStretch: 0.12,
  maxTranslate: 4,
  baseScale: 0.93,
  glowSpread: 12,
  glowStrength: 0.3,
});

export const elasticDeformInputProps = getElasticDeformProps({
  maxStretch: 0.025,
  maxTranslate: 3,
  baseScale: 0.99,
  glowSpread: 20,
  glowStrength: 0.15,
  duration: 220,
});
