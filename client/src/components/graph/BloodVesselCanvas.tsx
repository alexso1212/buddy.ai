import { useRef, useEffect } from "react";
import type { GalaxyBoundary } from "./ForceGraph";

interface Particle {
  linkIdx: number;
  t: number;
  baseT: number;
  radius: number;
}

interface PipeStyle {
  particleColor: string;
  baseColor: string;
  baseOpacity: number;
  speed: number;
  hasParticles: boolean;
  isBlocked: boolean;
  isDashed: boolean;
}

const STYLE_CACHE: Record<string, PipeStyle> = {};

function getPipeStyle(srcStatus: string, tgtStatus: string): PipeStyle {
  const key = srcStatus + '|' + tgtStatus;
  if (STYLE_CACHE[key]) return STYLE_CACHE[key];
  let style: PipeStyle;
  switch (srcStatus) {
    case 'done':
      style = tgtStatus === 'done'
        ? { particleColor: '#10b981', baseColor: '#10b981', baseOpacity: 0.10, speed: 0.010, hasParticles: false, isBlocked: false, isDashed: false }
        : { particleColor: '#e0ecff', baseColor: '#e0ecff', baseOpacity: 0.08, speed: 0.010, hasParticles: false, isBlocked: false, isDashed: false };
      break;
    case 'in_progress':
      style = { particleColor: '#f59e0b', baseColor: '#f59e0b', baseOpacity: 0.08, speed: 0.004, hasParticles: true, isBlocked: false, isDashed: false };
      break;
    case 'in_review':
      style = { particleColor: '#3b82f6', baseColor: '#3b82f6', baseOpacity: 0.08, speed: 0.008, hasParticles: true, isBlocked: false, isDashed: false };
      break;
    case 'blocked':
      style = { particleColor: '#ef4444', baseColor: '#ef4444', baseOpacity: 0.08, speed: 0, hasParticles: true, isBlocked: true, isDashed: false };
      break;
    default:
      style = { particleColor: '', baseColor: '#9ca3af', baseOpacity: 0.05, speed: 0, hasParticles: false, isBlocked: false, isDashed: true };
      break;
  }
  STYLE_CACHE[key] = style;
  return style;
}

const BASE_MAX_PARTICLES = 600;

function collectChainNodeIds(links: any[], selectedId: number): Set<number> {
  const childrenOf = new Map<number, number[]>();
  const parentsOf = new Map<number, number[]>();
  for (const l of links) {
    const src = l.source?.id ?? l.source;
    const tgt = l.target?.id ?? l.target;
    if (!childrenOf.has(src)) childrenOf.set(src, []);
    childrenOf.get(src)!.push(tgt);
    if (!parentsOf.has(tgt)) parentsOf.set(tgt, []);
    parentsOf.get(tgt)!.push(src);
  }
  const ids = new Set<number>([selectedId]);
  const q = [selectedId];
  while (q.length > 0) {
    const cur = q.pop()!;
    for (const c of (childrenOf.get(cur) || [])) { if (!ids.has(c)) { ids.add(c); q.push(c); } }
    for (const p of (parentsOf.get(cur) || [])) { if (!ids.has(p)) { ids.add(p); q.push(p); } }
  }
  return ids;
}

function initParticlesForSelected(links: any[], selectedId: number, scale: number = 1): Particle[] {
  const maxParticles = Math.floor(BASE_MAX_PARTICLES * scale);
  const chainIds = collectChainNodeIds(links, selectedId);
  const particles: Particle[] = [];
  for (let i = 0; i < links.length && particles.length < maxParticles; i++) {
    const link = links[i];
    const src = link.source;
    const tgt = link.target;
    if (!src || !tgt) continue;
    const srcId = src.id ?? src;
    const tgtId = tgt.id ?? tgt;
    if (!chainIds.has(srcId) || !chainIds.has(tgtId)) continue;
    const style = getPipeStyle(src.status || '', tgt.status || '');
    if (!style.hasParticles) {
      const count = 4 + Math.floor(Math.random() * 3);
      for (let j = 0; j < count && particles.length < maxParticles; j++) {
        particles.push({
          linkIdx: i,
          t: Math.random(),
          baseT: Math.random() * 0.15,
          radius: 0.8 + Math.random() * 0.4,
        });
      }
    } else {
      const count = style.isBlocked
        ? 8 + Math.floor(Math.random() * 4)
        : 5 + Math.floor(Math.random() * 4);
      for (let j = 0; j < count && particles.length < maxParticles; j++) {
        particles.push({
          linkIdx: i,
          t: style.isBlocked ? Math.random() * 0.15 : Math.random(),
          baseT: Math.random() * 0.15,
          radius: 0.8 + Math.random() * 0.4,
        });
      }
    }
  }
  return particles;
}

