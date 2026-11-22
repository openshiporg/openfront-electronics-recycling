import { createTransport } from 'nodemailer'
import { getSettings, siteBase, smtpConfig } from './services'
import type { Ctx } from './core'

// Password reset email. Mail settings are the same as notification email:
// SMTP_* env vars, else the SMTP fields on Settings. Buyers and clients reset on the
// storefront (/reset-password); staff reset on the dashboard (/dashboard/reset).

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

export function passwordResetUrl(base: string, kind: string | null | undefined, token: string, email: string) {
  const root = base.replace(/\/$/, '')
  const query = `token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
  return kind === 'staff' ? `${root}/dashboard/reset?${query}` : `${root}/reset-password?${query}`
}

function passwordResetHtml({ url, businessName, name }: { url: string; businessName: string; name: string }) {
  return `
    <body style="background:#f9f9f9;margin:0;padding:24px;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#ffffff;max-width:560px;margin:auto;border-radius:8px;font-family:Helvetica,Arial,sans-serif;color:#333333;">
        <tr><td style="padding:28px 28px 8px;font-size:18px;font-weight:bold;">${escapeHtml(businessName)}</td></tr>
        <tr><td style="padding:8px 28px;font-size:15px;line-height:22px;">${name ? `Hello ${escapeHtml(name)},<br><br>` : ''}Someone asked to reset the password for this account. Use the button below to choose a new one.</td></tr>
        <tr><td style="padding:16px 28px;"><a href="${url}" target="_blank" style="display:inline-block;background:#1f2937;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:15px;font-weight:bold;">Choose a new password</a></td></tr>
        <tr><td style="padding:8px 28px 28px;font-size:13px;line-height:20px;color:#666666;">The link works once and expires soon. If you did not ask for this, ignore this email; your password stays the same.</td></tr>
      </table>
    </body>`
}

export async function sendPasswordResetEmail({ token, identity, context }: { token: string; identity: string; context: Ctx }): Promise<void> {
  const prisma = context.sudo().prisma
  const settings = await getSettings(prisma)
  const smtp = smtpConfig(settings)
  if (!smtp) {
    // No mail server yet: the request still succeeds (no account enumeration); staff can
    // reset the person's password from Team, and Settings shows that email is not set up.
    console.warn('[email] Password reset requested but no mail server is set up in Settings or SMTP_*.')
    return
  }
  const user = await prisma.user.findUnique({ where: { email: identity }, select: { kind: true, name: true, email: true } })
  if (!user) return
  const base = await siteBase(prisma)
  if (!base) {
    // No saved site address and no signed-in request seen yet: a link built from this
    // unauthenticated request's Host header could point anywhere, so send nothing.
    console.warn('[email] Password reset not sent: set the public site address in Settings.')
    return
  }
  const url = passwordResetUrl(base, user.kind, token, user.email)
  const businessName = settings.businessName || 'Account'
  const transport = createTransport({ host: smtp.host, port: smtp.port, secure: smtp.port === 465, auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined })
  await transport.sendMail({
    from: smtp.from ? `${businessName} <${smtp.from}>` : undefined,
    to: user.email,
    subject: `Reset your ${businessName} password`,
    text: `Someone asked to reset the password for this account. Choose a new one here:\n\n${url}\n\nIf you did not ask for this, ignore this email.\n\n${businessName}`,
    html: passwordResetHtml({ url, businessName, name: user.name || '' }),
  })
}
