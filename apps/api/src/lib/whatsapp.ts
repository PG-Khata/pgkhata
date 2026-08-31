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
const WHATSAPP_TEMPLATES_URL = `https://graph.facebook.com/v21.0/${WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`;

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
 * Check if template management is configured (needs Business Account ID).
 */
export function isTemplateManagementConfigured(): boolean {
  return !!(WHATSAPP_ACCESS_TOKEN && WHATSAPP_BUSINESS_ACCOUNT_ID);
}

/**
 * Create a WhatsApp message template.
 */
export async function createTemplate(template: {
  name: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  language: string;
  components: Array<{
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
    text?: string;
    buttons?: Array<{
      type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!isTemplateManagementConfigured()) {
    return { success: false, error: "WhatsApp Business Account ID not configured" };
  }

  try {
    const response = await fetch(WHATSAPP_TEMPLATES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: template.name,
        category: template.category,
        language: template.language,
        components: template.components,
      }),
    });

    const data = (await response.json()) as {
      id?: string;
      error?: { message?: string };
    };

    if (!response.ok) {
      return { success: false, error: data.error?.message || `HTTP ${response.status}` };
    }

    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * List all WhatsApp message templates.
 */
export async function listTemplates(): Promise<{
  success: boolean;
  templates?: Array<{ id: string; name: string; status: string; category: string }>;
  error?: string;
}> {
  if (!isTemplateManagementConfigured()) {
    return { success: false, error: "WhatsApp Business Account ID not configured" };
  }

  try {
    const response = await fetch(WHATSAPP_TEMPLATES_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    const data = (await response.json()) as {
      data?: Array<{ id: string; name: string; status: string; category: string }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      return { success: false, error: data.error?.message || `HTTP ${response.status}` };
    }

    return { success: true, templates: data.data || [] };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Delete a WhatsApp message template.
 */
export async function deleteTemplate(
  templateName: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isTemplateManagementConfigured()) {
    return { success: false, error: "WhatsApp Business Account ID not configured" };
  }

  try {
    const response = await fetch(
      `${WHATSAPP_TEMPLATES_URL}?name=${templateName}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
      },
    );

    if (!response.ok) {
      const data = (await response.json()) as { error?: { message?: string } };
      return { success: false, error: data.error?.message || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Create all PGKhata WhatsApp templates.
 * Call this once to set up the templates in your Meta Business account.
 */
export async function setupPGKhataTemplates(): Promise<{
  success: boolean;
  results: Array<{ name: string; success: boolean; error?: string }>;
}> {
  const templates = [
    {
      name: "monthly_bill_ready",
      category: "UTILITY" as const,
      language: "en",
      components: [
        {
          type: "HEADER" as const,
          format: "TEXT" as const,
          text: "PGKhata Monthly Bill",
        },
        {
          type: "BODY" as const,
          text: "Hi {{1}}, your {{2}} bill for {{3}} Room {{4}} is ready.\n\nRent: ₹{{5}}\nElectricity: ₹{{6}}\nOther charges: ₹{{7}}\n\nTotal due: ₹{{8}}\n\nDue by {{9}}. Pay by UPI to {{10}}.\n\nSave this message as your bill receipt.",
        },
        {
          type: "FOOTER" as const,
          text: "Powered by PGKhata",
        },
      ],
    },
    {
      name: "payment_reminder",
      category: "UTILITY" as const,
      language: "en",
      components: [
        {
          type: "BODY" as const,
          text: "Hi {{1}},\n\nYour rent for {{2}} at {{3}} Room {{4}} is ₹{{5}}.\n\nDue: {{6}}.\n\nPlease make sure to pay on or before the due date to avoid any inconvenience.",
        },
        {
          type: "FOOTER" as const,
          text: "Powered by PGKhata",
        },
      ],
    },
    {
      name: "rent_due_reminder",
      category: "UTILITY" as const,
      language: "en",
      components: [
        {
          type: "BODY" as const,
          text: "Hi {{1}},\n\nYour rent for {{2}} Room {{3}} is ₹{{4}}.\n\nDue: {{5}}.\n\nPlease pay on time to avoid late fees.",
        },
        {
          type: "FOOTER" as const,
          text: "Powered by PGKhata",
        },
      ],
    },
  ];

  const results = [];
  for (const template of templates) {
    const result = await createTemplate(template);
    results.push({
      name: template.name,
      success: result.success,
      error: result.error,
    });
  }

  return {
    success: results.every((r) => r.success),
    results,
  };
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
          { type: "text", text: `${params.propertyName} Room ${params.roomNumber}` },
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
    templateName: "rent_payment_reminder",
    languageCode: "en",
    components: [
      {
        type: "body",
        parameters: [
          { type: "text", text: params.tenantName },
          { type: "text", text: params.billMonth },
          { type: "text", text: `${params.propertyName} Room ${params.roomNumber}` },
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
