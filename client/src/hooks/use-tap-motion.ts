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
  const refDist = Math.max(rect.width, rect.height, 60) * 1.5;
  const norm = Math.min(dist / refDist, 1.0);

  const angle = Math.atan2(rawDy, rawDx);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const stretchAlongDrag = norm * maxStretch;
  const compressPerpendicular = norm * maxStretch * 0.55;

  let scaleX = baseScale + stretchAlongDrag * Math.abs(cosA) - compressPerpendicular * Math.abs(sinA);
  let scaleY = baseScale + stretchAlongDrag * Math.abs(sinA) - compressPerpendicular * Math.abs(cosA);

  scaleX = Math.max(baseScale - maxStretch * 0.6, Math.min(baseScale + maxStretch, scaleX));
  scaleY = Math.max(baseScale - maxStretch * 0.6, Math.min(baseScale + maxStretch, scaleY));

  const tx = cosA * norm * maxTranslate;
  const ty = sinA * norm * maxTranslate;

  const glowX = Math.max(0, Math.min(1, 0.5 + cosA * norm * 0.4));
  const glowY = Math.max(0, Math.min(1, 0.5 + sinA * norm * 0.4));

  return { scaleX, scaleY, tx, ty, norm, glowX, glowY };
}

export function getElasticDeformProps(options?: ElasticDeformOptions) {
  const {
    maxStretch = 0.15,
    maxTranslate = 2,
    baseScale = 1.0,
    glowSpread = 14,
    glowStrength = 0.35,
    duration = 180,
    vibrate: vib = 6,
  } = options || {};

  let pressed = false;
  let moveHandler: ((e: PointerEvent) => void) | null = null;
  let currentEl: HTMLElement | null = null;
  let origBg = '';
  let origBorder = '';
  let origBoxShadow = '';
  let pendingRaf = 0;

  const applyDeform = (el: HTMLElement, clientX: number, clientY: number) => {
    const { scaleX, scaleY, tx, ty, norm, glowX, glowY } = computeDeform(el, clientX, clientY, maxStretch, maxTranslate, baseScale);

    el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scaleX(${scaleX.toFixed(4)}) scaleY(${scaleY.toFixed(4)})`;

    const glowIntensity = 0.2 + norm * glowStrength;
    const spreadPx = glowSpread + norm * glowSpread * 0.6;
    const offX = (glowX - 0.5) * spreadPx * 0.8;
    const offY = (glowY - 0.5) * spreadPx * 0.8;
    el.style.boxShadow = `${offX.toFixed(1)}px ${offY.toFixed(1)}px ${spreadPx.toFixed(0)}px rgba(255,255,255,${glowIntensity.toFixed(2)}), 0 0 ${(spreadPx * 0.6).toFixed(0)}px rgba(255,255,255,${(glowIntensity * 0.4).toFixed(2)}), inset 0 0 ${(spreadPx * 0.5).toFixed(0)}px rgba(255,255,255,${(glowIntensity * 0.15).toFixed(2)})`;

    const bgAlpha = (0.25 + norm * 0.2).toFixed(2);
    const a = parseFloat(bgAlpha);
    el.style.background = `radial-gradient(ellipse at ${(glowX * 100).toFixed(0)}% ${(glowY * 100).toFixed(0)}%, rgba(255,255,255,${bgAlpha}) 0%, rgba(255,255,255,${(a * 0.7).toFixed(3)}) 15%, rgba(255,255,255,${(a * 0.45).toFixed(3)}) 30%, rgba(255,255,255,${(a * 0.25).toFixed(3)}) 50%, rgba(255,255,255,${(a * 0.1).toFixed(3)}) 70%, rgba(255,255,255,${(a * 0.03).toFixed(3)}) 85%, rgba(255,255,255,0) 100%)`;
    el.style.borderColor = `rgba(255,255,255,${(0.3 + norm * 0.25).toFixed(2)})`;
  };

  const press = (el: HTMLElement, clientX: number, clientY: number) => {
    if (pressed) return;
    pressed = true;
    currentEl = el;
    origBg = el.style.background || '';
    origBorder = el.style.borderColor || '';
    origBoxShadow = el.style.boxShadow || '';
    el.style.willChange = 'transform, box-shadow';

    applyDeform(el, clientX, clientY);

    if (vib && navigator.vibrate) {
      try { navigator.vibrate(vib); } catch {}
    }

    moveHandler = (e: PointerEvent) => {
      if (!pressed || !currentEl) return;
      const cx = e.clientX;
      const cy = e.clientY;
      if (pendingRaf) cancelAnimationFrame(pendingRaf);
      pendingRaf = requestAnimationFrame(() => {
        if (!pressed || !currentEl) return;
        applyDeform(currentEl, cx, cy);
        pendingRaf = 0;
      });
    };
    window.addEventListener('pointermove', moveHandler, { passive: true });
  };

  const release = (el: HTMLElement) => {
    if (!pressed) return;
    pressed = false;
    currentEl = null;
    if (pendingRaf) {
      cancelAnimationFrame(pendingRaf);
      pendingRaf = 0;
    }

    el.style.transition = `transform ${duration * 2.5}ms cubic-bezier(0.34,1.56,0.64,1), background ${duration * 1.5}ms ease, border-color ${duration * 1.5}ms ease, box-shadow ${duration * 1.5}ms ease`;
    el.style.transform = 'translate3d(0px, 0px, 0) scaleX(1) scaleY(1)';
    el.style.background = origBg;
    el.style.borderColor = origBorder;
    el.style.boxShadow = origBoxShadow;
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

export const elasticDeformProps = getElasticDeformProps({
  maxTranslate: 4,
});

export const elasticDeformSmallProps = getElasticDeformProps({
  maxStretch: 0.20,
  maxTranslate: 5,
  baseScale: 1.0,
  glowSpread: 10,
  glowStrength: 0.4,
});

export const elasticDeformInputProps = getElasticDeformProps({
  maxStretch: 0.03,
  maxTranslate: 2,
  baseScale: 1.0,
  glowSpread: 18,
  glowStrength: 0.2,
  duration: 200,
});
