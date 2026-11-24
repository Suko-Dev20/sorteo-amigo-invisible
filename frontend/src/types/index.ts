export type DrawStatus = 'draft' | 'drawn' | 'sent';
export type WhatsAppStatus = 'pending' | 'sent' | 'failed';
export type WhatsAppProviderType = 'simulator' | 'wame' | 'baileys' | 'meta_cloud';
export type MessageContentMode = 'secret_link' | 'direct_name';

export interface Draw {
  id: number;
  admin_token?: string;
  title: string;
  event_date: string | null;
  budget: number | null;
  currency: string;
  custom_message: string | null;
  avoid_reciprocal: boolean;
  anti_spoiler: boolean;
  status: DrawStatus;
  created_at: string;
  updated_at: string;
  participant_count?: number;
  sent_count?: number;
  revealed_count?: number;
}

export interface Participant {
  id: number;
  draw_id: number;
  name: string;
  phone: string;
  wishlist: string | null;
  created_at: string;
}

export interface Exclusion {
  id: number;
  draw_id: number;
  giver_id: number;
  excluded_receiver_id: number;
  giver_name: string;
  excluded_receiver_name: string;
}

export interface AssignmentPublicView {
  id: number;
  draw_id: number;
  giver_id: number;
  giver_name: string;
  giver_phone: string;
  receiver_name?: string;
  reveal_token: string;
  reveal_url: string;
  wame_url: string;
  whatsapp_status: WhatsAppStatus;
  sent_at: string | null;
  revealed_at: string | null;
}

export interface NotificationLog {
  id: number;
  assignment_id: number;
  giver_name: string;
  provider: string;
  status: 'sent' | 'failed' | 'simulated';
  message_preview: string | null;
  detail: string | null;
  created_at: string;
}

export interface DrawDetailResponse {
  draw: Draw;
  participants: Participant[];
  exclusions: Exclusion[];
  assignments: AssignmentPublicView[];
  logs: NotificationLog[];
}

export interface HealthResponse {
  ok: boolean;
  service: string;
  mode?: string;
  database: {
    connected: boolean;
    host: string;
    port: number;
    name: string;
    error: string | null;
  };
}

export interface BaileysStatus {
  state: 'disconnected' | 'connecting' | 'qr' | 'connected';
  qrDataUrl: string | null;
  phoneNumber: string | null;
  lastError: string | null;
}

export interface WhatsAppStatusResponse {
  defaultProvider: WhatsAppProviderType;
  baileysSupported?: boolean;
  baileys: BaileysStatus;
  metaCloud: {
    configured: boolean;
  };
}

export interface RevealData {
  drawTitle: string;
  eventDate: string | null;
  budget: number | null;
  currency: string;
  giverName: string;
  receiverName: string;
  receiverWishlist: string | null;
  alreadyRevealed: boolean;
  revealedAt: string | null;
}
