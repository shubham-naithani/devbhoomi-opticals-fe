export interface MarketingLogEntry {
  code: string;
  templateCode?: string;
  recipientType: 'lead' | 'customer' | 'referral';
  recipientName: string;
  recipientPhone: string;
  recipientEmail?: string;
  sentAt: string;
  whatsappStatus: 'queued' | 'sent' | 'failed';
  redeemed: boolean;
}
