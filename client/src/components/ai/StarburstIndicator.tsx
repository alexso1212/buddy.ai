import { useEffect, useState } from "react";

interface StarburstIndicatorProps {
  visible: boolean;
}

export default function StarburstIndicator({ visible }: StarburstIndicatorProps) {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      requestAnimationFrame(() => setMounted(true));
    } else {
      setMounted(false);
      const timer = setTimeout(() => setShouldRender(false), 200);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!shouldRender) return null;

  const rays = [0, 45, 90, 135, 180, 225, 270, 315];

  return (
    <div
      className="flex items-center gap-2"
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 200ms ease',
      }}
      data-testid="starburst-indicator"
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{
          animation: 'starburstSpin 3s linear infinite',
        }}
      >
        <g transform="translate(12, 12)">
          {rays.map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = Math.cos(rad) * 3;
            const y1 = Math.sin(rad) * 3;
            const x2 = Math.cos(rad) * 10;
            const y2 = Math.sin(rad) * 10;
            const isPrimary = angle % 90 === 0;

            return (
              <line
                key={angle}
                x1={x1.toFixed(1)}
                y1={y1.toFixed(1)}
                x2={x2.toFixed(1)}
                y2={y2.toFixed(1)}
                stroke="var(--accent-orange, #d4714a)"
                strokeWidth={isPrimary ? 2.2 : 2}
                strokeLinecap="round"
                style={{
                  animation: `starburstRayPulse 1.5s ease-in-out infinite`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            );
          })}
        </g>
      </svg>
    </div>
  );
}
