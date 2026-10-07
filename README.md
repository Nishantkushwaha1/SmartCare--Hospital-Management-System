# SmartCare (React + Node.js + Express + MongoDB + Razorpay)

OPD token and queue management. The React/Vite UI talks to an Express API backed by MongoDB.
Online token fees are paid through **Razorpay** (UPI, cards, net banking).

```
smartcare_react/
├─ src/, index.html, vite.config.js   React/Vite shell
├─ public/legacy/                     the SmartCare UI (api.js = API client, script.js = screens, chatbot.js, qr.js)
└─ server/                            Express + Mongoose API
   └─ src/{config,models,services,routes,middleware}
```

## Quick start

Needs Node 18.18+ and a MongoDB (local, Docker or Atlas).

```bash
npm run setup                      # installs the web app and the server
docker compose up -d               # optional: local MongoDB   (or use an Atlas URI)
cp server/.env.example server/.env # then edit it (see below)
npm run dev:all                    # web: http://localhost:5173   api: http://localhost:5000
```

On first start the server creates the 15 default departments and one staff account from
`ADMIN_USERNAME` / `ADMIN_PASSWORD` in `server/.env`. Staff screens (Admin, Counter Booking, Departments,
OPD Status, Analytics, Emergency, Scan QR) ask for that login. Reset the password later with
`npm run seed -- --reset-admin` after changing `ADMIN_PASSWORD`.

### `server/.env`

| Variable | Notes |
|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/smartcare` or your Atlas `mongodb+srv://...` |
| `JWT_SECRET` | 16+ random characters (server refuses to start otherwise) |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | first staff account (password 8+ chars) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | from the Razorpay dashboard. **Use `rzp_test_...` keys while developing** |
| `RAZORPAY_WEBHOOK_SECRET` | secret you choose when creating the webhook (below) |
| `RESERVATION_MINUTES` | how long a token is held while the patient pays (default 10) |

## Demo payment mode (no Razorpay account needed)

Set this in `server/.env` and restart the server:

```
PAYMENT_MODE=demo
```

Paid departments then open a **practice payment window** (choose UPI / Card / Net Banking, then *Pay*,
*Simulate failed payment* or *Cancel*). No real money is charged and Razorpay is never contacted, so the
Razorpay keys can stay empty. Booking, token, receipt, queue, notifications, counter booking, refunds and
reports all work as usual. Demo mode is **ignored when `NODE_ENV=production`**; remove the line (or set
`PAYMENT_MODE=razorpay`) and add real keys to switch to Razorpay. The demo window skips the signature and
webhook checks, so test those with Razorpay test keys before going live.

## Payments (Razorpay)

1. Create a free Razorpay account and copy the **Test Mode** key id and secret into `server/.env`.
2. Restart the server. Booking a department with a fee now opens Razorpay Checkout.
   In test mode use Razorpay's test UPI id `success@razorpay`, or test card `4111 1111 1111 1111`
   (any future expiry, any CVV, OTP `1234` if asked). No real money moves.
3. **Webhook (recommended, required in production).** It issues the token even if the patient's
   browser closes right after paying. Dashboard → Settings → Webhooks → URL
   `https://<your-domain>/api/payments/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`, events
   `payment.captured`, `order.paid`, `payment.failed`. For local testing expose port 5000 with a tunnel (ngrok / cloudflared).
4. Going live: swap in `rzp_live_...` keys and complete Razorpay KYC.

How a paid booking works:

1. `POST /api/bookings/online` reserves one of the department's online tokens, creates a Razorpay order
   (amount comes from the department fee on the server, never from the browser) and returns the order.
2. The browser opens Checkout. Card/bank details go to Razorpay only.
3. `POST /api/payments/verify` checks the HMAC signature, re-fetches the payment from Razorpay, checks the
   amount and order, then issues the token. The webhook does the same job; both are idempotent
   (unique indexes) so a token is never issued twice.
4. Closing Checkout releases the reserved token (`/payments/cancel`); unpaid reservations also expire after
   `RESERVATION_MINUTES`. If money arrives after a reservation expired, a slot is taken again, or the payment is
   refunded automatically when the day's tokens are gone.

## Production

```bash
npm run build           # builds the React app into dist/
npm run server:start    # the API also serves dist/ (same origin, no CORS needed)
```
Set `NODE_ENV=production`, a strong `JWT_SECRET`, `TRUST_PROXY=1` behind nginx/Render/Railway, and use HTTPS.

## API

