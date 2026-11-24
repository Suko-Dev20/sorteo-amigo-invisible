import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  Gift,
  History,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Trash2,
  Users,
  Wand2,
} from 'lucide-react';
import { api, saveDrawToken } from '../api/client';
import type {
  AssignmentPublicView,
  BaileysStatus,
  DrawDetailResponse,
  MessageContentMode,
  WhatsAppProviderType,
} from '../types';

interface DrawDetailPageProps {
  baileys: BaileysStatus | null;
  baileysSupported: boolean;
  metaConfigured: boolean;
  onOpenWhatsAppModal: () => void;
}

type TabKey = 'participants' | 'rules' | 'send';

const DEMO_PARTICIPANTS = [
  { name: 'Lucía', phone: '+34 600 111 001', wishlist: 'Libros de misterio, velas aromáticas' },
  { name: 'Carlos', phone: '+34 600 111 002', wishlist: 'Café de especialidad, calcetines frikis' },
  { name: 'Marta', phone: '+34 600 111 003', wishlist: 'Plantas de interior, puzzles de 1000 piezas' },
  { name: 'Javier', phone: '+34 600 111 004', wishlist: 'Juegos de mesa, chocolate negro 85%' },
  { name: 'Elena', phone: '+34 600 111 005', wishlist: 'Tazas bonitas, bufanda de lana' },
];

