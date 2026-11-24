import { useMemo } from 'react';

interface BurtonBackdropProps {
  snowEnabled: boolean;
}

export function BurtonBackdrop({ snowEnabled }: BurtonBackdropProps) {
  const flakes = useMemo(
    () =>
      Array.from({ length: 26 }, (_, idx) => ({
        id: idx,
        left: `${(idx * 4.1 + (idx % 3) * 2.3) % 100}%`,
        size: `${9 + (idx % 4) * 3}px`,
        duration: `${11 + (idx % 7) * 2.5}s`,
        delay: `${(idx % 9) * -1.9}s`,
        glyph: idx % 3 === 0 ? '✦' : '❄',
      })),
    []
  );

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {/* Luna llena fantasmal en la esquina superior derecha */}
      <div className="animate-moon fixed -right-14 -top-14 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(245,236,210,0.22)_0%,rgba(195,180,225,0.07)_48%,transparent_72%)] sm:right-12 sm:top-10 sm:h-72 sm:w-72" />

      {/* Estrellas tenues */}
      <svg
        className="fixed inset-0 h-full w-full opacity-35"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <circle cx="12%" cy="14%" r="1.2" fill="#f2ead7" />
        <circle cx="24%" cy="8%" r="1" fill="#f2ead7" />
        <circle cx="42%" cy="18%" r="1.3" fill="#e3b25a" />
        <circle cx="67%" cy="11%" r="1.1" fill="#f2ead7" />
        <circle cx="81%" cy="22%" r="1.4" fill="#f2ead7" />
        <circle cx="91%" cy="9%" r="1" fill="#e3b25a" />
        <circle cx="8%" cy="38%" r="1" fill="#f2ead7" />
        <circle cx="75%" cy="35%" r="1.1" fill="#f2ead7" />
      </svg>

      {/* Silueta sutil de colina en espiral y árboles retorcidos al fondo */}
      <svg
        viewBox="0 0 1440 240"
        preserveAspectRatio="none"
        className="fixed bottom-0 left-0 h-32 w-full opacity-45 sm:h-44"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Colinas sombrías */}
        <path
          d="M0,240 L0,165 Q210,95 420,165 T880,150 Q1140,80 1440,155 L1440,240 Z"
          fill="#06060c"
        />
        {/* Espiral icónica en la colina derecha */}
        <path
          d="M1125,132 C1175,85 1245,75 1265,112 C1279,138 1252,163 1226,154 C1205,147 1202,122 1219,115 C1231,110 1242,121 1236,131"
          fill="none"
          stroke="#1e1b33"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Árbol retorcido izquierda */}
        <path
          d="M135,175 C132,140 122,115 112,88 M126,130 C105,118 92,102 82,98 M128,122 C148,108 162,92 174,90 M115,96 C103,82 96,74 88,72"
          fill="none"
          stroke="#06060c"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        {/* Farolillo torcido / arbolito */}
        <path
          d="M310,162 C314,132 325,112 332,96 C339,82 350,86 346,98"
          fill="none"
          stroke="#06060c"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="346" cy="102" r="4" fill="#e3b25a" opacity="0.7" />
      </svg>

      {/* Copos y destellos */}
      {snowEnabled &&
        flakes.map((flake) => (
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
            {flake.glyph}
          </span>
        ))}
    </div>
  );
}
