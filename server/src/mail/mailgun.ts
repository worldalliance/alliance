export interface MailgunSignature {
  timestamp: string; // seconds since epoch (string)
  token: string;
  signature: string; // hex HMAC-SHA256
}

export interface MailgunEventData {
  event: string; // delivered, opened, clicked, bounced, complained, unsubscribed...
  id: string; // Mailgun event id
  recipient?: string; // email
  message?: { headers?: { "message-id"?: string; subject?: string } };
  "user-variables"?: Record<string, unknown>;
  "delivery-status"?: { message?: string; code?: number; description?: string };
  campaign?: string | null;
  "campaign-id"?: string | null;
  tags?: string[];
  "client-info"?: {
    client_os?: string;
    client_name?: string;
    user_agent?: string;
  };
  geolocation?: { country?: string; region?: string; city?: string };
  url?: string; // for clicks
  ip?: string; // for opens/clicks
  timestamp?: number; // event time (seconds)
}

export interface MailgunWebhookBody {
  signature: MailgunSignature;
  "event-data": MailgunEventData;
}
