import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Coins,
  Eye,
  Moon,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import { api, removeDrawToken, saveDrawToken } from '../api/client';
import { CreateDrawModal } from '../components/CreateDrawModal';
import type { Draw } from '../types';

const STATUS_BADGE: Record<Draw['status'], { label: string; className: string }> = {
  draft: {
    label: 'Borrador',
    className: 'bg-[#201c34] text-[#cfc6db] ring-[#f2ead7]/20',
  },
  drawn: {
    label: 'Sorteado',
    className: 'bg-[#2c1f16] text-[#f3d08b] ring-[#e3b25a]/40',
  },
  sent: {
    label: 'Enviado',
    className: 'bg-[#122623] text-[#8ee3c0] ring-[#7fd1b9]/35',
  },
};

export function HomePage() {
  const navigate = useNavigate();
  const [draws, setDraws] = useState<Draw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadDraws = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listDraws();
      setDraws(res.draws);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los sorteos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDraws();
  }, []);

  const handleDelete = async (draw: Draw) => {
    if (!window.confirm(`¿Seguro que quieres eliminar el sorteo "${draw.title}"?`)) return;
    try {
      const key = draw.admin_token || draw.id;
      await api.deleteDraw(key);
      removeDrawToken(draw.admin_token);
      setDraws((prev) => prev.filter((d) => d.id !== draw.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Hero Nocturno Tim Burton */}
      <section className="burton-card burton-stripes relative overflow-hidden rounded-[28px] shadow-2xl">
        <div className="burton-ribbon h-2 w-full opacity-85" />
        <div className="pointer-events-none absolute -right-10 -top-10 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(243,232,200,0.22)_0%,rgba(201,42,66,0.08)_55%,transparent_75%)]" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-52 w-52 rounded-full bg-[#6e4ba8]/20 blur-3xl" />

        <div className="relative flex flex-col items-start justify-between gap-6 p-7 sm:p-10 md:flex-row md:items-center">
          <div className="max-w-2xl space-y-3.5">
            <div className="font-gothic inline-flex items-center gap-2 rounded-full border border-[#e3b25a]/35 bg-[#1b1630]/90 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e3b25a]">
              <Sparkles className="h-3.5 w-3.5" />
              Sorteos Nocturnos · Cero Spoilers · WhatsApp
            </div>
            <h1 className="font-burton text-4xl leading-tight tracking-wide text-[#f8f1e2] drop-shadow-[0_4px_14px_rgba(0,0,0,0.8)] sm:text-6xl">
              Tu Amigo Invisible de Navidad
            </h1>
            <p className="text-sm leading-relaxed text-[#c9c0d6] sm:text-base">
              Reúne a tu familia o amigos, bloquea parejas con exclusiones y envía a cada persona
              una{' '}
              <span className="font-semibold text-[#f3d49b]">
                tarjeta mágica interactiva por WhatsApp
              </span>{' '}
              sin que ni tú sepas a quién le tocó cada uno.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex shrink-0 cursor-pointer items-center gap-2.5 rounded-2xl border border-[#e3b25a]/45 bg-gradient-to-r from-[#8f182f] via-[#b5223e] to-[#8f182f] px-6 py-3.5 text-sm font-bold text-[#fbf4e4] shadow-[0_12px_30px_rgba(176,32,59,0.45)] transition hover:scale-[1.02] hover:brightness-110"
          >
            <Plus className="h-5 w-5 text-[#f3e8c8]" />
            Crear nuevo sorteo
          </button>
        </div>
      </section>

      {/* Listado de sorteos */}
      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-burton text-2xl tracking-wide text-[#f7f0e0]">Tus Sorteos</h2>
            <p className="text-xs text-[#a99ec0]">
              Solo tú puedes ver y gestionar tus sorteos desde este navegador
            </p>
          </div>
          {draws.length > 0 && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#f2ead7]/15 bg-[#1b1730] px-3.5 py-2 text-xs font-semibold text-[#f2ead7] transition hover:border-[#e3b25a]/45 hover:bg-[#241f3f]"
            >
              <Plus className="h-4 w-4" />
              Nuevo
            </button>
          )}
        </div>

        {error && (
          <div className="rounded-2xl border border-[#c92a42]/40 bg-[#2a1219]/85 p-5 text-sm text-[#f9d6dc]">
            <p className="font-semibold">No se pudo cargar la lista de sorteos</p>
            <p className="mt-1 text-xs opacity-90">{error}</p>
            <button
              type="button"
              onClick={loadDraws}
              className="mt-3 cursor-pointer rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading && !error && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-2xl border border-white/10 bg-[#151326]/70"
              />
            ))}
          </div>
        )}

        {!loading && !error && draws.length === 0 && (
          <div className="burton-card burton-stitch rounded-3xl px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e3b25a]/35 bg-[#221b38] text-[#f3e8c8]">
              <Moon className="h-7 w-7" />
            </div>
            <h3 className="font-burton mt-4 text-2xl text-[#f7f0e0]">
              Aún no hay ningún sorteo bajo la luna
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-[#b7adc9]">
              Crea tu primer sorteo navideño, añade participantes y envía las tarjetas secretas por
              WhatsApp.
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#e3b25a]/40 bg-[#a11d36] px-5 py-2.5 text-sm font-semibold text-[#fbf4e4] shadow-lg transition hover:bg-[#ba2440]"
            >
              <Plus className="h-4 w-4" />
              Crear mi primer sorteo
            </button>
          </div>
        )}

        {!loading && !error && draws.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {draws.map((draw) => {
              const badge = STATUS_BADGE[draw.status];
              const drawUrl = draw.admin_token ? `/panel/${draw.admin_token}` : `/sorteos/${draw.id}`;
              return (
                <div
                  key={draw.id}
                  className="burton-card group relative flex flex-col justify-between rounded-2xl p-5 transition hover:-translate-y-0.5 hover:border-[#e3b25a]/45"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${badge.className}`}
                      >
                        {draw.status === 'sent' && <CheckCircle2 className="h-3 w-3" />}
                        {badge.label}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {draw.anti_spoiler && (
                          <span
                            title="Modo Anti-Spoiler activado"
                            className="rounded-full bg-[#e3b25a]/15 p-1 text-[#e3b25a]"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(draw)}
                          title="Eliminar sorteo"
                          className="cursor-pointer rounded-lg p-1.5 text-[#8a80a0] transition hover:bg-[#c92a42]/20 hover:text-[#f59aa8]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <Link to={drawUrl} className="mt-3 block">
                      <h3 className="font-burton text-2xl tracking-wide text-[#f7f0e0] transition group-hover:text-[#e3b25a]">
                        {draw.title}
                      </h3>
                    </Link>

                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#c7bed6]">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-[#e3b25a]" />
                        {draw.event_date || 'Sin fecha'}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3.5 w-3.5 text-[#e3b25a]" />
                        {draw.budget !== null ? `${draw.budget}${draw.currency}` : 'Libre'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-dashed border-[#f2ead7]/15 pt-4">
                    <div className="flex items-center justify-between text-xs text-[#a99ec0]">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-[#b39ddb]" />
                        {draw.participant_count ?? 0} personas
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Send className="h-3.5 w-3.5 text-[#7fd1b9]" />
                        {draw.sent_count ?? 0} enviados
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5 text-[#e3b25a]" />
                        {draw.revealed_count ?? 0} vistos
                      </span>
                    </div>

                    <Link
                      to={drawUrl}
                      className="mt-4 flex w-full items-center justify-center rounded-xl border border-[#f2ead7]/15 bg-[#201b36] py-2 text-xs font-semibold text-[#f7f0e0] transition hover:border-[#e3b25a]/45 hover:bg-[#9f1d35]"
                    >
                      Gestionar sorteo →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <CreateDrawModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(draw) => {
          saveDrawToken(draw.admin_token);
          navigate(draw.admin_token ? `/panel/${draw.admin_token}` : `/sorteos/${draw.id}`);
        }}
      />
    </div>
  );
}
