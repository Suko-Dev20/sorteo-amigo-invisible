import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, LogOut, QrCode, Smartphone, X } from 'lucide-react';
import { api } from '../api/client';
import type { BaileysStatus } from '../types';

interface WhatsAppQrModalProps {
  open: boolean;
  onClose: () => void;
  baileys: BaileysStatus | null;
  onStatusChange: (status: BaileysStatus) => void;
}

export function WhatsAppQrModal({
  open,
  onClose,
  baileys,
  onStatusChange,
}: WhatsAppQrModalProps) {
  const [busy, setBusy] = useState(false);
  const [testFeedback, setTestFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;

    const poll = async () => {
      try {
        const res = await api.getWhatsAppStatus();
        if (active) onStatusChange(res.baileys);
      } catch {
        // Silenciar errores transitorios de polling
      }
    };

    poll();
    const timer = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [open, onStatusChange]);

  if (!open) return null;

  const handleConnect = async () => {
    setBusy(true);
    setTestFeedback(null);
    try {
      const res = await api.connectBaileys();
      onStatusChange(res.baileys);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    setTestFeedback(null);
    try {
      const res = await api.logoutBaileys();
      onStatusChange(res.baileys);
    } finally {
      setBusy(false);
    }
  };

  const handleSendTest = async () => {
    setBusy(true);
    setTestFeedback(null);
    try {
      const res = await api.sendBaileysTest();
      setTestFeedback(`✅ Mensaje de prueba enviado a +${res.phone}`);
    } catch (err: unknown) {
      setTestFeedback(`❌ ${err instanceof Error ? err.message : 'Error enviando prueba'}`);
    } finally {
      setBusy(false);
    }
  };

  const state = baileys?.state || 'disconnected';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="burton-card w-full max-w-md overflow-hidden rounded-2xl shadow-2xl">
        <div className="burton-ribbon h-1.5 w-full opacity-80" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#7fd1b9]/35 bg-[#152925] text-[#7fd1b9]">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-burton text-xl text-[#f7f0e0]">
                  WhatsApp Automático (QR Local)
                </h2>
                <p className="text-xs text-[#a99ec0]">
                  Envía los resultados automáticamente desde tu PC sin pagar APIs
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

        <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-5 text-center">
          {state === 'connected' && (
            <div className="space-y-3">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-400" />
              <div>
                <p className="font-semibold text-green-300">¡WhatsApp conectado correctamente!</p>
                {baileys?.phoneNumber && (
                  <p className="mt-1 text-sm text-stone-300">
                    Número vinculado: <strong>+{baileys.phoneNumber}</strong>
                  </p>
                )}
              </div>
              {testFeedback && (
                <p className="rounded-lg bg-black/30 px-3 py-2 text-xs text-stone-200 ring-1 ring-white/10">
                  {testFeedback}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSendTest}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : '🎄'}
                  Enviarme mensaje de prueba
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleLogout}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-red-600/20 px-4 py-2 text-sm font-semibold text-red-300 ring-1 ring-red-500/30 transition hover:bg-red-600/30 disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  Desvincular
                </button>
              </div>
            </div>
          )}

          {state === 'qr' && baileys?.qrDataUrl && (
            <div className="space-y-3">
              <div className="mx-auto inline-block rounded-2xl bg-white p-3 shadow-lg">
                <img
                  src={baileys.qrDataUrl}
                  alt="Código QR de WhatsApp"
                  className="h-56 w-56"
                />
              </div>
              <div className="text-left text-xs text-stone-300 space-y-1">
                <p className="font-semibold text-amber-200 flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4" /> Cómo vincularlo:
                </p>
                <p>1. Abre WhatsApp en tu móvil.</p>
                <p>2. Entra en <strong>Ajustes → Dispositivos vinculados</strong>.</p>
                <p>3. Pulsa <strong>Vincular un dispositivo</strong> y escanea este QR.</p>
              </div>
            </div>
          )}

          {state === 'connecting' && (
            <div className="py-8 space-y-3">
              <Loader2 className="mx-auto h-10 w-10 animate-spin text-amber-300" />
              <p className="text-sm text-stone-300">Generando código QR de WhatsApp Web...</p>
            </div>
          )}

          {state === 'disconnected' && (
            <div className="space-y-4 py-3">
              <p className="text-sm text-stone-300">
                Conecta tu WhatsApp para enviar los mensajes automáticamente en segundo plano
                (con pausa segura entre destinatarios).
              </p>
              {baileys?.lastError && (
                <p className="rounded-lg bg-amber-950/60 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-500/30">
                  {baileys.lastError}
                </p>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={handleConnect}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-900/40 transition hover:bg-green-500 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Generar código QR
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-[#a99ec0]">
          💡 <strong>Consejo Anti-Spoiler:</strong> Si tú también participas en el sorteo, envía
          el <em>Enlace secreto mágico</em> en lugar del nombre directo para no ver a quién le tocó
          cada persona al abrir tus chats enviados.
        </p>
        </div>
      </div>
    </div>
  );
}