interface CollabHealth {
  deptA: number;
  deptB: number;
  healthScore: number;
  taskCount: number;
  metrics: { volume: number; completion: number; timeliness: number; flow: number };
}

interface DeptTubeParticle {
  pairKey: string;
  t: number;
  speed: number;
  radius: number;
  direction: number;
}

function initDeptTubeParticles(centroids: Map<number, { x: number; y: number }>): DeptTubeParticle[] {
  const particles: DeptTubeParticle[] = [];
  const ids = Array.from(centroids.keys());
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const key = `${ids[i]}-${ids[j]}`;
      const count = 3 + Math.floor(Math.random() * 3);
      for (let k = 0; k < count; k++) {
        particles.push({
          pairKey: key,
          t: Math.random(),
          speed: 0.002 + Math.random() * 0.002,
          radius: 0.8 + Math.random() * 0.5,
          direction: Math.random() > 0.5 ? 1 : -1,
        });
      }
    }
  }
  return particles;
}

interface BloodVesselCanvasProps {
  simLinksRef: React.MutableRefObject<any[]>;
  zoomTransformRef: React.MutableRefObject<any>;
  hoveredNodeIdRef: React.MutableRefObject<number | null>;
  selectedNodeIdRef: React.MutableRefObject<number | null>;
  bloodFlow: boolean;
  galaxyDataRef?: React.MutableRefObject<GalaxyBoundary[]>;
  collabHealthRef?: React.MutableRefObject<CollabHealth[]>;
  deptCentroidsRef?: React.MutableRefObject<Map<number, { x: number; y: number }>>;
}

