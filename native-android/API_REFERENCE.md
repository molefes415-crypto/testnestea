# Trade Nest EA — Full API Reference (Native App)

Two backends:

- **Portal** — `https://tradenestea.com/` (license keys, EAs/robots, mentors, signals, emails/subscription status). PHP endpoints under `/admin/api/`.
- **App cloud** — `https://www.tradnestea.app/` (AI chart scanner + PayPal payments). Routes under `/api/public/`.
- **Trading** — `https://mt5.mtapi.io` / `https://mt4.mtapi.io` (MetaTrader connect + order execution).

---

## 1. Portal — License keys & EA data

### POST/GET `/admin/api/validate_license.php`
**What it's for:** the single most important call — activates a license key, binds the device, and returns everything about the EA the key belongs to (name, logo/robot image, allowed symbols, mentor branding, expiry) plus grouped signals.

Params (query or JSON body): `key` (license key), `device_id` (unique per install), `_` (cache-buster timestamp).

Response fields:
`success`, `status` (`valid` | `expired` | `invalid`), `message`, `expires_at`,
`symbols[]` (allowed trading symbols), `bot{name,image,logo,ea_logo,robot_logo,robot_image,symbols[]}`,
`ea_name`/`robot_name`, `ea_logo`/`robot_logo`/`robot_image`,
`mentor{display_name,full_name,profile_pic,logo,avatar,image}`,
`signals{ SYMBOL: [TradeSignal,...] }`.

Notes: call it on activation **and** on every app resume/refresh so new logos, renamed EAs, and removed symbols sync. Append `_=<millis>` and cache-bust image URLs. Treat past `expires_at` as expired even if the server says valid.

### GET `/admin/api/check_status.php?email=<email>`
**What it's for:** email-based account/EA status lookup (is this email registered/active on the portal).
Returns `StatusResponse` — `success`, status/activation flags, message.

### POST `/admin/api/check_subscription.php`
**What it's for:** checks whether an email is an activated subscriber under a mentor.
Body: `{ "email": "...", "mentor_id": "..." }` → `{ success, activated, message }`.

### GET `/admin/api/subscription_status.php` and `/admin/api/check-subscription.php`
Alternate spellings of the same subscription check; used as fallbacks (`admin_id`, `email` query params).

### GET `/admin/api/payfast_itn.php`
Legacy PayFast payment notification endpoint (superseded by PayPal — informational only).

---

## 2. Portal — Signals

### GET `/admin/api/signals.php?action=get&key=<key>&limit=8`
**What it's for:** polls the mentor's live trade signals for that license key. Poll every ~30s while the robot runs.
Response: `{ success, count, signals }` where `signals` is either a flat array or a map keyed by symbol.

`TradeSignal`: `symbol`, `direction` (BUY/SELL), `entry`, `sl`, `tp`, `lot`, `comment`, `id`, `created_at`.

### POST `/admin/api/signals.php?action=read`
**What it's for:** marks signals as consumed so they aren't executed twice.
Body: `{ "key": "...", "ids": ["1","2"] }`.

Execution rules: only act while the bot is started, only on allowed `symbols[]` (broker suffix variants like `XAUUSD.m` allowed), and place exactly the configured number of trades with SL/TP when present.

---

## 3. App cloud — AI Chart Scanner

Auth header on every call: `x-api-key: tnea_33837a5f9367c6cfe2a4f4a9f42b2de30acde3c9`

### POST `/api/public/analyze-chart`
**What it's for:** main scanner — send a base64 chart screenshot (or symbol only) and get a full trade setup back. See `api/ScannerApi.kt` for `AnalyzeRequest`/`AnalyzeResponse`.
Key request fields: `imageBase64`, `symbol`, `strategy` (`all|smc|ict|crt|wyckoff|priceaction|math`), `tradeStyle`, `session`, `timeframe`, `orderType`, `trailStop`, `confidenceThreshold`, `licenseKey`.
Key response fields: `direction`, `confidence`, `entry`, `sl`, `tp`, `takeProfit[]`, `riskReward`, `lotSize`, `reason`, `analysis`, `keyLevels`, `annotations`, `voiceSummary`. Failures return HTTP 200 with `error`.

