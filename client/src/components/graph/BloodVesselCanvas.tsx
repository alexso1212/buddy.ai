import { useRef, useEffect } from "react";

interface Particle {
  linkIdx: number;
  t: number;
  baseT: number;
  radius: number;
}

interface CollabParticle {
  pairIdx: number;
  t: number;
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

function getPipeStyle(srcStatus: string, tgtStatus: string): PipeStyle {
  switch (srcStatus) {
    case 'done':
      return tgtStatus === 'done'
        ? { particleColor: '#10b981', baseColor: '#10b981', baseOpacity: 0.10, speed: 0.010, hasParticles: true, isBlocked: false, isDashed: false }
        : { particleColor: '#e0ecff', baseColor: '#e0ecff', baseOpacity: 0.08, speed: 0.010, hasParticles: true, isBlocked: false, isDashed: false };
    case 'in_progress':
      return { particleColor: '#f59e0b', baseColor: '#f59e0b', baseOpacity: 0.08, speed: 0.004, hasParticles: true, isBlocked: false, isDashed: false };
    case 'in_review':
      return { particleColor: '#3b82f6', baseColor: '#3b82f6', baseOpacity: 0.08, speed: 0.008, hasParticles: true, isBlocked: false, isDashed: false };
    case 'blocked':
      return { particleColor: '#ef4444', baseColor: '#ef4444', baseOpacity: 0.08, speed: 0, hasParticles: true, isBlocked: true, isDashed: false };
    default:
      return { particleColor: '', baseColor: '#9ca3af', baseOpacity: 0.05, speed: 0, hasParticles: false, isBlocked: false, isDashed: true };
  }
}

function getHealthColor(score: number): string {
  if (score > 0.7) return '#10b981';
  if (score > 0.3) return '#f59e0b';
  return '#ef4444';
}

const BASE_MAX_PARTICLES = 1500;

function initParticles(links: any[], scale: number = 1): Particle[] {
  const maxParticles = Math.floor(BASE_MAX_PARTICLES * scale);
  const particles: Particle[] = [];
  for (let i = 0; i < links.length && particles.length < maxParticles; i++) {
    const link = links[i];
    const src = link.source;
    const tgt = link.target;
    if (!src || !tgt) continue;
    const style = getPipeStyle(src.status || '', tgt.status || '');
    if (!style.hasParticles) continue;
    const count = style.isBlocked
      ? 15 + Math.floor(Math.random() * 6)
      : 8 + Math.floor(Math.random() * 8);
    for (let j = 0; j < count && particles.length < maxParticles; j++) {
      particles.push({
        linkIdx: i,
        t: style.isBlocked ? Math.random() * 0.15 : Math.random(),
        baseT: Math.random() * 0.15,
        radius: 1 + Math.random() * 0.5,
      });
    }
  }
  return particles;
}

interface GalaxyBoundary {
  deptId: number;
  name: string;
  color: string;
  cx: number;
  cy: number;
  radius: number;
  nodeCount: number;
}

interface CollabHealth {
  deptA: number;
  deptB: number;
  healthScore: number;
  taskCount: number;
  metrics: { volume: number; completion: number; timeliness: number; flow: number };
}

interface BloodVesselCanvasProps {
  simLinksRef: React.MutableRefObject<any[]>;
  zoomTransformRef: React.MutableRefObject<any>;
  hoveredNodeIdRef: React.MutableRefObject<number | null>;
  bloodFlow: boolean;
  galaxyDataRef?: React.MutableRefObject<GalaxyBoundary[]>;
  collabHealthRef?: React.MutableRefObject<CollabHealth[]>;
}

export default function BloodVesselCanvas({
  simLinksRef,
  zoomTransformRef,
  hoveredNodeIdRef,
  bloodFlow,
  galaxyDataRef,
  collabHealthRef,
}: BloodVesselCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const collabParticlesRef = useRef<CollabParticle[]>([]);
  const animFrameRef = useRef<number>(0);
  const bloodFlowRef = useRef(bloodFlow);
  const lastLinksRef = useRef<any[] | null>(null);
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

      if (links !== lastLinksRef.current) {
        lastLinksRef.current = links;
        particlesRef.current = initParticles(links, particleScaleRef.current);
      }

      const transform = zoomTransformRef.current;
      const hovId = hoveredNodeIdRef.current;
      const flowing = bloodFlowRef.current;
      const k = transform.k;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.translate(transform.x, transform.y);
      ctx.scale(k, k);

      for (let i = 0; i < links.length; i++) {
        const link = links[i];
        const src = link.source;
        const tgt = link.target;
        if (src.x == null || tgt.x == null) continue;

        let opacity: number;
        let color: string;
        let lineWidth: number;
        let dashed: boolean;

        if (flowing) {
          const style = getPipeStyle(src.status || '', tgt.status || '');
          opacity = style.baseOpacity;
          color = style.baseColor;
          lineWidth = 1.5;
          dashed = style.isDashed;
        } else {
          if (link.isBlocking) {
            opacity = 0.6;
            color = '#ef4444';
            lineWidth = 3;
            dashed = false;
          } else {
            opacity = 0.4;
            color = '#10b981';
            lineWidth = 1.5;
            dashed = true;
          }
        }

        if (hovId !== null) {
          if (src.id !== hovId && tgt.id !== hovId) {
            opacity *= 0.2;
          }
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

      if (flowing && k >= 0.3) {
        const particles = particlesRef.current;
        for (const p of particles) {
          if (p.linkIdx >= links.length) continue;
          const link = links[p.linkIdx];
          const src = link.source;
          const tgt = link.target;
          if (src.x == null || tgt.x == null) continue;
          const style = getPipeStyle(src.status || '', tgt.status || '');
          if (!style.hasParticles) continue;

          if (style.isBlocked) {
            p.t = p.baseT + Math.sin(t * 0.03 + p.baseT * 20) * 0.03;
            if (p.t < 0) p.t = 0;
          } else {
            p.t += style.speed;
            if (p.t > 1) p.t -= 1;
          }

          const px = src.x + (tgt.x - src.x) * p.t;
          const py = src.y + (tgt.y - src.y) * p.t;

          let pAlpha = 0.9;
          if (hovId !== null && src.id !== hovId && tgt.id !== hovId) {
            pAlpha = 0.15;
          }

          ctx.globalAlpha = pAlpha;
          ctx.shadowColor = style.particleColor;
          ctx.shadowBlur = 2 + p.radius * 0.5;
          ctx.fillStyle = style.particleColor;
          ctx.beginPath();
          ctx.arc(px, py, p.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }

      if (flowing && galaxyDataRef && collabHealthRef) {
        const galaxies = galaxyDataRef.current;
        const health = collabHealthRef.current;
        if (galaxies.length > 0 && health.length > 0) {
          const galaxyMap = new Map(galaxies.map(g => [g.deptId, g]));

          const activePairs: Array<{
            x1: number; y1: number; x2: number; y2: number;
            color: string; speed: number; width: number;
          }> = [];

          for (const h of health) {
            const gA = galaxyMap.get(h.deptA);
            const gB = galaxyMap.get(h.deptB);
            if (!gA || !gB) continue;

            const dx = gB.cx - gA.cx;
            const dy = gB.cy - gA.cy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / dist;
            const ny = dy / dist;

            activePairs.push({
              x1: gA.cx + nx * gA.radius,
              y1: gA.cy + ny * gA.radius,
              x2: gB.cx - nx * gB.radius,
              y2: gB.cy - ny * gB.radius,
              color: getHealthColor(h.healthScore),
              speed: 0.002 + h.healthScore * 0.012,
              width: Math.max(1, Math.min(4, h.taskCount * 0.5)),
            });
          }

          const lastPairCount = collabParticlesRef.current.length > 0
            ? Math.max(...collabParticlesRef.current.map(p => p.pairIdx)) + 1
            : 0;
          if (activePairs.length > 0 && activePairs.length !== lastPairCount) {
            const cp: CollabParticle[] = [];
            for (let i = 0; i < activePairs.length; i++) {
              const count = 12 + Math.floor(Math.random() * 8);
              for (let j = 0; j < count; j++) {
                cp.push({
                  pairIdx: i,
                  t: Math.random(),
                  radius: 1.5 + Math.random() * 1,
                });
              }
            }
            collabParticlesRef.current = cp;
          }

          for (const cp of collabParticlesRef.current) {
            if (cp.pairIdx >= activePairs.length) continue;
            const pair = activePairs[cp.pairIdx];

            cp.t += pair.speed;
            if (cp.t > 1) cp.t -= 1;

            const px = pair.x1 + (pair.x2 - pair.x1) * cp.t;
            const py = pair.y1 + (pair.y2 - pair.y1) * cp.t;

            ctx.globalAlpha = 0.7;
            ctx.shadowColor = pair.color;
            ctx.shadowBlur = 4 + cp.radius;
            ctx.fillStyle = pair.color;
            ctx.beginPath();
            ctx.arc(px, py, cp.radius, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.shadowBlur = 0;
          ctx.shadowColor = 'transparent';
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
  }, [simLinksRef, zoomTransformRef, hoveredNodeIdRef, galaxyDataRef, collabHealthRef]);

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
