import { useMemo } from 'react';

interface SnowfallProps {
  enabled: boolean;
}

export function Snowfall({ enabled }: SnowfallProps) {
  const flakes = useMemo(
    () =>
      Array.from({ length: 24 }, (_, idx) => ({
        id: idx,
        left: `${(idx * 4.3 + (idx % 3) * 2.1) % 100}%`,
        size: `${10 + (idx % 5) * 3}px`,
        duration: `${10 + (idx % 7) * 2.4}s`,
        delay: `${(idx % 9) * -1.8}s`,
      })),
    []
  );

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {flakes.map((flake) => (
        <span
          key={flake.id}
          className="snowflake select-none"
          style={{
            left: flake.left,
            fontSize: flake.size,
            animationDuration: flake.duration,
            animationDelay: flake.delay,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}
