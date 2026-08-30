import { escapeHtml } from "./format";

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export function passwordResetEmail(url: string): string {
  return `
    <div style="font-family: ${FONT_STACK}; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">Reset your password</h2>
      <p style="font-size: 14px; color: #52525b; margin: 0 0 24px;">
        Click the button below to set a new password for your PGKhata account.
      </p>
      <a href="${escapeHtml(url)}" style="display: inline-block; background: #18181b; color: #fafafa; padding: 8px 20px; border-radius: 6px; font-size: 14px; font-weight: 500; text-decoration: none;">
        Reset password
      </a>
      <p style="font-size: 12px; color: #a1a1aa; margin: 24px 0 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  `;
}

export function billReminderEmail({
  tenantName,
  propertyName,
  month,
  totalAmount,
  balance,
}: {
  tenantName: string;
  propertyName: string;
  month: string;
  totalAmount: string;
  balance: string;
}): string {
  return `
    <div style="font-family: ${FONT_STACK}; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">Payment reminder</h2>
      <p style="font-size: 14px; color: #52525b; margin: 0 0 16px;">
        Hi ${escapeHtml(tenantName)}, this is a reminder for your pending rent payment at <strong>${escapeHtml(propertyName)}</strong> for ${escapeHtml(month)}.
      </p>
      <table style="width: 100%; font-size: 14px; border-collapse: collapse; margin: 0 0 16px;">
        <tr>
          <td style="padding: 8px 0; color: #71717a;">Total billed</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 500;">${escapeHtml(totalAmount)}</td>
        </tr>
        <tr style="border-top: 1px solid #e4e4e7;">
          <td style="padding: 8px 0; color: #71717a;">Balance due</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #dc2626;">${escapeHtml(balance)}</td>
        </tr>
      </table>
      <p style="font-size: 14px; color: #52525b; margin: 0;">
        Please contact your property owner to make the payment.
      </p>
    </div>
  `;
}
