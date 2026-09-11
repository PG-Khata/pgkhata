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

export function emailVerificationOtpEmail(otp: string): string {
  return `
    <div style="font-family: ${FONT_STACK}; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">Verify your email</h2>
      <p style="font-size: 14px; color: #52525b; margin: 0 0 20px;">
        Enter this one-time code to verify your PGKhata account. It expires in 5 minutes.
      </p>
      <div style="font-size: 28px; font-weight: 700; letter-spacing: 8px; padding: 16px; background: #f4f4f5; border-radius: 8px; text-align: center;">
        ${escapeHtml(otp)}
      </div>
      <p style="font-size: 12px; color: #a1a1aa; margin: 20px 0 0;">
        If you did not request this code, you can ignore this email.
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

export function billReadyEmail({ tenantName, propertyName, roomNumber, month, rentAmount, electricityAmount, otherCharges, totalAmount, balance, dueDate, invoiceUrl }: {
  tenantName: string; propertyName: string; roomNumber: string; month: string; rentAmount: string; electricityAmount: string; otherCharges: string; totalAmount: string; balance: string; dueDate: string; invoiceUrl: string;
}): string {
  const row = (label: string, amount: string, strong = false) => `<tr><td style="padding:10px 0;color:#334155;${strong ? "font-weight:600" : ""}">${escapeHtml(label)}</td><td style="padding:10px 0;text-align:right;color:#0f172a;${strong ? "font-weight:700" : ""}">${escapeHtml(amount)}</td></tr>`;
  return `<div style="font-family:${FONT_STACK};max-width:620px;margin:0 auto;padding:28px;background:#f8fafc">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:28px">
      <h2 style="font-size:20px;color:#0f172a;margin:0 0 8px">Your bill is ready</h2>
      <p style="font-size:15px;color:#64748b;margin:0 0 26px">${escapeHtml(propertyName)} · Room ${escapeHtml(roomNumber)} · ${escapeHtml(month)}</p>
      <p style="font-size:16px;color:#0f172a;margin:0 0 24px">Hi ${escapeHtml(tenantName)},</p>
      <p style="font-size:16px;color:#334155;margin:0 0 18px">Here are your ${escapeHtml(month)} charges.</p>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;font-size:15px">${row("Rent", rentAmount)}${row("Electricity", electricityAmount)}${otherCharges !== "₹0" ? row("Other charges", otherCharges) : ""}${row("Total", totalAmount, true)}${row("Balance due", balance, true)}${row("Due date", dueDate)}</table>
      <a href="${escapeHtml(invoiceUrl)}" style="display:inline-block;margin-top:22px;background:#065f46;color:#fff;padding:10px 16px;border-radius:7px;font-size:14px;font-weight:600;text-decoration:none">View bill</a>
    </div>
  </div>`;
}

/**
 * Sent only when PGKhata support is granted *write* access to an owner's
 * account — never on a read-only support session. Read-only visits are
 * deliberately silent: owners are usually the ones who asked for help, and an
 * email every time trains them to ignore the channel, which destroys the signal
 * for the case that actually matters. Changes to their data always notify.
 */
export function supportWriteAccessEmail({
  ownerName,
  adminName,
  reason,
  grantedAt,
  expiresAt,
}: {
  ownerName: string;
  adminName: string;
  reason: string;
  grantedAt: Date;
  expiresAt: Date;
}): string {
  const time = (d: Date) =>
    d.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });

  return `
    <div style="font-family: ${FONT_STACK}; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 8px;">Support access to your account</h2>
      <p style="font-size: 14px; color: #52525b; margin: 0 0 20px;">
        Hi ${escapeHtml(ownerName)}, a PGKhata support team member was granted permission to make
        changes to your account.
      </p>
      <div style="background: #fef3c7; border-radius: 8px; padding: 16px; margin: 0 0 20px;">
        <p style="font-size: 13px; color: #713f12; margin: 0 0 8px;">
          <strong>Who:</strong> ${escapeHtml(adminName)}
        </p>
        <p style="font-size: 13px; color: #713f12; margin: 0 0 8px;">
          <strong>When:</strong> ${escapeHtml(time(grantedAt))} &ndash; ${escapeHtml(time(expiresAt))} IST
        </p>
        <p style="font-size: 13px; color: #713f12; margin: 0;">
          <strong>Reason given:</strong> ${escapeHtml(reason)}
        </p>
      </div>
      <p style="font-size: 14px; color: #52525b; margin: 0 0 20px;">
        Access ends automatically at the time above. You can see every support visit to your
        account, past and present, under Settings in your PGKhata dashboard.
      </p>
      <p style="font-size: 12px; color: #a1a1aa; margin: 0;">
        If you did not ask for help and this looks wrong, reply to this email straight away.
      </p>
    </div>
  `;
}
