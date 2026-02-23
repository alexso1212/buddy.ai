import { useState, useEffect, CSSProperties } from "react";

interface AgentLogoProps {
  size?: number;
  animate?: boolean;
  glow?: boolean;
  className?: string;
  style?: CSSProperties;
}

const COLORS = {
  from: "#E8C5A8",
  mid: "#D4A27F",
  to: "#C4845C",
  inner: "rgba(250,248,245,0.4)",
  innerBright: "rgba(250,248,245,0.55)",
};

const keyframes = `
@keyframes agentMorph {
  0%   { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; }
  25%  { border-radius: 58% 42% 28% 72% / 68% 26% 74% 32%; }
  50%  { border-radius: 72% 28% 62% 38% / 38% 72% 28% 62%; }
  75%  { border-radius: 28% 72% 44% 56% / 56% 44% 62% 38%; }
  100% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; }
}
@keyframes agentGlow {
  0%, 100% { box-shadow: 0 0 20px rgba(212,162,127,0.15), 0 0 40px rgba(212,162,127,0.05); }
  50%      { box-shadow: 0 0 32px rgba(212,162,127,0.3), 0 0 64px rgba(212,162,127,0.1); }
}
@keyframes agentInnerPulse {
  0%, 100% { opacity: 0.7; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.1); }
}
`;

export default function AgentLogo({
  size = 48,
  animate = true,
  glow = true,
  className = "",
  style = {},
}: AgentLogoProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const innerSize = size * 0.22;

  const blobStyle: CSSProperties = {
    width: size,
    height: size,
    background: `linear-gradient(135deg, ${COLORS.from} 0%, ${COLORS.mid} 40%, ${COLORS.to} 100%)`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "opacity 0.3s",
    opacity: mounted ? 1 : 0,
    ...(animate
      ? { animation: `agentMorph 4s ease-in-out infinite${glow ? ", agentGlow 4s ease-in-out infinite" : ""}` }
      : {
          borderRadius: "30% 70% 70% 30% / 30% 30% 70% 70%",
          ...(glow ? { boxShadow: "0 0 20px rgba(212,162,127,0.15)" } : {}),
        }),
    ...style,
  };

  const innerStyle: CSSProperties = {
    width: innerSize,
    height: innerSize,
    borderRadius: "50%",
    background: `radial-gradient(circle at 40% 40%, ${COLORS.innerBright}, ${COLORS.inner})`,
    ...(animate ? { animation: "agentInnerPulse 2.4s ease-in-out infinite" } : {}),
  };

  return (
    <>
      <style>{keyframes}</style>
      <div className={className} style={blobStyle} data-testid="agent-logo">
        <div style={innerStyle} />
      </div>
    </>
  );
}
