import { useState, type FormEvent } from 'react';
import { Calendar, Coins, Gift, ShieldCheck, Sparkles, X } from 'lucide-react';
import { api } from '../api/client';
import type { Draw } from '../types';

interface CreateDrawModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (draw: Draw) => void;
}

export function CreateDrawModal({ open, onClose, onCreated }: CreateDrawModalProps) {
  const [title, setTitle] = useState('Amigo Invisible Navidad 2026');
  const [eventDate, setEventDate] = useState('2026-12-24');
  const [budget, setBudget] = useState('25');
  const [currency, setCurrency] = useState('€');
  const [avoidReciprocal, setAvoidReciprocal] = useState(true);
  const [antiSpoiler, setAntiSpoiler] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.createDraw({
        title,
        event_date: eventDate || null,
        budget: budget ? Number(budget) : null,
        currency,
        avoid_reciprocal: avoidReciprocal,
        anti_spoiler: antiSpoiler,
      });
      onCreated(res.draw);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el sorteo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="burton-card w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl">
        <div className="burton-ribbon h-1.5 w-full opacity-80" />
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#e3b25a]/40 bg-[#241b39] text-[#f3e8c8]">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-burton text-2xl text-[#f7f0e0]">Nuevo Sorteo Nocturno</h2>
                <p className="text-xs text-[#a99ec0]">
                  Configura los detalles básicos del intercambio
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-lg p-1.5 text-[#a99ec0] hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-stone-300">
              Nombre del sorteo
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Navidad Familia García 2026"
              className="w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder-stone-500 outline-none focus:border-amber-400/60"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-300">
                <Calendar className="h-3.5 w-3.5 text-amber-300" />
                Fecha del intercambio
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-400/60"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-300">
                <Coins className="h-3.5 w-3.5 text-amber-300" />
                Presupuesto sugerido
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="25"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-2.5 text-sm text-white outline-none focus:border-amber-400/60"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="rounded-xl border border-white/15 bg-[#0b1915] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/60"
                >
                  <option value="€">€</option>
                  <option value="$">$</option>
                  <option value="MXN">MXN</option>
                  <option value="ARS">ARS</option>
                  <option value="COP">COP</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-2.5 rounded-xl border border-white/10 bg-black/20 p-3.5">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={antiSpoiler}
                onChange={(e) => setAntiSpoiler(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <div>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-200">
                  <ShieldCheck className="h-4 w-4" /> Modo Anti-Spoiler (Recomendado)
                </span>
                <p className="text-xs text-stone-400">
                  Oculta las parejas en el panel para que tú también puedas participar sin saber a
                  quién le tocó cada persona.
                </p>
              </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 pt-1">
              <input
                type="checkbox"
                checked={avoidReciprocal}
                onChange={(e) => setAvoidReciprocal(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-amber-500"
              />
              <div>
                <span className="text-sm font-semibold text-stone-200">
                  Evitar regalos mutuos (A ↔ B)
                </span>
                <p className="text-xs text-stone-400">
                  Evita que dos personas se regalen entre sí en grupos de 3 o más participantes.
                </p>
              </div>
            </label>
          </div>

          {error && (
            <div className="rounded-xl bg-red-950/70 px-3.5 py-2.5 text-xs text-red-200 ring-1 ring-red-500/40">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium text-[#cfc6db] hover:bg-white/10"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#e3b25a]/45 bg-gradient-to-r from-[#8f182f] to-[#b5223e] px-5 py-2.5 text-sm font-semibold text-[#fbf4e4] shadow-lg transition hover:brightness-110 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-[#f3e8c8]" />
              {loading ? 'Creando...' : 'Crear sorteo'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
}
