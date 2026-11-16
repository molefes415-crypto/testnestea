# TradeNest PHP PayFast mobile payment server

This is a credential-free PHP relay for the existing TradeNest Cloud payment system. It does not replace your portal, licence system or database. Only Cloud verifies PayFast's signature, merchant, provider validation and stored ZAR amount before recording payment. Checkout uses the supplied R580 monthly PayFast Pay Now form (`cmd=_paynow`, receiver `36249167`) at `https://payment.payfast.io/eng/process`; no merchant key is submitted.

## Deploy

1. Publish the updated TradeNest app first. Cloud must use the same PayFast ITN passphrase as the merchant account, if one is configured. Rotate the previously exposed merchant key in PayFast and update the existing Cloud secret; do not put it in PHP or Android.
2. PHP 7.4+ with cURL and HTTPS is required on `tradenestea.com`.
3. Upload `common.php`, `payfast_create.php`, `payfast_itn.php`, `payfast_status.php`, `payfast_return.php`, `payfast-mobile.js` and `payfast-return-controller.js` together into `admin/api/`. Back up any existing `payfast_itn.php` before replacement: if it currently activates portal email access, preserve that behaviour through its verified handler rather than overwriting it without review. This relay updates existing Cloud payments only, not an undocumented portal subscription table.
4. In PayFast fixed settings use:
   - Return: `https://tradenestea.com/admin/api/payfast_return.php`
   - Cancel: `https://tradenestea.com/admin/api/payfast_return.php?cancel=1`
   - Notify: `https://tradenestea.com/admin/api/payfast_itn.php`
5. The updated checkout sends its own per-checkout return/cancel URLs with `?m=<unique payment reference>` and `&cancel=1` on cancel. Fixed URLs alone cannot identify a payment. If `PAYFAST_NOTIFY_URL` is configured in Cloud, it overrides the default: retain it only if intentionally using the existing validated relay.
6. Add the Android/iOS integration in `ANDROID_MANIFEST.md`, rebuild and install the native app. No Android activity/manifest or full iOS project is present in this repository, so the supplied handlers still need wiring into those real apps.

## Client APIs

`POST https://tradenestea.com/admin/api/payfast_create.php`

```json
{"email":"CUSTOMER_EMAIL","user_ref":"EXISTING_CLIENT_REFERENCE"}
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
- Confirm the existing portal email-access refresh agrees with Cloud payment status. That portal contract is not available here; this package does not invent a write API for it.

Do not consider a real end-to-end payment or installed-device reopening verified until these checks succeed.