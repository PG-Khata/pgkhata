/**
 * WhatsApp Business API integration for PGKhata.
 *
 * Uses the Meta Cloud API (graph.facebook.com) to send template messages.
 * Requires: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID
 *
 * Free tier: 1,000 conversations/month (user-initiated), then pay-per-conversation.
 * Template messages (business-initiated) are charged per conversation.
 */

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

const WHATSAPP_API_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

export interface WhatsAppMessage {
  to: string; // Phone number with country code (e.g., "919876543210")
  templateName: string;
  languageCode?: string;
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: "header" | "body" | "button";
  sub_type?: string;
  parameters: Array<{
    type: "text" | "currency" | "date_time" | "image" | "document";
    text?: string;
    currency?: {
      fallback_value: string;
      code: string;
      amount_1000: number;
    };
    date_time?: {
      fallback_value: string;
    };
    image?: {
      link: string;
    };
    document?: {
      link: string;
      filename: string;
    };
  }>;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Check if WhatsApp is configured.
 */
export function isWhatsAppConfigured(): boolean {
  return !!(WHATSAPP_ACCESS_TOKEN && WHATSAPP_PHONE_NUMBER_ID);
}

/**
 * Send a WhatsApp template message.
 */
export async function sendWhatsAppMessage(message: WhatsAppMessage): Promise<SendResult> {
  if (!isWhatsAppConfigured()) {
    return { success: false, error: "WhatsApp not configured" };
  }

  try {
    const response = await fetch(WHATSAPP_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: message.to,
        type: "template",
        template: {
          name: message.templateName,
          language: {
            code: message.languageCode || "en",
          },
          components: message.components || [],
        },
      }),
    });

    const data = (await response.json()) as {
      error?: { message?: string };
      messages?: Array<{ id?: string }>;
    };

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Send a bill notification via WhatsApp.
 */
export async function sendBillNotification(params: {
  phone: string;
  tenantName: string;
  propertyName: string;
  roomNumber: string;
  billMonth: string;
  rentAmount: number;
  electricityAmount: number;
  otherCharges: number;
  totalAmount: number;
  dueDate: string;
  upiId?: string;
}): Promise<SendResult> {
  return sendWhatsAppMessage({
    to: `91${params.phone}`,
    templateName: "monthly_bill_ready",
    languageCode: "en",
    components: [
      {
        type: "header",
        parameters: [],
      },
      {
        type: "body",
        parameters: [
          { type: "text", text: params.tenantName },
          { type: "text", text: params.billMonth },
          { type: "text", text: params.propertyName },
          { type: "text", text: params.roomNumber },
          { type: "text", text: String(params.rentAmount) },
          { type: "text", text: String(params.electricityAmount) },
          { type: "text", text: String(params.otherCharges) },
          { type: "text", text: String(params.totalAmount) },
          { type: "text", text: params.dueDate },
          { type: "text", text: params.upiId || "N/A" },
        ],
      },
    ],
  });
}

/**
 * Send a payment reminder via WhatsApp.
 */
export async function sendPaymentReminder(params: {
  phone: string;
  tenantName: string;
  propertyName: string;
  roomNumber: string;
  billMonth: string;
  amount: number;
  dueDate: string;
}): Promise<SendResult> {
  return sendWhatsAppMessage({
    to: `91${params.phone}`,
    templateName: "payment_reminder",
    languageCode: "en",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.tenantName },
          { type: "text", text: params.billMonth },
          { type: "text", text: params.propertyName },
          { type: "text", text: params.roomNumber },
          { type: "text", text: String(params.amount) },
          { type: "text", text: params.dueDate },
        ],
      },
    ],
  });
}

/**
 * Send a rent due reminder via WhatsApp.
 */
export async function sendRentDueReminder(params: {
  phone: string;
  tenantName: string;
  propertyName: string;
  roomNumber: string;
  amount: number;
  dueDate: string;
}): Promise<SendResult> {
  return sendWhatsAppMessage({
    to: `91${params.phone}`,
    templateName: "rent_due_reminder",
    languageCode: "en",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.tenantName },
          { type: "text", text: params.propertyName },
          { type: "text", text: params.roomNumber },
          { type: "text", text: String(params.amount) },
          { type: "text", text: params.dueDate },
        ],
      },
    ],
  });
}
