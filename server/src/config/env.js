import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));
const list = (v, d) => (v || d).split(',').map((s) => s.trim()).filter(Boolean);

const NODE_ENV = process.env.NODE_ENV || 'development';
const wantsDemo = (process.env.PAYMENT_MODE || '').trim().toLowerCase() === 'demo';

export const env = Object.freeze({
  NODE_ENV,
  PORT: num(process.env.PORT, 5000),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smartcare',
  CLIENT_ORIGINS: list(process.env.CLIENT_ORIGIN, 'http://localhost:5173'),
  TRUST_PROXY: num(process.env.TRUST_PROXY, 0),

  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  ADMIN_USERNAME: (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
  ADMIN_NAME: process.env.ADMIN_NAME || 'Hospital Admin',

  // 'demo' = practice payment window, no gateway account needed, no real money. Ignored in production.
  PAYMENT_MODE: wantsDemo && NODE_ENV !== 'production' ? 'demo' : 'razorpay',
  RAZORPAY_KEY_ID: (process.env.RAZORPAY_KEY_ID || '').trim(),
  RAZORPAY_KEY_SECRET: (process.env.RAZORPAY_KEY_SECRET || '').trim(),
  RAZORPAY_WEBHOOK_SECRET: (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim(),

  TIMEZONE: 'Asia/Kolkata',
  RESERVATION_MINUTES: num(process.env.RESERVATION_MINUTES, 10),
  AVG_CONSULT_MIN: num(process.env.AVG_CONSULT_MIN, 6),
  ONLINE_SHARE: Math.min(1, Math.max(0, num(process.env.ONLINE_SHARE, 0.7))),
  AUTO_SEED: process.env.AUTO_SEED !== 'false',
});

export const isProd = env.NODE_ENV === 'production';

if (wantsDemo && isProd) {
  console.warn('PAYMENT_MODE=demo is ignored in production. Using Razorpay.');
}

if (env.JWT_SECRET.length < 16 || (isProd && env.JWT_SECRET.startsWith('change-me'))) {
  console.error('FATAL: set JWT_SECRET in server/.env to a long random string (16+ characters).');
  process.exit(1);
}
