import { useState, useEffect } from "react";

interface ThinkingAnimationProps {
  size?: number;
  label?: string;
  showLabel?: boolean;
}

const C = {
  primary: "#D4A27F",
  secondary: "#E8C5A8",
  accent: "#C4845C",
  muted: "#9C8B7A",
};

const keyframes = `
@keyframes ta-orbPulse {
  0%, 100% { transform: scale(1); opacity: 0.85; }
  50% { transform: scale(1.15); opacity: 1; }
}
@keyframes ta-orbGlow {
  0%, 100% { box-shadow: 0 0 14px rgba(212,162,127,0.25), 0 0 28px rgba(212,162,127,0.08); }
  50% { box-shadow: 0 0 22px rgba(212,162,127,0.4), 0 0 44px rgba(212,162,127,0.15); }
}
@keyframes ta-ringExpand {
  0% { transform: scale(0.8); opacity: 0.5; }
  100% { transform: scale(2.2); opacity: 0; }
}
@keyframes ta-particleFloat {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; transform: translateY(-5px); }
}
@keyframes ta-dotBounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.35; }
  40% { transform: translateY(-3px); opacity: 1; }
}
`;

function Orb({ size }: { size: number }) {
  const s = size * 0.42;
  return (
    <div style={{
      width: s, height: s, borderRadius: "50%",
      background: `radial-gradient(circle at 35% 35%, ${C.secondary}, ${C.primary} 50%, ${C.accent} 100%)`,
      animation: "ta-orbPulse 2.4s ease-in-out infinite, ta-orbGlow 2.4s ease-in-out infinite",
      position: "relative", zIndex: 2,
    }} />
  );
}

function Rings({ size }: { size: number }) {
  const s = size * 0.42;
  const base = {
    position: "absolute" as const, top: "50%", left: "50%",
    width: s, height: s, marginTop: -s / 2, marginLeft: -s / 2,
    borderRadius: "50%", border: `1.2px solid ${C.primary}`, pointerEvents: "none" as const,
  };
  return (
    <>
      <div style={{ ...base, animation: "ta-ringExpand 2.4s ease-out infinite" }} />
      <div style={{ ...base, animation: "ta-ringExpand 2.4s ease-out infinite", animationDelay: "0.8s" }} />
    </>
  );
}

function Particles({ size }: { size: number }) {
  const pts = [
    { a: 30, d: 0.38, del: 0, r: 2.5 },
    { a: 120, d: 0.4, del: 0.5, r: 2 },
    { a: 210, d: 0.35, del: 1, r: 2 },
    { a: 300, d: 0.38, del: 0.3, r: 3 },
  ];
  return (
    <>
      {pts.map((p, i) => {
        const rad = (p.a * Math.PI) / 180;
        return (
          <div key={i} style={{
            position: "absolute", top: "50%", left: "50%",
            width: p.r, height: p.r, borderRadius: "50%", background: C.secondary,
            transform: `translate(${Math.cos(rad) * size * p.d}px, ${Math.sin(rad) * size * p.d}px)`,
            animation: `ta-particleFloat ${1.8 + i * 0.3}s ease-in-out infinite`,
            animationDelay: `${p.del}s`,
          }} />
        );
      })}
    </>
  );
}

function Dots() {
  return (
    <span style={{ display: "inline-flex", gap: 2, marginLeft: 3 }}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{
          width: 3, height: 3, borderRadius: "50%", background: C.muted,
          animation: "ta-dotBounce 1.4s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </span>
  );
}

export default function ThinkingAnimation({
  size = 36,
  label = "Thinking",
  showLabel = true,
}: ThinkingAnimationProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <style>{keyframes}</style>
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 10,
        padding: "6px 0", background: "transparent",
        opacity: mounted ? 1 : 0, transition: "opacity 0.3s",
      }} data-testid="thinking-animation">
        <div style={{
          position: "relative", width: size, height: size,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Rings size={size} />
          <Particles size={size} />
          <Orb size={size} />
        </div>
        {showLabel && (
          <span style={{
            display: "inline-flex", alignItems: "center",
            fontFamily: "'Söhne', 'Helvetica Neue', sans-serif",
            fontSize: 13, fontWeight: 500, color: C.muted, userSelect: "none",
          }}>
            {label}<Dots />
          </span>
        )}
      </div>
    </>
  );
}
