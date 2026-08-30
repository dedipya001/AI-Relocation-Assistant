import { config } from "../core/config.js";
import { logger } from "../core/logger.js";

export interface EmailPayload {
  to?: string;
  subject: string;
  body: string;
  replyTo?: string;
  metadata?: Record<string, any>;
}

export class EmailService {
  private targetAdminEmail: string;

  constructor() {
    this.targetAdminEmail = config.CONTACT_EMAIL || "thikanakhojo@gmail.com";
  }

  /**
   * Dispatch or log an administrative alert for user feedback or inquiries
   */
  async notifyAdmin(payload: EmailPayload): Promise<{ success: boolean; messageId: string }> {
    const to = payload.to || this.targetAdminEmail;
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    logger.info(
      {
        messageId,
        to,
        subject: payload.subject,
        replyTo: payload.replyTo,
        metadata: payload.metadata,
      },
      `[EmailService: ${config.SITE_NAME}] Notification queued for ${to}`
    );

    // Production SMTP / Nodemailer / Resend dispatch hook
    return {
      success: true,
      messageId,
    };
  }

  /**
   * Format and queue an alert when a user submits negotiated rent feedback
   */
  async sendNegotiatedRentAlert(data: {
    property_id?: string | null;
    listed_rent: number;
    negotiated_rent: number;
    locality?: string | null;
    notes?: string | null;
  }): Promise<void> {
    const listed = data.listed_rent || 15000;
    const savings = listed - data.negotiated_rent;
    const pct = listed > 0 ? Math.round((savings / listed) * 100) : 0;

    await this.notifyAdmin({
      subject: `[${config.SITE_NAME}] New Negotiated Rent Reported in ${data.locality || "Kolkata"} (Saved ₹${savings}/mo - ${pct}%)`,
      body: `A user reported an accepted negotiated rent for Property ID ${data.property_id || "General Locality"}:
- Listed Rent: ₹${listed.toLocaleString("en-IN")}/mo
- Negotiated Rent: ₹${data.negotiated_rent.toLocaleString("en-IN")}/mo
- Monthly Savings: ₹${savings.toLocaleString("en-IN")}/mo (${pct}%)
- Locality: ${data.locality || "Unknown"}
- User Notes: ${data.notes || "None"}`,
      metadata: data,
    });
  }

  /**
   * Format and queue an alert when a user submits locality review feedback
   */
  async sendLocalityFeedbackAlert(data: {
    locality_id: string;
    score: number;
    category?: string | null;
    comment?: string | null;
  }): Promise<void> {
    await this.notifyAdmin({
      subject: `[${config.SITE_NAME}] Community Locality Feedback: ${data.locality_id} (Score: ${data.score}/100)`,
      body: `Community feedback received:
- Locality: ${data.locality_id}
- Rating Score: ${data.score}/100
- Category: ${data.category || "General"}
- Comment: ${data.comment || "N/A"}`,
      metadata: data,
    });
  }
}

export const emailService = new EmailService();