### POST `/api/public/ai-vision`
**What it's for:** raw AI vision proxy (model + prompt + image) used by the web/PHP scanner page. Same `x-api-key`. Use `analyze-chart` in the app unless you need raw model output.

---

## 4. App cloud — PayPal payments ($35 one-time)

### POST `/api/public/paypal?action=create`
**What it's for:** creates a real PayPal order and returns the approval URL to open. Body: `{ user_ref, email }` → `{ order_id, approval_url }`.

### POST `/api/public/paypal?action=capture`
**What it's for:** captures + server-verifies the order (status, amount, currency), idempotently marks it **paid**. Body: `{ order_id }`.

### GET `/api/public/paypal?action=status&order_id=…` (or `email=`)
**What it's for:** the app polls this after returning from PayPal. Only `status: "paid"` unlocks the Enter-License step.

### POST `/api/public/paypal?action=cancel`
Marks a pending order `cancelled` (used by the cancel return URL).

### POST `/api/public/paypal-webhook`
Signature-verified PayPal webhook (capture completed/denied/refunded) — server-to-server only.

### GET `/api/public/check-subscription?admin_id=…&email=…`
**What it's for:** unified access check — verified payment record → portal → PayPal transaction search → manual override list. Returns `{ active, via }`.

Return URLs for the PayPal button:
- success: `https://www.tradnestea.app/paypal-return.html`
- cancel: `https://www.tradnestea.app/paypal-return.html?cancel=1`

Secrets live server-side only (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`) — never in the app.

---

## 5. MTAPI — MetaTrader login & execution

Base: `https://mt5.mtapi.io` (MT4: `https://mt4.mtapi.io`). See `api/MtApiService.kt`.

- `GET /Connect` / `GET /ConnectEx` — login with `user`, `password`, `host`, `port` (or broker `server`), returns a token `id` used by all other calls.
- `GET /AccountSummary?id=…` — balance, equity, currency.
- `GET /Symbols?id=…` — broker symbol list, used to resolve `XAUUSD` → `XAUUSD.m`, `.US30.` etc.
- `GET /OrderSend` / `GET /OrderSendSafe?id=…&symbol=…&operation=…&volume=…&stoploss=…&takeprofit=…&comment=…` — executes the trade. Retry without SL/TP on `REQUEST_REJECTED`/`invalid stops`.
- `GET /OpenedOrders?id=…` — open positions.
- `GET /OrderClose?id=…&ticket=…` — close a position.

Trade comment = the bot's name only.

---

## PayFast subscription (native Android)

Base URL: `https://tradnestea.app` (apex — `www` 307-redirects and would drop POST bodies)

Kotlin: `com.whiteyforex.tradenestea.api.PayFastApi` (`PayFastApiService` + `PayFastCheckout`)

| Call | Endpoint | Purpose |
| --- | --- | --- |
| Create | `POST /api/public/payfast?action=create` body `{ "email": "...", "user_ref": "..." }` | Returns `payment_id`, `process_url`, server-signed `fields` (R580/month) |
| Status | `GET /api/public/payfast?action=status&payment_id=...` (or `&email=...`) | `{ "status": "pending\|paid\|cancelled\|failed", "paid": true/false }` |
| Cancel | `POST /api/public/payfast?action=cancel` body `{ "payment_id": "..." }` | Marks an abandoned pending payment cancelled |
| ITN (server only) | `POST /api/public/payfast-itn` | PayFast → our server. The **only** thing that can mark a payment paid |

No API key needed — merchant credentials and the passphrase stay on the server.

### Flow

1. `PayFastCheckout.start(email, userRef)` → keep `payment_id` in SharedPreferences.
2. `PayFastCheckout.open(context, payment)` → self-submitting form opens PayFast in the system browser.
3. `PayFastCheckout.awaitPaid(paymentId)` (or `isPaid(...)` on resume) → poll until the ITN lands.
4. On `paid == true` → navigate to the license-key / ADD ROBOT screen.

The web return page deep-links back as `tradenest://payfast/success`; add this to
`AndroidManifest.xml` so the app is brought to the front after payment:

```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="tradenest" android:host="payfast"/>
</intent-filter>
```

Never treat the browser returning as proof of payment — always confirm with the status call.
