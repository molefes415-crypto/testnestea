# TradeNest PayFast ITN server for Render

This standalone server receives PayFast notifications at `/itn` and forwards the unchanged signed form to TradeNest's existing Cloud payment receiver. Render stores no payment records, merchant secrets or database credentials. Only the Cloud receiver can mark an existing payment paid.

## Deploy

1. Publish the updated TradeNest app first. Its receiver is `https://tradnestea.app/api/public/payfast-itn`.
2. In Render, create a **Web Service** connected to this repository. Choose Node, root directory `hosting/payfast-itn`, build command `node --version`, start command `node start.mjs`, health path `/health`. Alternatively use the supplied `render.yaml` blueprint when importing this directory.
3. Use an always-on paid instance; free instances sleep and can delay payment notifications. Check Render's current price before confirming.
4. Set Render's `TRADENEST_ITN_RECEIVER_URL` to the receiver above. Do not add database keys or PayFast credentials to Render.
5. Open the actual Render service URL followed by `/health`. This checks the relay process only, not the full payment flow.
6. Set **TradeNest's** server secret `PAYFAST_NOTIFY_URL` to your actual Render service HTTPS URL followed by `/itn`, then publish TradeNest again. No placeholder service URL is configured by this code.
7. Keep the same `PAYFAST_PASSPHRASE` in TradeNest and PayFast Settings → Integration. The customer return/cancel link stays on TradeNest; do not replace it with `/itn`.
8. Create a new checkout and complete a PayFast test payment in sandbox using matching sandbox merchant credentials. Confirm TradeNest's payment status reads `paid` only after the notification. Existing checkouts retain their old notify URL.

## Verification and limits

- Cloud requires matching signature, merchant ID, PayFast server validation, an existing PayFast payment and an exact stored ZAR amount (currently R580). Unknown orders never create access.
- Invalid notifications cannot activate accounts. Temporary provider or database failures return 503 so PayFast can retry. Duplicate notifications cannot downgrade a paid payment.
- The relay does not trust forwarded IP headers; provider validation is performed by Cloud. Neither service logs notification bodies or passphrases.
- This preserves the current one-record subscription model. Renewals of an already paid record are acknowledged but do not extend an expiry; recurring billing expiry/cancellation entitlement management needs a separate implementation.
- Deployment and a real PayFast end-to-end payment have not been performed from this workspace. The relay still depends on the Cloud receiver being online; it is not a full app migration to Render.

Run `node --test server.test.mjs` in this directory for relay checks.