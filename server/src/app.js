import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { env, isProd } from './config/env.js';
import { asyncHandler } from './utils/http.js';
import { errorHandler, notFound } from './middleware/error.js';
import { paymentsAvailable } from './services/razorpay.js';
import authRoutes from './routes/auth.js';
import departmentRoutes from './routes/departments.js';
import queueRoutes from './routes/queue.js';
import notificationRoutes from './routes/notifications.js';
import bookingRoutes from './routes/bookings.js';
import paymentRoutes, { webhookHandler } from './routes/payments.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', env.TRUST_PROXY);

  // The built React app uses inline event handlers and Razorpay Checkout (script + iframe), so the
  // CSP is written for exactly those origins.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'", 'https://checkout.razorpay.com'],
          'script-src-attr': ["'unsafe-inline'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
          'img-src': ["'self'", 'data:', 'https://*.razorpay.com'],
          'connect-src': ["'self'", 'https://*.razorpay.com'],
          'frame-src': ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
          'media-src': ["'self'", 'blob:'],
          'object-src': ["'none'"],
          'base-uri': ["'self'"],
        },
      },
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // bank 3-D Secure popups
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors({ origin: env.CLIENT_ORIGINS }));

  // Webhook first, with the RAW body (signature is computed over the exact bytes).
  app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '1mb' }), webhookHandler);

  app.use(express.json({ limit: '50kb' }));
  if (!isProd) app.use(morgan('dev'));
  app.use('/api', rateLimit({ windowMs: 60 * 1000, limit: 600, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests.' } }));

  app.get('/api/health', (req, res) =>
    res.json({ ok: true, database: mongoose.connection.readyState === 1, paymentMode: env.PAYMENT_MODE, paymentGateway: paymentsAvailable() })
  );
  app.use('/api/auth', authRoutes);
  app.use('/api/departments', departmentRoutes);
  app.use('/api/queue', queueRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', notFound);

  // Production: serve the built frontend (npm run build -> ../dist) from the same origin.
  const dist = path.resolve(__dirname, '../../dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