export default function BloodVesselCanvas({
  simLinksRef,
  zoomTransformRef,
  hoveredNodeIdRef,
  selectedNodeIdRef,
  bloodFlow,
  galaxyDataRef,
  collabHealthRef,
  deptCentroidsRef,
}: BloodVesselCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const deptTubeParticlesRef = useRef<DeptTubeParticle[]>([]);
  const lastDeptCountRef = useRef(0);
  const chainIdsRef = useRef<Set<number> | null>(null);
  const animFrameRef = useRef<number>(0);
  const bloodFlowRef = useRef(bloodFlow);
  const lastSelectedIdRef = useRef<number | null>(null);
  const timeRef = useRef(0);
  const fpsFrameCount = useRef(0);
  const fpsLastTime = useRef(performance.now());
  const particleScaleRef = useRef(1);

  useEffect(() => { bloodFlowRef.current = bloodFlow; }, [bloodFlow]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas || !canvas.parentElement) return;
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    function animate() {
      if (!ctx || !canvas) return;
      timeRef.current++;
      const t = timeRef.current;

      fpsFrameCount.current++;
      if (fpsFrameCount.current >= 60) {
        const now = performance.now();
        const elapsed = now - fpsLastTime.current;
        const avgFps = (60 / elapsed) * 1000;
        fpsLastTime.current = now;
        fpsFrameCount.current = 0;
        if (avgFps < 30 && particleScaleRef.current > 0.125) {
          particleScaleRef.current *= 0.5;
          const keep = Math.floor(particlesRef.current.length * 0.5);
          particlesRef.current = particlesRef.current.slice(0, keep);
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const links = simLinksRef.current;
      if (!links || links.length === 0) {
        animFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      const transform = zoomTransformRef.current;
      const hovId = hoveredNodeIdRef.current;
      const selId = selectedNodeIdRef.current;
      const flowing = bloodFlowRef.current;
      const k = transform.k;

      if (selId !== lastSelectedIdRef.current) {
        lastSelectedIdRef.current = selId;
        if (selId !== null) {
          particlesRef.current = initParticlesForSelected(links, selId, particleScaleRef.current);
          chainIdsRef.current = collectChainNodeIds(links, selId);
        } else {
          particlesRef.current = [];
          chainIdsRef.current = null;
        }
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(transform.x, transform.y);
      ctx.scale(k, k);

      const chainIds = chainIdsRef.current;
      const isConnected = (srcId: number, tgtId: number) => {
        if (selId !== null && chainIds) return chainIds.has(srcId) && chainIds.has(tgtId);
        if (hovId !== null) return srcId === hovId || tgtId === hovId;
        return true;
      };

      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const src = link.source;
        const tgt = link.target;
        if (src.x == null || tgt.x == null || !isFinite(src.x) || !isFinite(src.y) || !isFinite(tgt.x) || !isFinite(tgt.y)) continue;

        let opacity: number;
        let color: string;
        let lineWidth: number;
        let dashed: boolean;

        if (flowing) {
          const style = getPipeStyle(src.status || '', tgt.status || '');
          opacity = style.baseOpacity;
          color = style.baseColor;
          lineWidth = 1;
          dashed = style.isDashed;
        } else {
          if (link.isBlocking) {
            opacity = 0.6;
            color = '#ef4444';
            lineWidth = 2;
            dashed = false;
          } else {
            opacity = 0.4;
            color = '#10b981';
            lineWidth = 1;
            dashed = true;
          }
        }

        const connected = isConnected(src.id, tgt.id);
        if (!connected) {
          opacity *= 0.15;
        } else if (selId !== null && connected) {
          opacity = Math.min(opacity * 2.5, 0.6);
          lineWidth *= 1.5;
        }

        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(dashed ? [5, 5] : []);
        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);

      if (flowing && k >= 0.3 && selId !== null) {
        const particles = particlesRef.current;
        for (let pi = 0; pi < particles.length; pi++) {
          const p = particles[pi];
          if (p.linkIdx >= links.length) continue;
          const link = links[p.linkIdx];
          const src = link.source;
          const tgt = link.target;
          if (src.x == null || tgt.x == null || !isFinite(src.x) || !isFinite(src.y) || !isFinite(tgt.x) || !isFinite(tgt.y)) continue;

          const style = getPipeStyle(src.status || '', tgt.status || '');
          const speed = style.hasParticles ? style.speed : 0.005;
          const particleColor = style.hasParticles ? style.particleColor : style.baseColor;

          if (style.isBlocked) {
            p.t = p.baseT + Math.sin(t * 0.03 + p.baseT * 20) * 0.03;
            if (p.t < 0) p.t = 0;
          } else {
            p.t += speed;
            if (p.t > 1) p.t -= 1;
          }

          const px = src.x + (tgt.x - src.x) * p.t;
          const py = src.y + (tgt.y - src.y) * p.t;

          ctx.globalAlpha = 0.85;
          ctx.fillStyle = particleColor;
          ctx.beginPath();
          ctx.arc(px, py, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (deptCentroidsRef && flowing) {
        const centroids = deptCentroidsRef.current;
        if (centroids.size > 0) {
          if (centroids.size !== lastDeptCountRef.current) {
            lastDeptCountRef.current = centroids.size;
            deptTubeParticlesRef.current = initDeptTubeParticles(centroids);
          }

          const ids = Array.from(centroids.keys());
          for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
              const a = centroids.get(ids[i]);
              const b = centroids.get(ids[j]);
              if (!a || !b || !isFinite(a.x) || !isFinite(a.y) || !isFinite(b.x) || !isFinite(b.y)) continue;

              ctx.globalAlpha = 0.06;
              ctx.strokeStyle = '#8b8b8b';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(a.x, a.y);
              ctx.lineTo(b.x, b.y);
              ctx.stroke();
            }
          }

          if (k >= 0.3) {
            const deptParticles = deptTubeParticlesRef.current;
            for (const dp of deptParticles) {
              const [aStr, bStr] = dp.pairKey.split('-');
              const a = centroids.get(Number(aStr));
              const b = centroids.get(Number(bStr));
              if (!a || !b) continue;

              dp.t += dp.speed * dp.direction;
              if (dp.t > 1) dp.t -= 1;
              if (dp.t < 0) dp.t += 1;

              const px = a.x + (b.x - a.x) * dp.t;
              const py = a.y + (b.y - a.y) * dp.t;

              ctx.globalAlpha = 0.45;
              ctx.fillStyle = '#a0a0a0';
              ctx.beginPath();
              ctx.arc(px, py, dp.radius, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      ctx.restore();
      ctx.globalAlpha = 1;

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
    };
  }, [simLinksRef, zoomTransformRef, hoveredNodeIdRef, selectedNodeIdRef, galaxyDataRef, collabHealthRef, deptCentroidsRef]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="blood-vessel-canvas"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
