import { Router } from 'express';
import { z } from 'zod';
import { Payment } from '../models/Payment.js';
import { HttpError, asyncHandler } from '../utils/http.js';
import { validate } from '../middleware/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import { todayKey, fmtTime } from '../utils/time.js';
import { issueCounterToken, refundPayment } from '../services/booking.js';
import { checkInToken, setTokenStatus, markEmergency, overviewStats } from '../services/staff.js';

const router = Router();
router.use(requireAdmin);

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const tokenCode = z.string().trim().toUpperCase().regex(/^[A-Z]{2,3}-\d{3,5}$/, 'Enter a token like GM-048');
const dayQuery = z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

// Counter (offline) parcha: staff collect the fee, then issue the token
router.post(
  '/counter-bookings',
  validate(z.object({ departmentId: objectId, mode: z.enum(['Cash', 'UPI', 'Card']).default('Cash') })),
  asyncHandler(async (req, res) => {
    res.status(201).json(await issueCounterToken({ departmentId: req.body.departmentId, mode: req.body.mode, admin: req.admin }));
  })
);

// Fee collections (online + counter) for a day
router.get(
  '/payments',
  validate(dayQuery, 'query'),
  asyncHandler(async (req, res) => {
    const rows = await Payment.find({ day: req.query.day || todayKey(), status: { $in: ['paid', 'refunded'] } })
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    res.json(
      rows.map((p) => ({
        id: String(p._id),
        receipt: p.receipt,
        token: p.token || '–',
        department: p.departmentName,
        method: p.method,
        amount: p.amount,
        source: p.source,
        status: p.status,
        receivedBy: p.receivedBy || null,
        time: fmtTime(p.paidAt || p.createdAt),
      }))
    );
  })
);

router.post(
  '/payments/:id/refund',
  validate(z.object({ id: objectId }), 'params'),
  validate(z.object({ reason: z.string().trim().max(200).optional() })),
  asyncHandler(async (req, res) => res.json(await refundPayment(req.params.id, { reason: req.body.reason })))
);

router.get('/stats', validate(dayQuery, 'query'), asyncHandler(async (req, res) => res.json(await overviewStats(req.query.day))));

// QR scan / manual check-in
router.post('/queue/checkin', validate(z.object({ token: tokenCode })), asyncHandler(async (req, res) => res.json(await checkInToken(req.body.token))));

router.patch(
  '/queue/:token/status',
  validate(z.object({ token: tokenCode }), 'params'),
  validate(z.object({ status: z.enum(['Waiting', 'Consultation', 'Completed', 'Cancelled']) })),
  asyncHandler(async (req, res) => res.json(await setTokenStatus(req.params.token, req.body.status)))
);

// Emergency priority: pass an existing token, or a department to open a new emergency token
router.post(
  '/emergency',
  validate(
    z
      .object({ token: tokenCode.optional(), departmentId: objectId.optional() })
      .refine((b) => b.token || b.departmentId, { message: 'Choose a department or enter a token number' })
  ),
  asyncHandler(async (req, res) => {
    if (!req.body.token && !req.body.departmentId) throw new HttpError(400, 'Choose a department or enter a token number');
    res.status(201).json(await markEmergency(req.body));
  })
);

export default router;
