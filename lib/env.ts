// Lectura centralizada de variables de entorno (solo servidor).
import 'server-only';

const v = (k: string) => (process.env[k] ?? '').trim();

export const env = {
  siteUrl: () => v('SITE_URL').replace(/\/$/, '') || 'http://localhost:3000',
  supabaseUrl: () => v('SUPABASE_URL'),
  supabaseKey: () => v('SUPABASE_SECRET_KEY'),
  adminPassword: () => v('ADMIN_PASSWORD'),
  sessionSecret: () => v('SESSION_SECRET'),
  adminEmail: () => v('ADMIN_EMAIL'),
  resendKey: () => v('RESEND_API_KEY'),
  smtp: () => ({ host: v('SMTP_HOST'), port: Number(v('SMTP_PORT') || 465), user: v('SMTP_USER'), pass: v('SMTP_PASS') }),
  emailFrom: () => v('EMAIL_FROM'),
  micorreo: () => ({
    user: v('MICORREO_USER'),
    password: v('MICORREO_PASSWORD'),
    customerId: v('MICORREO_CUSTOMER_ID'),
    prod: v('MICORREO_ENV').toLowerCase() === 'prod',
  }),
};
