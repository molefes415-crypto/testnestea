# TradeNest PHP PayFast mobile payment server

Payment relays forward unchanged notifications to Cloud. Only Cloud verifies PayFast, then calls the signed portal activation endpoint using stored email and mentor ID. The portal marks subscriptions paid without using mentor slots. Direct paid-email counts come from separate receipts, not slot grants or repeat monthly notifications. Checkout remains the supplied R580 monthly Pay Now form; no merchant key is submitted.

## Deploy

1. Configure the same `PAYFAST_PORTAL_SIGNING_SECRET` securely in Cloud and the PHP host environment. If environment variables are unavailable, place `payfast-private.php` OUTSIDE public web hosting, at the parent directory of the existing root `config.php`, returning an array with `portal_signing_secret`. Never upload that secret file to public_html. Cloud must also use the matching PayFast ITN passphrase if configured. No merchant key is needed for Pay Now.
2. PHP 7.4+ with cURL and HTTPS is required on `tradenestea.com`.
3. Back up existing files. Run `portal-payments.sql` once in the mentor portal MySQL database. Upload `common.php`, `portal-payment-functions.php`, `payfast_activate.php`, `payfast_create.php`, `payfast_itn.php`, `payfast_status.php`, `payfast_return.php`, `payfast-mobile.js` and `payfast-return-controller.js` into `admin/api/`. Upload `licences.php` into `admin/` to add the separate Paid Emails count. Do not overwrite manual `activate_mail.php`; its mentor-slot flow stays separate. Publish the updated app once PHP and the shared secret are configured.
4. In PayFast fixed settings use:
   - Return: `https://tradenestea.com/admin/api/payfast_return.php`
   - Cancel: `https://tradenestea.com/admin/api/payfast_return.php?cancel=1`
   - Notify: `https://tradenestea.com/admin/api/payfast_itn.php`
5. The updated checkout sends its own per-checkout return/cancel URLs with `?m=<unique payment reference>` and `&cancel=1` on cancel. Fixed URLs alone cannot identify a payment. If `PAYFAST_NOTIFY_URL` is configured in Cloud, it overrides the default: retain it only if intentionally using the existing validated relay.
6. Add the Android/iOS integration in `ANDROID_MANIFEST.md`, rebuild and install the native app. No Android activity/manifest or full iOS project is present in this repository, so the supplied handlers still need wiring into those real apps.

## Client APIs

`POST https://tradenestea.com/admin/api/payfast_create.php`

```json
{"email":"CUSTOMER_EMAIL","admin_id":17,"user_ref":"17"}
```

Returns the existing Cloud checkout response plus `success: true`: `payment_id`, `launch_url`, server-generated Pay Now `fields`, amount and currency. Remember the payment ID and open `launch_url` in an external browser. Do not use a PayFast iframe or static merchant-key form. Android can continue using the existing Cloud `PayFastApi.kt` instead of the PHP create relay.

`GET https://tradenestea.com/admin/api/payfast_status.php?payment_id=<remembered reference>`

Returns only that checkout's status and reference. No email lookup or customer details are exposed through this PHP endpoint. Unknown/upstream-failed reads cannot become `paid`. Clients must verify **paid true + status paid + matching remembered payment ID**, then refresh existing account access; payment navigation alone is not authorization.

`POST https://tradenestea.com/admin/api/payfast_itn.php`

PayFast calls this with its original signed form body. Invalid notifications are rejected. Upstream outages return 503 so PayFast can retry; there is no false acknowledgement or local paid write.

## Verification before going live

- Upload PHP, publish Cloud, check cURL availability and outbound access to Cloud.
- Make a PayFast sandbox/real checkout; confirm ITN reaches Cloud and the same reference reads back as paid.
- On Android, test installed app cold start, existing app return, explicit Open button and ordinary app resume.
- Test iPhone native separately from Add-to-Home-Screen. Browser launch permission is not guaranteed.
- Test pending/cancel/failed/forged-success links; none may grant access.
- Confirm the paid client's email appears under that mentor in `subscriptions`, Paid Emails increases once, and `mentor_slots.used_slots` is unchanged. Replay the ITN and verify no duplicate receipt/subscriber. Cloud access checks now rely on mentor-specific portal status, not email-only payment or PayPal fallbacks.
- Existing manual activation and removal files were not changed. Audit deletion/slot-refund handlers before deleting direct-paid emails; their source has not been supplied. This package does not implement subscription expiry or cancellation-driven revocation.

Do not consider a real end-to-end payment or installed-device reopening verified until these checks succeed.