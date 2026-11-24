import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import type { MessageContentMode, WhatsAppProviderType } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, '../../whatsapp-auth');

export interface MessageContext {
  giverName: string;
  receiverName: string;
  receiverWishlist?: string | null;
  drawTitle: string;
  eventDate?: string | null;
  budget?: number | null;
  currency?: string;
  revealUrl: string;
  customTemplate?: string | null;
  contentMode: MessageContentMode;
}

export interface SendMessageResult {
  ok: boolean;
  provider: WhatsAppProviderType;
  status: 'sent' | 'failed' | 'simulated';
  messagePreview: string;
  detail: string;
  wameUrl?: string;
}

export interface BaileysStatus {
  state: 'disconnected' | 'connecting' | 'qr' | 'connected';
  qrDataUrl: string | null;
  phoneNumber: string | null;
  lastError: string | null;
}

/**
 * Limpia un número de teléfono dejando únicamente los dígitos internacionales (ej: +34 612 345 678 -> 34612345678).
 */
export function normalizePhoneDigits(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  return digits;
}

/**
 * Construye un enlace wa.me listo para abrir WhatsApp Web o la App móvil.
 */
export function buildWaMeUrl(phone: string, text: string): string {
  const digits = normalizePhoneDigits(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Formatea una fecha YYYY-MM-DD a formato legible en español.
 */
function formatDateEs(dateStr?: string | null): string {
  if (!dateStr) return 'Por confirmar';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

/**
 * Genera el texto del mensaje navideño respetando el modo de contenido (enlace secreto o nombre directo).
 */
export function buildSecretSantaMessage(ctx: MessageContext): string {
  const budgetText =
    ctx.budget !== null && ctx.budget !== undefined
      ? `${Number(ctx.budget).toFixed(2).replace(/\.00$/, '')}${ctx.currency || '€'}`
      : 'Libre';
  const dateText = formatDateEs(ctx.eventDate);
  const wishlistText = ctx.receiverWishlist?.trim()
    ? `💡 Ideas de regalo: ${ctx.receiverWishlist.trim()}`
    : '';

  if (ctx.customTemplate && ctx.customTemplate.trim().length > 0) {
    let msg = ctx.customTemplate.trim();
    msg = msg
      .replaceAll('{nombre}', ctx.giverName)
      .replaceAll('{sorteo}', ctx.drawTitle)
      .replaceAll('{presupuesto}', budgetText)
      .replaceAll('{fecha}', dateText)
      .replaceAll('{enlace}', ctx.revealUrl);

    if (ctx.contentMode === 'direct_name') {
      msg = msg
        .replaceAll('{amigo}', ctx.receiverName)
        .replaceAll('{deseos}', wishlistText);
    } else {
      msg = msg.replaceAll('{amigo}', '[Descúbrelo en el enlace]').replaceAll('{deseos}', '');
      if (!msg.includes(ctx.revealUrl)) {
        msg += `\n\n🎁 Abre tu sobre secreto aquí:\n${ctx.revealUrl}`;
      }
    }
    return msg.trim();
  }

  if (ctx.contentMode === 'direct_name') {
    const lines = [
      `🎄 *¡Hola ${ctx.giverName}!* 🎅`,
      `Ya se ha realizado el sorteo de *${ctx.drawTitle}*.`,
      ``,
      `🎁 Te ha tocado regalar a: *${ctx.receiverName}*`,
      wishlistText,
      `💰 Presupuesto sugerido: *${budgetText}*`,
      `📅 Fecha del intercambio: *${dateText}*`,
      ``,
      `🤫 ¡Recuerda mantener el secreto hasta Navidad! ✨`,
    ].filter((line) => line !== '' || true);

    return lines.filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
  }

  return [
    `🎄 *¡Hola ${ctx.giverName}!* 🎅`,
    `Ya está listo el sorteo de *${ctx.drawTitle}*.`,
    ``,
    `💰 Presupuesto sugerido: *${budgetText}*`,
    `📅 Fecha del intercambio: *${dateText}*`,
    ``,
    `🎁 Pulsa en tu sobre mágico secreto para descubrir a quién te toca regalar:`,
    ctx.revealUrl,
    ``,
    `🤫 ¡No compartas este enlace con nadie! ✨`,
  ].join('\n');
}

// ============================================================================
// Gestión de sesión WhatsApp Web vía Baileys (QR gratuito en local)
// ============================================================================
class BaileysManager {
  private sock: WASocket | null = null;
  private status: BaileysStatus = {
    state: 'disconnected',
    qrDataUrl: null,
    phoneNumber: null,
    lastError: null,
  };
  private connectingPromise: Promise<void> | null = null;

  getStatus(): BaileysStatus {
    return { ...this.status };
  }

  async connect(): Promise<BaileysStatus> {
    if (this.status.state === 'connected' && this.sock) {
      return this.getStatus();
    }
    if (this.connectingPromise) {
      return this.getStatus();
    }

    this.status = {
      state: 'connecting',
      qrDataUrl: null,
      phoneNumber: null,
      lastError: null,
    };

    this.connectingPromise = this.initSocket().finally(() => {
      this.connectingPromise = null;
    });

    await this.connectingPromise;
    return this.getStatus();
  }

  private async initSocket(): Promise<void> {
    try {
      await fs.mkdir(AUTH_DIR, { recursive: true });
      const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
      const { version } = await fetchLatestBaileysVersion();

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['Amigo Invisible Navidad', 'Chrome', '1.0.0'],
      });

      this.sock = sock;

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          try {
            const dataUrl = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
            this.status = {
              state: 'qr',
              qrDataUrl: dataUrl,
              phoneNumber: null,
              lastError: null,
            };
          } catch (e) {
            this.status.lastError = 'No se pudo generar la imagen del código QR.';
          }
        }

        if (connection === 'open') {
          const rawId = sock.user?.id || '';
          const cleanPhone = rawId.split(':')[0]?.split('@')[0] || null;
          this.status = {
            state: 'connected',
            qrDataUrl: null,
            phoneNumber: cleanPhone,
            lastError: null,
          };
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output
            ?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;

          this.sock = null;
          if (loggedOut) {
            await fs.rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {});
            this.status = {
              state: 'disconnected',
              qrDataUrl: null,
              phoneNumber: null,
              lastError: 'Sesión cerrada desde el teléfono. Escanea un nuevo QR para reconectar.',
            };
          } else if (statusCode === DisconnectReason.restartRequired) {
            this.status = {
              state: 'connecting',
              qrDataUrl: null,
              phoneNumber: null,
              lastError: null,
            };
            void this.initSocket();
          } else {
            this.status = {
              state: 'disconnected',
              qrDataUrl: null,
              phoneNumber: null,
              lastError: 'Conexión con WhatsApp cerrada. Puedes volver a conectar cuando quieras.',
            };
          }
        }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.status = {
        state: 'disconnected',
        qrDataUrl: null,
        phoneNumber: null,
        lastError: `Error iniciando WhatsApp QR: ${msg}`,
      };
    }
  }

  async logout(): Promise<BaileysStatus> {
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock.end(undefined);
        this.sock = null;
      }
    } finally {
      await fs.rm(AUTH_DIR, { recursive: true, force: true }).catch(() => {});
      this.status = {
        state: 'disconnected',
        qrDataUrl: null,
        phoneNumber: null,
        lastError: null,
      };
    }
    return this.getStatus();
  }

  async sendText(phone: string, text: string): Promise<{ ok: boolean; detail: string }> {
    if (!this.sock || this.status.state !== 'connected') {
      return {
        ok: false,
        detail: 'WhatsApp QR no está conectado. Escanea el código QR primero desde el panel.',
      };
    }

    const digits = normalizePhoneDigits(phone);
    if (digits.length < 7) {
      return { ok: false, detail: `Número de teléfono inválido: ${phone}` };
    }

    try {
      const lookup = await this.sock.onWhatsApp(digits);
      const targetJid = lookup?.[0]?.jid || `${digits}@s.whatsapp.net`;
      if (lookup && lookup.length > 0 && !lookup[0].exists) {
        return {
          ok: false,
          detail: `El número ${phone} no parece estar registrado en WhatsApp.`,
        };
      }

      await this.sock.sendMessage(targetJid, { text });
      return { ok: true, detail: `Enviado automáticamente vía WhatsApp QR a ${targetJid}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, detail: `Error enviando vía Baileys: ${msg}` };
    }
  }
}

export const baileysManager = new BaileysManager();

// ============================================================================
// Envío mediante Meta WhatsApp Cloud API (Oficial)
// ============================================================================
async function sendViaMetaCloud(phone: string, text: string): Promise<{ ok: boolean; detail: string }> {
  const token = process.env.META_WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID?.trim();
  const version = process.env.META_API_VERSION?.trim() || 'v21.0';

  if (!token || !phoneNumberId) {
    return {
      ok: false,
      detail:
        'Faltan META_WHATSAPP_TOKEN o META_PHONE_NUMBER_ID en backend/.env para usar la API oficial de Meta.',
    };
  }

  const digits = normalizePhoneDigits(phone);
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: digits,
        type: 'text',
        text: { body: text, preview_url: true },
      }),
    });

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return {
        ok: false,
        detail: `Meta API (${response.status}): ${data.error?.message || 'Error desconocido'}`,
      };
    }

    const msgId = data.messages?.[0]?.id || 'ok';
    return { ok: true, detail: `Enviado vía Meta Cloud API (ID: ${msgId})` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: `Error de red con Meta Cloud API: ${msg}` };
  }
}

export function getMetaCloudConfigStatus() {
  return {
    configured: Boolean(
      process.env.META_WHATSAPP_TOKEN?.trim() && process.env.META_PHONE_NUMBER_ID?.trim()
    ),
  };
}

/**
 * Punto de entrada unificado para enviar una notificación con el proveedor elegido.
 */
export async function sendSecretSantaNotification(
  provider: WhatsAppProviderType,
  phone: string,
  ctx: MessageContext,
  hidePreviewInLogs = false
): Promise<SendMessageResult> {
  const text = buildSecretSantaMessage(ctx);
  const preview = hidePreviewInLogs
    ? `[Modo Anti-Spoiler activo] Mensaje preparado para ${ctx.giverName} (${ctx.contentMode})`
    : text;

  if (provider === 'simulator') {
    return {
      ok: true,
      provider,
      status: 'simulated',
      messagePreview: preview,
      detail: `Simulación local exitosa para ${phone}. No se envió ningún WhatsApp real.`,
    };
  }

  if (provider === 'wame') {
    const wameUrl = buildWaMeUrl(phone, text);
    return {
      ok: true,
      provider,
      status: 'sent',
      messagePreview: preview,
      detail: 'Enlace wa.me generado correctamente para envío manual en 1 clic.',
      wameUrl,
    };
  }

  if (provider === 'baileys') {
    const res = await baileysManager.sendText(phone, text);
    return {
      ok: res.ok,
      provider,
      status: res.ok ? 'sent' : 'failed',
      messagePreview: preview,
      detail: res.detail,
    };
  }

  if (provider === 'meta_cloud') {
    const res = await sendViaMetaCloud(phone, text);
    return {
      ok: res.ok,
      provider,
      status: res.ok ? 'sent' : 'failed',
      messagePreview: preview,
      detail: res.detail,
    };
  }

  return {
    ok: false,
    provider,
    status: 'failed',
    messagePreview: preview,
    detail: `Proveedor de WhatsApp no soportado: ${provider}`,
  };
}