Public
| Method | Path | |
|---|---|---|
| GET | `/api/health` | status of API, DB, payment mode (`demo` / `razorpay`) |
| GET | `/api/departments` | departments with fee, room, tokens left (online/counter), now serving, waiting |
| GET | `/api/queue?department=<id>` | today's live queue (token, room, department, status, time; **no personal data**) |
| GET | `/api/queue/token/:token` | one token: position, estimated time, room, receipt summary |
| GET | `/api/notifications?token=GM-048` | broadcasts + messages for that token |
| POST | `/api/bookings/online` | `{name, age, phone, departmentId}` → free: ticket · paid: Razorpay order |
| POST | `/api/payments/verify` | `{orderId, paymentId, signature}` → ticket |
| POST | `/api/payments/cancel` | `{orderId}` release reservation |
| GET | `/api/payments/status/:orderId` | has the webhook issued the token yet |
| POST | `/api/payments/webhook` | Razorpay → server (signature-checked, raw body) |
| POST | `/api/auth/login` | `{username, password}` → JWT |

Staff (`Authorization: Bearer <jwt>`)
| Method | Path | |
|---|---|---|
| GET | `/api/auth/me` | |
| POST / PUT / DELETE | `/api/departments[/:id]` | add / edit (name, room, daily tokens, fee) / remove |
| PATCH | `/api/departments/:id/status` | OPD `Available` / `Busy` / `Unavailable` (notifies patients) |
| POST | `/api/admin/counter-bookings` | `{departmentId, mode: Cash\|UPI\|Card}` issue a counter (offline) parcha |
| GET | `/api/admin/payments?day=YYYY-MM-DD` | fee collections |
| POST | `/api/admin/payments/:id/refund` | Razorpay refund (or manual record for counter payments) + cancels the token |
| GET | `/api/admin/stats` | overview + analytics numbers |
| POST | `/api/admin/queue/checkin` | `{token}` call a patient (QR scan) |
| PATCH | `/api/admin/queue/:token/status` | Waiting / Consultation / Completed / Cancelled |
| POST | `/api/admin/emergency` | `{token}` or `{departmentId}` (new emergency token, bypasses quota) |

## Behaviour worth knowing

- **70/30 quota** is enforced atomically in MongoDB, so two patients can never take the last online token.
  Token numbers (`GM-001`…) are per department per day and reset at midnight IST.
- Patient name/age/phone are stored but never returned by any public endpoint.
- No MongoDB transactions are used, so a standalone `mongod` works (no replica set needed).
- The chatbot now sends booking requests to the booking page (it can no longer mint a token on its own).
- The UI refreshes queue screens every 10 seconds; new notifications appear as toasts.
- Not included: SMS/WhatsApp delivery of notifications (the phone number is collected for that).




# SmartCare – Hospital Management System

SmartCare is a hospital management system built using React/Vite, Node.js, Express.js and MongoDB.

## Technologies

* Frontend: React / Vite
* Backend: Node.js + Express.js
* Database: MongoDB
* Authentication: JWT
* Payment: Demo Mode

## Requirements

Install these before running the project:

* Node.js
* MongoDB
* VS Code (recommended)

## 1. Extract the ZIP

Extract the project ZIP anywhere on your computer.

Open the extracted `smartcare_react` folder in VS Code.

## 2. Install Dependencies

Open the VS Code terminal and run:

```bash
npm run setup
```

This installs both frontend and backend dependencies.

## 3. Create Environment File

Create a file named:

```text
.env
```

in the project root.

Copy the settings from `.env.example` into `.env`.

Example:

```env
NODE_ENV=development
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
TRUST_PROXY=0

MONGODB_URI=mongodb://127.0.0.1:27017/smartcare

JWT_SECRET=change-this-to-a-long-random-secret
JWT_EXPIRES_IN=8h

ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeMe@123
ADMIN_NAME=Staff

PAYMENT_MODE=demo

RESERVATION_MINUTES=10
AVG_CONSULT_MIN=6
ONLINE_SHARE=0.7
AUTO_SEED=true
```

## 4. Make Sure MongoDB Is Running

On Windows, make sure the MongoDB service is running.

You can check it using PowerShell:

```powershell
Get-Service MongoDB
```

It should show:

```text
Status: Running
```

## 5. Create/Reset Staff Login

From the project root:

```bash
npm run seed -- --reset-admin
```

This creates/resets the staff account using the username and password from `.env`.

## 6. Start the Project

Run:

```bash
npm run dev:all
```

This starts both:

* Frontend: http://localhost:5173
* Backend: http://localhost:5000

## 7. Open the Website

Open:

```text
http://localhost:5173
```

## Staff Login

```text
Username: admin
Password: ChangeMe@123
```

## Important

Do not share the `.env` file publicly because it may contain passwords, JWT secrets or API keys.

For sharing the project, include `.env.example` instead.

## If the project does not start

First make sure MongoDB is running.

Then run:

```bash
npm run setup
```

and:

```bash
npm run seed -- --reset-admin
```

Finally:

```bash
npm run dev:all
```
