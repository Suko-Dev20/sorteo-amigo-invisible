import type {
  BaileysStatus,
  Draw,
  DrawDetailResponse,
  HealthResponse,
  MessageContentMode,
  Participant,
  RevealData,
  WhatsAppProviderType,
  WhatsAppStatusResponse,
} from '../types';

const STORAGE_KEY = 'amigo_invisible_admin_tokens_v1';

export function getSavedDrawTokens(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveDrawToken(token?: string | null) {
  if (!token) return;
  try {
    const current = getSavedDrawTokens();
    if (!current.includes(token)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([token, ...current].slice(0, 30)));
    }
  } catch {
    // Silenciar errores de localStorage en modo privado
  }
}

export function removeDrawToken(token?: string | null) {
  if (!token) return;
  try {
    const next = getSavedDrawTokens().filter((t) => t !== token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Silenciar errores de localStorage
  }
}

export type DrawKey = string | number;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  getHealth: () => request<HealthResponse>('/api/health'),

  // Sorteos (en Cloudflare solo lista los sorteos cuyos admin_token están guardados en este navegador)
  listDraws: () => {
    const tokens = getSavedDrawTokens();
    const qs = tokens.length > 0 ? `?tokens=${encodeURIComponent(tokens.join(','))}` : '';
    return request<{ draws: Draw[] }>(`/api/draws${qs}`);
  },
  createDraw: (payload: {
    title: string;
    event_date?: string | null;
    budget?: number | string | null;
    currency?: string;
    custom_message?: string | null;
    avoid_reciprocal?: boolean;
    anti_spoiler?: boolean;
  }) =>
    request<{ draw: Draw }>('/api/draws', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getDrawDetail: (key: DrawKey) => {
    const origin = encodeURIComponent(window.location.origin);
    return request<DrawDetailResponse>(
      `/api/draws/${encodeURIComponent(String(key))}?publicBaseUrl=${origin}`
    );
  },
  updateDraw: (key: DrawKey, payload: Partial<Draw>) =>
    request<{ draw: Draw }>(`/api/draws/${encodeURIComponent(String(key))}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteDraw: (key: DrawKey) =>
    request<{ ok: boolean }>(`/api/draws/${encodeURIComponent(String(key))}`, {
      method: 'DELETE',
    }),

  // Participantes
  addParticipant: (
    drawKey: DrawKey,
    payload: { name: string; phone: string; wishlist?: string | null }
  ) =>
    request<{ participant: Participant }>(
      `/api/draws/${encodeURIComponent(String(drawKey))}/participants`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    ),
  updateParticipant: (
    drawKey: DrawKey,
    participantId: number,
    payload: { name?: string; phone?: string; wishlist?: string | null }
  ) =>
    request<{ participant: Participant }>(
      `/api/draws/${encodeURIComponent(String(drawKey))}/participants/${participantId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    ),
  deleteParticipant: (drawKey: DrawKey, participantId: number) =>
    request<{ ok: boolean }>(
      `/api/draws/${encodeURIComponent(String(drawKey))}/participants/${participantId}`,
      { method: 'DELETE' }
    ),

  // Exclusiones
  addExclusion: (
    drawKey: DrawKey,
    payload: { giver_id: number; excluded_receiver_id: number; bidirectional?: boolean }
  ) =>
    request<{ ok: boolean }>(`/api/draws/${encodeURIComponent(String(drawKey))}/exclusions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteExclusion: (drawKey: DrawKey, exclusionId: number) =>
    request<{ ok: boolean }>(
      `/api/draws/${encodeURIComponent(String(drawKey))}/exclusions/${exclusionId}`,
      { method: 'DELETE' }
    ),

  // Motor de sorteo
  runDraw: (drawKey: DrawKey) =>
    request<{ ok: boolean; count: number }>(
      `/api/draws/${encodeURIComponent(String(drawKey))}/run`,
      { method: 'POST' }
    ),
  resetDraw: (drawKey: DrawKey) =>
    request<{ ok: boolean }>(`/api/draws/${encodeURIComponent(String(drawKey))}/reset`, {
      method: 'POST',
    }),

  // Envíos WhatsApp
  sendAll: (
    drawKey: DrawKey,
    payload: {
      provider: WhatsAppProviderType;
      contentMode: MessageContentMode;
      forceResend?: boolean;
    }
  ) =>
    request<{
      ok: boolean;
      sent: number;
      failed: number;
      message?: string;
      results?: Array<{ giverName: string; ok: boolean; detail: string }>;
    }>(`/api/draws/${encodeURIComponent(String(drawKey))}/send`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, publicBaseUrl: window.location.origin }),
    }),
  sendSingle: (
    drawKey: DrawKey,
    assignmentId: number,
    payload: {
      provider: WhatsAppProviderType;
      contentMode: MessageContentMode;
    }
  ) =>
    request<{
      ok: boolean;
      result: {
        ok: boolean;
        status: string;
        detail: string;
        wameUrl?: string;
      };
    }>(`/api/draws/${encodeURIComponent(String(drawKey))}/assignments/${assignmentId}/send`, {
      method: 'POST',
      body: JSON.stringify({ ...payload, publicBaseUrl: window.location.origin }),
    }),

  // Estado WhatsApp QR / Meta
  getWhatsAppStatus: () => request<WhatsAppStatusResponse>('/api/whatsapp/status'),
  connectBaileys: () =>
    request<{ baileys: BaileysStatus }>('/api/whatsapp/baileys/connect', { method: 'POST' }),
  logoutBaileys: () =>
    request<{ baileys: BaileysStatus }>('/api/whatsapp/baileys/logout', { method: 'POST' }),
  sendBaileysTest: (phone?: string) =>
    request<{ ok: boolean; phone: string; detail: string }>('/api/whatsapp/baileys/test', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  // Revelado público
  getReveal: (token: string) => request<RevealData>(`/api/reveal/${token}`),
  markRevealed: (token: string) =>
    request<{ ok: boolean }>(`/api/reveal/${token}/open`, { method: 'POST' }),
};
