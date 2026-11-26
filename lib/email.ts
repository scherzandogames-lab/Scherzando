import 'server-only';
import nodemailer from 'nodemailer';
import { env } from './env';

type Mail = { to: string; subject: string; html: string; text: string; replyTo?: string };
export type MailProvider = 'smtp' | 'resend';
export type MailResult = { ok: boolean; error?: string; provider?: MailProvider; response?: string; messageId?: string; accepted?: string[]; rejected?: string[] };

/**
 * Proveedor que se va a usar. Si las cuatro variables SMTP están completas, se usa SMTP
 * (Gmail) aunque exista RESEND_API_KEY: así una clave de Resend olvidada en Netlify no
 * desvía los correos a un servicio sin dominio verificado. Resend queda sólo como
 * alternativa cuando SMTP no está configurado.
 */
export function mailProvider(): MailProvider | null {
  const s = env.smtp();
  if (s.host && s.user && s.pass) return 'smtp';
  if (env.resendKey()) return 'resend';
  return null;
}

/** Descripción sin secretos, para el panel. */
export function mailInfo() {
  const s = env.smtp();
  return {
    provider: mailProvider(),
    from: !!env.emailFrom(),
    admin: !!env.adminEmail(),
    resendKeyPresent: !!env.resendKey(),
    smtp: { host: s.host || null, port: s.port, user: !!s.user, pass: !!s.pass },
  };
}

/** Oculta parte de la dirección para los registros de Netlify. */
const mask = (to: string) => to.replace(/^(.{2})[^@]*(@.*)$/, '$1***$2');

/**
 * Envía un correo. Nunca lanza excepciones: devuelve { ok, error, provider }.
 * Cada fallo queda además en los registros de funciones de Netlify con la etiqueta [correo].
 * `tag` identifica el correo en esos registros (p. ej. "preorden R-0003 cliente").
 */
export async function sendMail(m: Mail, tag = 'correo'): Promise<MailResult> {
  const provider = mailProvider();
  const r = await send(m, provider);
  if (r.ok) console.log(`[correo] OK ${tag} → ${mask(m.to)} vía ${provider} · respuesta="${r.response ?? ''}" · messageId=${r.messageId ?? ''}`);
  else console.error(`[correo] FALLÓ ${tag} → ${mask(m.to)} vía ${provider ?? 'ninguno'}: ${r.error}`);
  return { ...r, provider: provider ?? undefined };
}

async function send(m: Mail, provider: MailProvider | null): Promise<Omit<MailResult, 'provider'>> {
  const from = env.emailFrom();
  if (!from) return { ok: false, error: 'EMAIL_FROM no configurado' };
  if (!m.to) return { ok: false, error: 'Destinatario vacío' };
  try {
    if (provider === 'smtp') {
      const s = env.smtp();
      // Las contraseñas de aplicación de Gmail se muestran en grupos con espacios; Gmail no los admite.
      const pass = /gmail\.com$/i.test(s.host) ? s.pass.replace(/\s+/g, '') : s.pass;
      const t = nodemailer.createTransport({
        host: s.host,
        port: s.port,
        secure: s.port === 465,
        auth: { user: s.user, pass },
        // Plazos cortos: si Gmail no responde, el error se registra antes de que Netlify corte la función.
        connectionTimeout: 7000,
        greetingTimeout: 7000,
        socketTimeout: 10000,
      });
      const info = await t.sendMail({ from, to: m.to, subject: m.subject, html: m.html, text: m.text, replyTo: m.replyTo });
      const accepted = (info.accepted ?? []).map(String);
      const rejected = (info.rejected ?? []).map(String);
      const base = { response: info.response, messageId: info.messageId, accepted, rejected };
      if (!accepted.length) return { ok: false, error: `SMTP: destinatario rechazado (${info.response})`, ...base };
      return { ok: true, ...base };
    }
    if (provider === 'resend') {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.resendKey()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [m.to], subject: m.subject, html: m.html, text: m.text, reply_to: m.replyTo }),
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) return { ok: false, error: `Resend ${r.status}: ${(await r.text()).slice(0, 300)}` };
      return { ok: true };
    }
    return { ok: false, error: 'No hay proveedor de correo configurado (faltan SMTP_HOST/SMTP_USER/SMTP_PASS)' };
  } catch (e: any) {
    const code = e?.code ? ` [${e.code}]` : '';
    return { ok: false, error: `${provider === 'smtp' ? 'SMTP' : 'Resend'}${code}: ${String(e?.message ?? e)}` };
  }
}

export function esc(s: string | null | undefined) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Plantilla sobria para todos los correos. */
export function layout(title: string, bodyHtml: string) {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#efdad8;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;color:#1d1b18">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#f6f0e3;border:1px solid #e3c3bf" cellspacing="0" cellpadding="0">
<tr><td style="padding:36px 36px 8px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#610b0c">${esc(title)}</td></tr>
<tr><td style="padding:8px 36px 36px;font-size:17px;line-height:1.6">${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

export function button(href: string, label: string) {
  return `<p style="margin:28px 0"><a href="${esc(href)}" style="display:inline-block;background:#610b0c;color:#f3c766;text-decoration:none;padding:14px 26px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:.14em;text-transform:uppercase">${esc(label)}</a></p>`;
}
