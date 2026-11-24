import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  Coins,
  Lock,
  Moon,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { api } from '../api/client';
import { BurtonGift3DCanvas, type Gift3DStage } from '../components/BurtonGift3DCanvas';
import type { RevealData } from '../types';

/** Adorno gótico de esquina estilo hierro forjado / Tim Burton */
function GothicCorner({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={`pointer-events-none h-9 w-9 text-[#e3b25a]/45 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 44 C4 20, 12 12, 24 8 C34 5, 42 8, 44 4 M10 38 C10 24, 18 18, 28 16 C32 15, 34 19, 30 22 C26 24, 23 20, 26 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="2.2" fill="currentColor" />
    </svg>
  );
}

export function RevealPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<RevealData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<Gift3DStage>('idle');

  const [leftPull, setLeftPull] = useState(0);
  const [rightPull, setRightPull] = useState(0);
  const [leftDone, setLeftDone] = useState(false);
  const [rightDone, setRightDone] = useState(false);

  const startedOpenRef = useRef(false);

  const warpStars = useMemo(
    () =>
      Array.from({ length: 24 }, (_, idx) => {
        const angle = (idx / 24) * Math.PI * 2;
        const dist = 44 + (idx % 4) * 14;
        return {
          id: idx,
          tx: `${Math.cos(angle) * dist}vw`,
          ty: `${Math.sin(angle) * dist}vh`,
          delay: `${(idx % 6) * 0.08}s`,
          size: `${10 + (idx % 3) * 5}px`,
          color: idx % 3 === 0 ? '#fff4cc' : idx % 3 === 1 ? '#e3b25a' : '#c7b5f0',
        };
      }),
    []
  );

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .getReveal(token)
      .then((res) => setData(res))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar tu sobre secreto.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const start3DDiveSequence = useCallback(() => {
    if (startedOpenRef.current) return;
    startedOpenRef.current = true;
    setLeftDone(true);
    setRightDone(true);
    setLeftPull(1);
    setRightPull(1);

    // Fase 1: se abre la tapa 3D sólida sobre su bisagra + chispas doradas
    setStage('opening');
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.([20, 35, 65]);
    }

    // Fase 2: la cámara WebGL vuela suavemente DENTRO de la caja 3D
    setTimeout(() => {
      setStage('diving');
      confetti({
        particleCount: 135,
        spread: 98,
        origin: { y: 0.52 },
        colors: ['#f2ead7', '#c92a42', '#e3b25a', '#7c6ba8', '#1b182e'],
      });
    }, 680);

    // Fase 3: emerge la tarjeta interior revelada
    setTimeout(() => {
      setStage('revealed');
      if (token) {
        api.markRevealed(token).catch(() => {});
      }
    }, 1980);
  }, [token]);

  useEffect(() => {
    if (leftDone && rightDone && stage === 'idle') {
      start3DDiveSequence();
    }
  }, [leftDone, rightDone, stage, start3DDiveSequence]);

  const opened = stage === 'revealed';
  const pullAny = Math.max(leftPull, rightPull);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-8 sm:py-12">
      {/* Túnel de estrellas + destello cálido al entrar dentro del regalo 3D */}
      {stage === 'diving' && (
        <>
          <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
            {warpStars.map((star) => (
              <span
                key={star.id}
                className="burton-warp-star"
                style={
                  {
                    '--tx': star.tx,
                    '--ty': star.ty,
                    animationDelay: star.delay,
                    fontSize: star.size,
                    color: star.color,
                  } as CSSProperties
                }
              >
                ✦
              </span>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="burton-portal-flash pointer-events-none fixed inset-0 z-50 bg-[radial-gradient(circle_at_center,#fff7db_0%,#e3b25a_36%,#2b173d_76%,#090812_100%)]"
          />
        </>
      )}

      <div className="w-full max-w-md">
        {loading && (
          <div className="burton-card rounded-3xl p-10 text-center">
            <Moon className="mx-auto h-12 w-12 animate-pulse text-[#f3e8c8]" />
            <p className="font-burton mt-4 text-xl text-[#f2ead7]">
              Invocando tu regalo nocturno...
            </p>
          </div>
        )}

        {!loading && error && (
          <div className="burton-card rounded-3xl p-8 text-center">
            <Lock className="mx-auto h-12 w-12 text-[#c92a42]" />
            <h1 className="font-burton mt-4 text-2xl text-[#f2ead7]">Sobre sellado o perdido</h1>
            <p className="mt-2 text-sm text-[#c8bfd4]">{error}</p>
            <Link
              to="/"
              className="mt-6 inline-block rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-[#f2ead7] ring-1 ring-white/15 hover:bg-white/20"
            >
              Volver al inicio
            </Link>
          </div>
        )}

        {!loading && data && (
          <div
            className={`burton-card relative overflow-hidden rounded-[28px] shadow-[0_25px_70px_rgba(0,0,0,0.85)] ${
              opened ? 'animate-emerge-3d' : ''
            }`}
          >
            {/* Banda superior a rayas estilo Jack Skellington */}
            <div className="burton-ribbon h-2.5 w-full opacity-90" />

            {/* Escena lunar en la cabecera */}
            <div className="pointer-events-none relative h-20 overflow-hidden bg-gradient-to-b from-[#1f1a36] to-transparent">
              <div className="absolute left-1/2 top-2 h-24 w-24 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(243,232,200,0.92)_0%,rgba(243,232,200,0.25)_55%,transparent_72%)] opacity-85" />
              <svg
                viewBox="0 0 400 80"
                preserveAspectRatio="none"
                className="absolute bottom-0 left-0 h-14 w-full"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M0,80 L0,54 Q95,28 190,56 T400,48 L400,80 Z" fill="#151325" />
                <path
                  d="M178,48 C202,22 232,20 238,38 C243,52 224,62 213,56 C204,51 205,39 214,37 C220,36 224,41 220,46"
                  fill="none"
                  stroke="#090812"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Marco interior con costuras y esquinas góticas */}
            <div className="relative px-5 pb-8 pt-2 text-center sm:px-7">
              <GothicCorner className="absolute left-3 top-0" />
              <GothicCorner className="absolute right-3 top-0 -scale-x-100" />
              <GothicCorner className="absolute bottom-3 left-3 -scale-y-100" />
              <GothicCorner className="absolute bottom-3 right-3 scale-x-[-1] scale-y-[-1]" />

              <p className="font-gothic inline-flex items-center gap-1.5 rounded-full border border-[#e3b25a]/35 bg-[#1d1830]/90 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e3b25a]">
                <Sparkles className="h-3 w-3" />
                {data.drawTitle}
              </p>

              <h1 className="font-burton mt-3 text-4xl tracking-wide text-[#f7f0e0] drop-shadow-[0_3px_10px_rgba(0,0,0,0.8)] sm:text-5xl">
                ¡Hola, {data.giverName}!
              </h1>

              {!opened ? (
                <div className="mt-2 space-y-2.5">
                  <p className="mx-auto max-w-xs text-xs leading-relaxed text-[#bfb6cc] sm:text-sm">
                    {stage === 'diving'
                      ? '✨ ¡Sumergiéndote dentro de tu regalo...!'
                      : stage === 'opening'
                        ? '🌙 ¡Ambos lazos desatados! Abriendo la caja...'
                        : leftDone && !rightDone
                          ? '🎀 ¡Bien! Ahora arrastra el lazo derecho hacia afuera →'
                          : rightDone && !leftDone
                            ? '🎀 ¡Bien! Ahora arrastra el lazo izquierdo hacia afuera ←'
                            : pullAny > 0.15
                              ? '🎀 ¡Sigue tirando hasta desatar el nudo!'
                              : 'Arrastra hacia afuera las dos puntas del lazo para desatar la caja.'}
                  </p>

                  {/* Indicador de estado de los 2 lazos */}
                  <div className="flex items-center justify-center gap-2.5 text-[11px] font-semibold">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ring-1 transition ${
                        leftDone
                          ? 'bg-[#152d26] text-[#8de8b8] ring-[#7fd1b9]/45'
                          : 'bg-[#1c1830] text-[#e3b25a] ring-[#e3b25a]/30'
                      }`}
                    >
                      {leftDone ? <Check className="h-3 w-3" /> : <ArrowLeft className="h-3 w-3" />}
                      Lazo izq.
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ring-1 transition ${
                        rightDone
                          ? 'bg-[#152d26] text-[#8de8b8] ring-[#7fd1b9]/45'
                          : 'bg-[#1c1830] text-[#e3b25a] ring-[#e3b25a]/30'
                      }`}
                    >
                      Lazo der.
                      {rightDone ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <ArrowRight className="h-3 w-3" />
                      )}
                    </span>
                  </div>

                  {/* Caja de Regalo 3D WebGL (Three.js) sólida sin huecos */}
                  <BurtonGift3DCanvas
                    stage={stage}
                    leftDone={leftDone}
                    rightDone={rightDone}
                    onLeftPullChange={setLeftPull}
                    onRightPullChange={setRightPull}
                    onLeftDone={() => {
                      setLeftPull(1);
                      setLeftDone(true);
                    }}
                    onRightDone={() => {
                      setRightPull(1);
                      setRightDone(true);
                    }}
                  />

                  <button
                    type="button"
                    disabled={stage !== 'idle'}
                    onClick={start3DDiveSequence}
                    className="cursor-pointer text-[11px] text-[#9b90b3] underline decoration-dotted underline-offset-4 transition hover:text-[#e3b25a] disabled:opacity-40"
                  >
                    ¿Prefieres desatar ambos lazos con un toque?
                  </button>
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <p className="font-gothic text-[11px] font-bold uppercase tracking-[0.22em] text-[#e3b25a]">
                    Desde el interior del regalo nocturno...
                  </p>

                  <div className="burton-stitch burton-stripes relative rounded-2xl bg-gradient-to-b from-[#231b38]/90 via-[#191329]/95 to-[#291220]/90 px-5 py-7 shadow-[0_12px_35px_rgba(0,0,0,0.65)]">
                    <span className="font-gothic pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[#e3b25a]/40 bg-[#141122] px-3 py-0.5 text-[10px] uppercase tracking-widest text-[#e3b25a]">
                      ✦ Tu Amigo Invisible ✦
                    </span>
                    <p className="font-burton text-5xl tracking-wide text-[#f8eed8] drop-shadow-[0_4px_18px_rgba(227,178,90,0.45)] sm:text-6xl">
                      {data.receiverName}
                    </p>
                  </div>

                  {data.receiverWishlist && (
                    <div className="rounded-2xl border border-dashed border-[#f2ead7]/25 bg-[#12101f]/90 p-4 text-left">
                      <p className="font-gothic flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#e3b25a]">
                        <ScrollText className="h-3.5 w-3.5" />
                        Sus deseos secretos
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#e6decb]">
                        {data.receiverWishlist}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="rounded-xl border border-[#f2ead7]/15 bg-[#161326]/90 p-3.5">
                      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a99ec0]">
                        <Coins className="h-3.5 w-3.5 text-[#e3b25a]" />
                        Presupuesto
                      </p>
                      <p className="mt-1 text-base font-bold text-[#f7f0e0]">
                        {data.budget !== null ? `${data.budget}${data.currency}` : 'Libre'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#f2ead7]/15 bg-[#161326]/90 p-3.5">
                      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#a99ec0]">
                        <Calendar className="h-3.5 w-3.5 text-[#e3b25a]" />
                        Intercambio
                      </p>
                      <p className="mt-1 text-base font-bold text-[#f7f0e0]">
                        {data.eventDate || 'Por confirmar'}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs italic text-[#b2a8c2]">
                    🤫 Shhh... guarda este secreto bajo llave hasta la noche de Navidad.
                  </p>
                </div>
              )}
            </div>

            {/* Banda inferior a rayas */}
            <div className="burton-ribbon h-2 w-full opacity-80" />
          </div>
        )}

        {/* Pie viral discreto para familias que reciban la tarjeta */}
        {!loading && data && (
          <div className="mt-5 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 rounded-full border border-[#f2ead7]/15 bg-[#12101f]/80 px-4 py-2 text-xs font-medium text-[#cfc6db] transition hover:border-[#e3b25a]/45 hover:text-[#f7f0e0]"
            >
              🌙 ¿Organizas otro sorteo? Crea tu Amigo Invisible gratis →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