export function DrawDetailPage({
  baileys,
  baileysSupported,
  metaConfigured,
  onOpenWhatsAppModal,
}: DrawDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const drawId = (id || '').trim();

  const [detail, setDetail] = useState<DrawDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('participants');

  // Formulario nuevo participante
  const [pName, setPName] = useState('');
  const [pPhone, setPPhone] = useState('+34 ');
  const [pWishlist, setPWishlist] = useState('');
  const [addingP, setAddingP] = useState(false);

  // Edición rápida de participante
  const [editingPid, setEditingPid] = useState<number | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editWishlist, setEditWishlist] = useState('');

  // Formulario exclusión
  const [exGiver, setExGiver] = useState('');
  const [exReceiver, setExReceiver] = useState('');
  const [exBidirectional, setExBidirectional] = useState(true);

  // Controles de sorteo y WhatsApp
  const [runningDraw, setRunningDraw] = useState(false);
  const [provider, setProvider] = useState<WhatsAppProviderType>('wame');
  const [contentMode, setContentMode] = useState<MessageContentMode>('secret_link');
  const [customMessage, setCustomMessage] = useState('');
  const [savingMsg, setSavingMsg] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingAid, setSendingAid] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast((curr) => (curr?.text === text ? null : curr)), 4500);
  };

  const loadDetail = useCallback(async () => {
    if (!drawId) return;
    try {
      const data = await api.getDrawDetail(drawId);
      setDetail(data);
      saveDrawToken(data.draw.admin_token);
      setCustomMessage(data.draw.custom_message || '');
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el sorteo.');
    } finally {
      setLoading(false);
    }
  }, [drawId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  // Si el sorteo ya estaba sorteado al abrir por primera vez, ir directo a la pestaña de envíos
  useEffect(() => {
    if (detail && detail.draw.status !== 'draft' && activeTab === 'participants' && detail.assignments.length > 0) {
      // Solo la primera carga si no hemos tocado nada
    }
  }, [detail, activeTab]);

  const handleAddParticipant = async (e: FormEvent) => {
    e.preventDefault();
    if (!pName.trim() || !pPhone.trim()) return;
    setAddingP(true);
    try {
      await api.addParticipant(drawId, {
        name: pName.trim(),
        phone: pPhone.trim(),
        wishlist: pWishlist.trim() || null,
      });
      setPName('');
      setPPhone('+34 ');
      setPWishlist('');
      await loadDetail();
      showToast('ok', 'Participante añadido.');
    } catch (err: unknown) {
      showToast('err', err instanceof Error ? err.message : 'Error al añadir participante.');
    } finally {
      setAddingP(false);
    }
  };

  const handleLoadDemo = async () => {
    setAddingP(true);
    try {
      for (const p of DEMO_PARTICIPANTS) {
        await api.addParticipant(drawId, p).catch(() => {});
      }
      await loadDetail();
      showToast('ok', 'Se han cargado 5 participantes de ejemplo.');
    } finally {
      setAddingP(false);
    }
  };

  const handleSaveParticipantEdit = async (pid: number) => {
    try {
      await api.updateParticipant(drawId, pid, {
        phone: editPhone.trim(),
        wishlist: editWishlist.trim() || null,
      });
      setEditingPid(null);
      await loadDetail();
      showToast('ok', 'Datos del participante actualizados.');
    } catch (err: unknown) {
      showToast('err', err instanceof Error ? err.message : 'Error al actualizar.');
    }
  };

  const handleDeleteParticipant = async (pid: number, name: string) => {
    if (!window.confirm(`¿Eliminar a ${name} del sorteo?`)) return;
    try {
      await api.deleteParticipant(drawId, pid);
      await loadDetail();
    } catch (err: unknown) {
      showToast('err', err instanceof Error ? err.message : 'No se pudo eliminar.');
    }
  };

  const handleAddExclusion = async (e: FormEvent) => {
    e.preventDefault();
    const g = Number(exGiver);
    const r = Number(exReceiver);
    if (!g || !r) return;
    try {
      await api.addExclusion(drawId, {
        giver_id: g,
        excluded_receiver_id: r,
        bidirectional: exBidirectional,
      });
      setExGiver('');
      setExReceiver('');
      await loadDetail();
      showToast('ok', exBidirectional ? 'Exclusión mutua añadida.' : 'Exclusión añadida.');
    } catch (err: unknown) {
      showToast('err', err instanceof Error ? err.message : 'Error al añadir exclusión.');
    }
  };

  const handleDeleteExclusion = async (eid: number) => {
    try {
      await api.deleteExclusion(drawId, eid);
      await loadDetail();
    } catch (err: unknown) {
      showToast('err', err instanceof Error ? err.message : 'Error al eliminar exclusión.');
    }
  };

  const handleToggleRule = async (field: 'avoid_reciprocal' | 'anti_spoiler', nextVal: boolean) => {
    if (
      field === 'anti_spoiler' &&
      !nextVal &&
      detail?.draw.status !== 'draft' &&
      !window.confirm(
        '¿Seguro que quieres desactivar el Modo Anti-Spoiler? Verás a quién le tocó regalar cada persona.'
      )
    ) {
      return;
    }

    try {
      await api.updateDraw(drawId, { [field]: nextVal });
      await loadDetail();
      showToast('ok', 'Preferencia guardada.');
    } catch (err: unknown) {
      showToast('err', err instanceof Error ? err.message : 'No se pudo actualizar.');
    }
  };

  const handleSaveCustomMessage = async () => {
    setSavingMsg(true);
    try {
      await api.updateDraw(drawId, { custom_message: customMessage.trim() || null });
      await loadDetail();
      showToast('ok', 'Plantilla de mensaje guardada.');
    } catch (err: unknown) {
      showToast('err', err instanceof Error ? err.message : 'Error guardando mensaje.');
    } finally {
      setSavingMsg(false);
    }
  };

  const handleRunDraw = async () => {
    setRunningDraw(true);
    try {
      const res = await api.runDraw(drawId);
      await loadDetail();
      setActiveTab('send');
      confetti({
        particleCount: 95,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#dc2626', '#f59e0b', '#10b981', '#ffffff'],
      });
      showToast('ok', `¡Sorteo completado con éxito para ${res.count} participantes!`);
    } catch (err: unknown) {
      showToast('err', err instanceof Error ? err.message : 'Error ejecutando el sorteo.');
    } finally {
      setRunningDraw(false);
    }
  };

  const handleResetDraw = async () => {
    if (
      !window.confirm(
        '¿Reiniciar el sorteo? Se borrarán las parejas actuales y los enlaces secretos anteriores dejarán de funcionar.'
      )
    ) {
      return;
    }
    try {
      await api.resetDraw(drawId);
      await loadDetail();
      showToast('ok', 'Sorteo reiniciado a borrador.');
    } catch (err: unknown) {
      showToast('err', err instanceof Error ? err.message : 'No se pudo reiniciar.');
    }
  };

  const handleSendAll = async (forceResend = false) => {
    if (provider === 'baileys' && baileys?.state !== 'connected') {
      onOpenWhatsAppModal();
      showToast('err', 'Conecta primero tu WhatsApp escaneando el código QR.');
      return;
    }
    setSendingAll(true);
    try {
      const res = await api.sendAll(drawId, { provider, contentMode, forceResend });
      await loadDetail();
      if (res.sent === 0 && res.failed === 0 && res.message) {
        showToast('ok', res.message);
      } else if (res.failed === 0) {
        showToast('ok', `Envío completado: ${res.sent} mensajes procesados (${provider}).`);
      } else {
        showToast(
          'err',
          `Enviados: ${res.sent} · Con error: ${res.failed}. Revisa el historial inferior.`
        );
      }
    } catch (err: unknown) {
      showToast('err', err instanceof Error ? err.message : 'Error en el envío masivo.');
    } finally {
      setSendingAll(false);
    }
  };

  const handleSendSingle = async (assignment: AssignmentPublicView) => {
    if (provider === 'baileys' && baileys?.state !== 'connected') {
      onOpenWhatsAppModal();
      showToast('err', 'Conecta primero tu WhatsApp escaneando el código QR.');
      return;
    }

    setSendingAid(assignment.id);
    try {
      const res = await api.sendSingle(drawId, assignment.id, { provider, contentMode });
      if (provider === 'wame' && res.result.wameUrl) {
        window.open(res.result.wameUrl, '_blank', 'noopener,noreferrer');
      }
      await loadDetail();
      if (res.ok) {
        showToast('ok', `Mensaje procesado para ${assignment.giver_name}.`);
      } else {
        showToast('err', res.result.detail);
      }
    } catch (err: unknown) {
      showToast('err', err instanceof Error ? err.message : 'Error al enviar.');
    } finally {
      setSendingAid(null);
    }
  };

  const handleCopyLink = async (a: AssignmentPublicView) => {
    try {
      await navigator.clipboard.writeText(a.reveal_url);
      setCopiedId(a.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('err', 'No se pudo copiar al portapapeles.');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-300" />
        <p className="mt-3 text-sm text-stone-300">Cargando sorteo...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h1 className="mt-3 text-xl font-bold text-white">No se pudo cargar el sorteo</h1>
        <p className="mt-1 text-sm text-stone-300">{error}</p>
        <Link
          to="/"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </Link>
      </div>
    );
  }

  const { draw, participants, exclusions, assignments, logs } = detail;
  const isDraft = draw.status === 'draft';
  const canRun = participants.length >= 3;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-9">
      {/* Toast flotante */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-2xl ring-1 backdrop-blur-md ${
            toast.type === 'ok'
              ? 'bg-emerald-950/95 text-emerald-100 ring-emerald-400/40'
              : 'bg-red-950/95 text-red-100 ring-red-400/40'
          }`}
        >
          {toast.type === 'ok' ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Cabecera del sorteo */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300/90 hover:text-amber-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a mis sorteos
          </Link>
          <h1 className="font-burton mt-1 text-4xl font-bold tracking-wide text-white sm:text-5xl">
            {draw.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-stone-300">
            <span className="rounded-full bg-white/10 px-3 py-1">
              📅 {draw.event_date || 'Fecha sin definir'}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1">
              💰 {draw.budget !== null ? `${draw.budget}${draw.currency}` : 'Presupuesto libre'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold ${
                draw.anti_spoiler
                  ? 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-400/30'
                  : 'bg-white/10 text-stone-300'
              }`}
            >
              {draw.anti_spoiler ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" /> Anti-Spoiler Activo
                </>
              ) : (
                <>
                  <ShieldOff className="h-3.5 w-3.5" /> Parejas Visibles
                </>
              )}
            </span>
          </div>
        </div>

        {/* Botón principal rápido */}
        <div className="flex flex-wrap gap-2">
          {draw.admin_token && (
            <button
              type="button"
              onClick={async () => {
                const adminUrl = `${window.location.origin}/panel/${draw.admin_token}`;
                await navigator.clipboard.writeText(adminUrl).catch(() => {});
                showToast('ok', 'Enlace privado de organizador copiado. Guárdalo para volver.');
              }}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-[#f3e8c8] ring-1 ring-[#e3b25a]/30 transition hover:bg-white/15"
            >
              <Copy className="h-3.5 w-3.5 text-[#e3b25a]" />
              Copiar enlace organizador
            </button>
          )}
          {isDraft ? (
            <button
              type="button"
              disabled={!canRun || runningDraw}
              onClick={handleRunDraw}
              className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-950/60 ring-1 ring-amber-300/30 transition hover:from-red-500 hover:to-red-600 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {runningDraw ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 text-amber-200" />
              )}
              Realizar Sorteo ({participants.length})
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResetDraw}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-stone-200 ring-1 ring-white/15 transition hover:bg-red-600/25 hover:text-red-200"
            >
              <RotateCcw className="h-4 w-4" />
              Reiniciar sorteo
            </button>
          )}
        </div>
      </div>

      {/* Pestañas de navegación */}
      <div className="mt-7 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/25 p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('participants')}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:text-sm ${
            activeTab === 'participants'
              ? 'bg-gradient-to-r from-red-700 to-red-600 text-white shadow'
              : 'text-stone-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>1. Participantes ({participants.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:text-sm ${
            activeTab === 'rules'
              ? 'bg-gradient-to-r from-red-700 to-red-600 text-white shadow'
              : 'text-stone-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Ban className="h-4 w-4" />
          <span>2. Exclusiones ({exclusions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('send')}
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition sm:text-sm ${
            activeTab === 'send'
              ? 'bg-gradient-to-r from-emerald-700 to-green-600 text-white shadow'
              : 'text-stone-300 hover:bg-white/5 hover:text-white'
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          <span>3. Sorteo y WhatsApp</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* PESTAÑA 1: PARTICIPANTES */}
      {/* ==================================================================== */}
      {activeTab === 'participants' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Formulario añadir participante */}
          <div className="lg:col-span-5">
            <div className="burton-card rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">Añadir Participante</h2>
                {isDraft && participants.length === 0 && (
                  <button
                    type="button"
                    disabled={addingP}
                    onClick={handleLoadDemo}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-400/30 hover:bg-amber-500/25"
                  >
                    <Wand2 className="h-3 w-3" /> Cargar 5 de prueba
                  </button>
                )}
              </div>

              {!isDraft && (
                <p className="mt-3 rounded-xl bg-amber-950/60 p-3 text-xs text-amber-200 ring-1 ring-amber-400/30">
                  El sorteo ya se realizó. Puedes editar el teléfono o lista de deseos de los
                  participantes existentes, o reiniciar el sorteo para añadir/quitar personas.
                </p>
              )}

              <form onSubmit={handleAddParticipant} className="mt-4 space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-300">Nombre</label>
                  <input
                    type="text"
                    required
                    disabled={!isDraft}
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="Ej: Laura"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder-stone-500 outline-none focus:border-amber-400/60 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-300">
                    WhatsApp (con prefijo internacional)
                  </label>
                  <input
                    type="tel"
                    required
                    disabled={!isDraft}
                    value={pPhone}
                    onChange={(e) => setPPhone(e.target.value)}
                    placeholder="+34 612 345 678"
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-2.5 text-sm text-white placeholder-stone-500 outline-none focus:border-amber-400/60 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-300">
                    Ideas de regalo / Lista de deseos <span className="text-stone-500">(opcional)</span>
                  </label>
                  <textarea
                    rows={2}
                    disabled={!isDraft}
                    value={pWishlist}
                    onChange={(e) => setPWishlist(e.target.value)}
                    placeholder="Ej: Novelas de fantasía, café de especialidad, talla M..."
                    className="w-full rounded-xl border border-white/15 bg-black/30 px-3.5 py-2 text-sm text-white placeholder-stone-500 outline-none focus:border-amber-400/60 disabled:opacity-50"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!isDraft || addingP}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-950/50 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Plus className="h-4 w-4" />
                  {addingP ? 'Añadiendo...' : 'Añadir a la lista'}
                </button>
              </form>
            </div>
          </div>

          {/* Lista de participantes */}
          <div className="lg:col-span-7">
            <div className="burton-card rounded-2xl p-5 shadow-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-white">
                  Lista de Participantes ({participants.length})
                </h2>
                <span className="text-xs text-stone-400">
                  {participants.length < 3
                    ? `Faltan ${3 - participants.length} más para poder sortear`
                    : '✅ Mínimo cumplido'}
                </span>
              </div>

              {participants.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-stone-400">
                  Añade al menos 3 personas (o pulsa <strong>Cargar 5 de prueba</strong>) para
                  empezar.
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-white/10">
                  {participants.map((p) => {
                    const isEditing = editingPid === p.id;
                    return (
                      <li key={p.id} className="py-3.5 first:pt-1 last:pb-1">
                        {isEditing ? (
                          <div className="space-y-2 rounded-xl bg-black/30 p-3">
                            <p className="text-sm font-bold text-amber-200">{p.name}</p>
                            <input
                              type="tel"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-sm text-white outline-none"
                            />
                            <input
                              type="text"
                              value={editWishlist}
                              onChange={(e) => setEditWishlist(e.target.value)}
                              placeholder="Ideas de regalo..."
                              className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white outline-none"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingPid(null)}
                                className="cursor-pointer rounded-lg px-3 py-1 text-xs text-stone-300 hover:bg-white/10"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveParticipantEdit(p.id)}
                                className="cursor-pointer rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-white">{p.name}</p>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-emerald-300/90">
                                <Phone className="h-3 w-3" /> {p.phone}
                              </p>
                              {p.wishlist && (
                                <p className="mt-1 text-xs text-stone-400">🎁 {p.wishlist}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingPid(p.id);
                                  setEditPhone(p.phone);
                                  setEditWishlist(p.wishlist || '');
                                }}
                                title="Editar teléfono o ideas"
                                className="cursor-pointer rounded-lg p-1.5 text-stone-400 hover:bg-white/10 hover:text-amber-200"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              {isDraft && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteParticipant(p.id, p.name)}
                                  title="Eliminar participante"
                                  className="cursor-pointer rounded-lg p-1.5 text-stone-400 hover:bg-red-500/20 hover:text-red-300"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 2: REGLAS Y EXCLUSIONES */}
      {/* ==================================================================== */}
      {activeTab === 'rules' && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-5">
            {/* Preferencias del sorteo */}
            <div className="burton-card rounded-2xl p-5 shadow-lg space-y-4">
              <h2 className="text-base font-bold text-white">Reglas Generales</h2>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-black/25 p-3.5 ring-1 ring-white/10">
                <input
                  type="checkbox"
                  checked={draw.anti_spoiler}
                  onChange={(e) => handleToggleRule('anti_spoiler', e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-amber-500"
                />
                <div>
                  <span className="text-sm font-semibold text-amber-200">Modo Anti-Spoiler</span>
                  <p className="mt-0.5 text-xs text-stone-400">
                    Oculta en pantalla quién regala a quién. Ideal si tú también participas en el
                    sorteo.
                  </p>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-black/25 p-3.5 ring-1 ring-white/10">
                <input
                  type="checkbox"
                  disabled={!isDraft}
                  checked={draw.avoid_reciprocal}
                  onChange={(e) => handleToggleRule('avoid_reciprocal', e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-amber-500"
                />
                <div>
                  <span className="text-sm font-semibold text-white">
                    Evitar regalos mutuos (A ↔ B)
                  </span>
                  <p className="mt-0.5 text-xs text-stone-400">
                    Impide que dos personas se regalen mutuamente entre ellas.
                  </p>
                </div>
              </label>
            </div>

            {/* Nueva exclusión */}
            <div className="burton-card rounded-2xl p-5 shadow-lg">
              <h2 className="text-base font-bold text-white">Añadir Exclusión</h2>
              <p className="mt-1 text-xs text-stone-400">
                Evita que parejas, hermanos o ganadores del año pasado se regalen entre sí.
              </p>

              <form onSubmit={handleAddExclusion} className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-300">
                    Esta persona...
                  </label>
                  <select
                    required
                    disabled={!isDraft}
                    value={exGiver}
                    onChange={(e) => setExGiver(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-[#141224] px-3 py-2.5 text-sm text-white outline-none disabled:opacity-50"
                  >
                    <option value="">Selecciona participante</option>
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-stone-300">
                    NO puede regalar a...
                  </label>
                  <select
                    required
                    disabled={!isDraft}
                    value={exReceiver}
                    onChange={(e) => setExReceiver(e.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-[#141224] px-3 py-2.5 text-sm text-white outline-none disabled:opacity-50"
                  >
                    <option value="">Selecciona participante</option>
                    {participants
                      .filter((p) => String(p.id) !== exGiver)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>

                <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-300">
                  <input
                    type="checkbox"
                    disabled={!isDraft}
                    checked={exBidirectional}
                    onChange={(e) => setExBidirectional(e.target.checked)}
                    className="h-4 w-4 accent-amber-500"
                  />
                  Hacer mutua (ninguno de los dos puede regalar al otro, ideal para parejas)
                </label>

                <button
                  type="submit"
                  disabled={!isDraft || !exGiver || !exReceiver}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#1a1106] transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Ban className="h-4 w-4" />
                  Guardar exclusión
                </button>
              </form>
            </div>
          </div>

          {/* Lista de exclusiones */}
          <div className="lg:col-span-7">
            <div className="burton-card rounded-2xl p-5 shadow-lg">
              <h2 className="text-base font-bold text-white">
                Exclusiones Activas ({exclusions.length})
              </h2>

              {exclusions.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-stone-400">
                  No hay exclusiones configuradas. Cualquiera puede regalar a cualquiera (excepto a
                  sí mismo).
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {exclusions.map((ex) => (
                    <li
                      key={ex.id}
                      className="flex items-center justify-between rounded-xl bg-black/25 px-4 py-3 text-sm ring-1 ring-white/10"
                    >
                      <span>
                        <strong className="text-white">{ex.giver_name}</strong>{' '}
                        <span className="text-red-400">✕ no regala a</span>{' '}
                        <strong className="text-amber-200">{ex.excluded_receiver_name}</strong>
                      </span>
                      {isDraft && (
                        <button
                          type="button"
                          onClick={() => handleDeleteExclusion(ex.id)}
                          className="cursor-pointer rounded-lg p-1.5 text-stone-400 hover:bg-red-500/20 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PESTAÑA 3: SORTEO Y CENTRO DE ENVÍOS POR WHATSAPP */}
      {/* ==================================================================== */}
      {activeTab === 'send' && (
        <div className="mt-6 space-y-6">
          {isDraft ? (
            <div className="burton-card burton-stripes burton-stitch rounded-3xl p-8 text-center shadow-xl">
              <Gift className="mx-auto h-14 w-14 text-[#e3b25a]" />
              <h2 className="font-burton mt-3 text-4xl font-bold text-[#f7f0e0]">
                ¿Listo para hacer el sorteo?
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm text-stone-300">
                Tienes <strong>{participants.length} participantes</strong> y{' '}
                <strong>{exclusions.length} exclusiones</strong>. Al sortear, cada persona recibirá
                un sobre secreto único listo para enviar por WhatsApp.
              </p>

              <button
                type="button"
                disabled={!canRun || runningDraw}
                onClick={handleRunDraw}
                className="mt-6 inline-flex cursor-pointer items-center gap-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 px-7 py-3.5 text-base font-bold text-white shadow-xl shadow-red-950/60 ring-1 ring-amber-300/40 transition hover:scale-[1.02] hover:from-red-500 hover:to-red-600 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {runningDraw ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Sparkles className="h-5 w-5 text-amber-200" />
                )}
                {canRun
                  ? '🎄 Ejecutar Sorteo Navideño'
                  : `Añade al menos 3 participantes (tienes ${participants.length})`}
              </button>
            </div>
          ) : (
            <>
              {/* Panel de configuración del envío por WhatsApp */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="burton-card rounded-2xl p-5 shadow-lg lg:col-span-7 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-base font-bold text-white">Método de Envío por WhatsApp</h2>
                    {provider === 'baileys' && (
                      <button
                        type="button"
                        onClick={onOpenWhatsAppModal}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-green-600/20 px-3 py-1.5 text-xs font-semibold text-green-300 ring-1 ring-green-500/30 hover:bg-green-600/30"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        {baileys?.state === 'connected' ? 'WhatsApp QR Conectado' : 'Escanear QR'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {[
                      {
                        id: 'wame' as const,
                        title: '🔗 Enlaces wa.me (1 clic)',
                        desc: 'Gratis, sin registros y 0% spoilers. Abre WhatsApp listo para pulsar Enviar.',
                        visible: true,
                      },
                      {
                        id: 'simulator' as const,
                        title: '🧪 Simulador de Prueba',
                        desc: 'Prueba todo sin enviar mensajes reales y revisa el historial abajo.',
                        visible: true,
                      },
                      {
                        id: 'baileys' as const,
                        title: '📱 Automático por QR',
                        desc:
                          baileys?.state === 'connected'
                            ? `Conectado (+${baileys.phoneNumber}). Envío automático con pausa segura.`
                            : 'Escanea QR desde tu móvil (solo en modo local).',
                        visible: baileysSupported,
                      },
                      {
                        id: 'meta_cloud' as const,
                        title: '☁️ Meta Cloud API',
                        desc: metaConfigured
                          ? 'Configurada y lista para envío oficial automático.'
                          : 'API oficial de Meta (opcional, requiere tokens).',
                        visible: metaConfigured || baileysSupported,
                      },
                    ]
                      .filter((opt) => opt.visible)
                      .map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setProvider(opt.id)}
                        className={`cursor-pointer rounded-xl p-3.5 text-left ring-1 transition ${
                          provider === opt.id
                            ? 'bg-emerald-950/90 ring-emerald-400/70 shadow-md'
                            : 'bg-black/25 ring-white/10 hover:bg-white/5'
                        }`}
                      >
                        <p className="text-sm font-bold text-white">{opt.title}</p>
                        <p className="mt-1 text-[11px] leading-snug text-stone-400">{opt.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Contenido del mensaje */}
                  <div className="rounded-xl bg-black/25 p-3.5 ring-1 ring-white/10">
                    <p className="text-xs font-bold uppercase tracking-wider text-stone-300">
                      ¿Qué contendrá el mensaje de WhatsApp?
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-3">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-stone-200">
                        <input
                          type="radio"
                          name="contentMode"
                          checked={contentMode === 'secret_link'}
                          onChange={() => setContentMode('secret_link')}
                          className="accent-amber-500"
                        />
                        🎁 Enlace al sobre secreto (Anti-Spoiler)
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-stone-200">
                        <input
                          type="radio"
                          name="contentMode"
                          checked={contentMode === 'direct_name'}
                          onChange={() => setContentMode('direct_name')}
                          className="accent-amber-500"
                        />
                        ✉️ Nombre del elegido directo en el texto
                      </label>
                    </div>
                  </div>

                  {provider !== 'wame' && (
                    <div className="flex flex-wrap items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={sendingAll}
                        onClick={() => handleSendAll(false)}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-green-950/50 transition hover:from-green-500 hover:to-emerald-500 disabled:opacity-50"
                      >
                        {sendingAll ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {sendingAll ? 'Enviando...' : 'Enviar a todos los pendientes'}
                      </button>

                      <button
                        type="button"
                        disabled={sendingAll}
                        onClick={() => handleSendAll(true)}
                        className="cursor-pointer rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-stone-200 ring-1 ring-white/15 hover:bg-white/15 disabled:opacity-50"
                      >
                        Reenviar a todos
                      </button>
                    </div>
                  )}
                </div>

                {/* Plantilla de mensaje personalizada */}
                <div className="burton-card rounded-2xl p-5 shadow-lg lg:col-span-5">
                  <h2 className="text-base font-bold text-white">Mensaje Personalizado (Opcional)</h2>
                  <p className="mt-1 text-xs text-stone-400">
                    Si lo dejas vacío, se enviará un mensaje navideño automático muy cuidado.
                  </p>

                  <textarea
                    rows={5}
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="🎄 ¡Hola {nombre}! Ya tenemos sorteo de {sorteo}. Presupuesto: {presupuesto}. Abre tu sobre: {enlace}"
                    className="mt-3 w-full rounded-xl border border-white/15 bg-black/30 p-3 text-xs leading-relaxed text-white placeholder-stone-500 outline-none focus:border-amber-400/60"
                  />

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {['{nombre}', '{sorteo}', '{presupuesto}', '{fecha}', '{enlace}', '{amigo}'].map(
                      (tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setCustomMessage((prev) => `${prev}${prev ? ' ' : ''}${tag}`)}
                          className="cursor-pointer rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-mono text-amber-200 hover:bg-white/20"
                        >
                          {tag}
                        </button>
                      )
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={savingMsg}
                    onClick={handleSaveCustomMessage}
                    className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/15 hover:bg-white/20 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savingMsg ? 'Guardando...' : 'Guardar plantilla'}
                  </button>

                  {/* Vista previa realista estilo burbuja de WhatsApp */}
                  <div className="mt-5 rounded-xl border border-emerald-500/20 bg-[#0b141a] p-3.5">
                    <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-emerald-300/90">
                      <span>💬 Vista previa en WhatsApp</span>
                      <span className="text-[10px] font-normal text-stone-400">Sin spoilers</span>
                    </p>
                    <div className="rounded-xl rounded-tl-none bg-[#005c4b] px-3.5 py-2.5 text-xs leading-relaxed text-[#e9edef] shadow whitespace-pre-line">
                      {(() => {
                        const budgetText =
                          draw.budget !== null ? `${draw.budget}${draw.currency}` : 'Libre';
                        const dateText = draw.event_date
                          ? draw.event_date.split('-').reverse().join('/')
                          : 'Por confirmar';
                        const sampleUrl = `${window.location.origin}/revelar/ejemplo-secreto`;
                        if (customMessage.trim()) {
                          return customMessage
                            .trim()
                            .replaceAll('{nombre}', 'Samuel')
                            .replaceAll('{sorteo}', draw.title)
                            .replaceAll('{presupuesto}', budgetText)
                            .replaceAll('{fecha}', dateText)
                            .replaceAll('{enlace}', sampleUrl)
                            .replaceAll(
                              '{amigo}',
                              contentMode === 'direct_name' ? '[Nombre asignado]' : '[En el enlace]'
                            );
                        }
                        if (contentMode === 'direct_name') {
                          return `🎄 *¡Hola Samuel!* 🎅\nYa se ha realizado el sorteo de *${draw.title}*.\n\n🎁 Te ha tocado regalar a: *[Nombre secreto]*\n💰 Presupuesto sugerido: *${budgetText}*\n📅 Fecha del intercambio: *${dateText}*\n\n🤫 ¡Recuerda mantener el secreto hasta Navidad! ✨`;
                        }
                        return `🎄 *¡Hola Samuel!* 🎅\nYa está listo el sorteo de *${draw.title}*.\n\n💰 Presupuesto sugerido: *${budgetText}*\n📅 Fecha del intercambio: *${dateText}*\n\n🎁 Pulsa en tu sobre mágico secreto para descubrir a quién te toca regalar:\n${sampleUrl}\n\n🤫 ¡No compartas este enlace con nadie! ✨`;
                      })()}
                      <div className="mt-1 text-right text-[10px] text-emerald-200/70">
                        18:55 ✓✓
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista de envíos por participante */}
              <div className="burton-card rounded-2xl p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-white">
                      Estado de Participantes ({assignments.length})
                    </h2>
                    <p className="text-xs text-stone-400">
                      {draw.anti_spoiler
                        ? '🛡️ Modo Anti-Spoiler activo: los destinatarios asignados están ocultos.'
                        : '👀 Modo visible: puedes ver a quién regala cada persona.'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-stone-400">
                        <th className="pb-3 pr-4">Participante</th>
                        <th className="pb-3 pr-4">Regala a</th>
                        <th className="pb-3 pr-4">WhatsApp</th>
                        <th className="pb-3 pr-4">Sobre secreto</th>
                        <th className="pb-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {assignments.map((a) => (
                        <tr key={a.id} className="align-middle">
                          <td className="py-3.5 pr-4">
                            <p className="font-semibold text-white">{a.giver_name}</p>
                            <p className="text-xs text-stone-400">{a.giver_phone}</p>
                          </td>

                          <td className="py-3.5 pr-4">
                            {draw.anti_spoiler ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs text-stone-400">
                                <Lock className="h-3 w-3 text-amber-300" /> Secreto
                              </span>
                            ) : (
                              <span className="font-semibold text-amber-200">{a.receiver_name}</span>
                            )}
                          </td>

                          <td className="py-3.5 pr-4">
                            {a.whatsapp_status === 'sent' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/80 px-2.5 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Enviado
                              </span>
                            )}
                            {a.whatsapp_status === 'pending' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-stone-800 px-2.5 py-1 text-xs font-medium text-stone-300">
                                Pendiente
                              </span>
                            )}
                            {a.whatsapp_status === 'failed' && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-950/80 px-2.5 py-1 text-xs font-semibold text-red-300 ring-1 ring-red-500/30">
                                <AlertCircle className="h-3.5 w-3.5" /> Error
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 pr-4">
                            {a.revealed_at ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-200">
                                <Eye className="h-3.5 w-3.5" /> Abierto
                              </span>
                            ) : (
                              <span className="text-xs text-stone-500">Sin abrir</span>
                            )}
                          </td>

                          <td className="py-3.5 text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={sendingAid === a.id}
                                onClick={() => handleSendSingle(a)}
                                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-green-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
                              >
                                {sendingAid === a.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <MessageCircle className="h-3.5 w-3.5" />
                                )}
                                {provider === 'wame'
                                  ? 'Abrir WhatsApp'
                                  : a.whatsapp_status === 'sent'
                                    ? 'Reenviar'
                                    : 'Enviar'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCopyLink(a)}
                                title="Copiar enlace del sobre secreto"
                                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-medium text-stone-200 hover:bg-white/20"
                              >
                                {copiedId === a.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                Enlace
                              </button>

                              <a
                                href={`/revelar/${a.reveal_token}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => {
                                  if (
                                    draw.anti_spoiler &&
                                    !window.confirm(
                                      `¡Atención Anti-Spoiler! Vas a abrir el sobre secreto de ${a.giver_name}. ¿Continuar?`
                                    )
                                  ) {
                                    e.preventDefault();
                                  }
                                }}
                                title="Probar sobre secreto"
                                className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1.5 text-xs text-stone-300 hover:bg-white/15 hover:text-amber-200"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Historial de envíos guardados en MySQL */}
              {logs.length > 0 && (
                <div className="burton-card rounded-2xl p-5 shadow-lg">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-white">
                    <History className="h-4 w-4 text-amber-300" />
                    Historial de Envíos
                  </h2>
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="rounded-xl bg-black/25 px-3.5 py-2.5 text-xs ring-1 ring-white/5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-white">
                            {log.giver_name}{' '}
                            <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] uppercase text-stone-300">
                              {log.provider}
                            </span>
                          </span>
                          <span
                            className={`font-semibold ${
                              log.status === 'failed'
                                ? 'text-red-400'
                                : log.status === 'simulated'
                                  ? 'text-amber-300'
                                  : 'text-emerald-400'
                            }`}
                          >
                            {log.status.toUpperCase()}
                          </span>
                        </div>
                        {log.detail && <p className="mt-1 text-stone-400">{log.detail}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
