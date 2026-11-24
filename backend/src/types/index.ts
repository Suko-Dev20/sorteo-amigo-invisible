export type DrawStatus = 'draft' | 'drawn' | 'sent';
export type WhatsAppStatus = 'pending' | 'sent' | 'failed';
export type WhatsAppProviderType = 'simulator' | 'wame' | 'baileys' | 'meta_cloud';
export type MessageContentMode = 'secret_link' | 'direct_name';

export interface Draw {
  id: number;
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
  giver_name?: string;
  excluded_receiver_name?: string;
}

export interface AssignmentPublicView {
  id: number;
  draw_id: number;
  giver_id: number;
  giver_name: string;
  giver_phone: string;
  // Solo se incluye cuando anti_spoiler === false
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
  giver_name?: string;
  provider: string;
  status: 'sent' | 'failed' | 'simulated';
  message_preview: string | null;
  detail: string | null;
  created_at: string;
}
