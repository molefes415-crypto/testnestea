# Android Studio prompt: image-free automatic trading

Update the existing native Android TradeNest EA app. Do not rebuild its login, mentor, licence or payment system. Automatic robot trading must NOT require a screenshot, camera permission, uploaded image, chart-selection screen or image-analysis API. Keep manual image scanning separate and optional.

## Start and stop

When the client taps Start, immediately show the top scanning box described below. Verify their selected MT5 account using their personal MT5 token, then begin reading live prices for the exact broker symbols they have allowed. Retain their per-symbol lot, trade count and Scalp/Day/Swing choice. Respect the existing Auto Scanner opt-in; when it is off, show a paused state rather than silently enabling it. Stop cancels sampling and unsent orders. An account/token change stops the robot and clears that account's quote history. No mentor-pushed signals or cloud robot-start/sync calls are required.

## Existing gateway contract

Base: `https://tradenestea.com/admin/api/mt5_gateway.php`

Pass `X-MT5-Token: <client personal token>` and `Accept: application/json`. Keep the token in Android Keystore-backed encrypted storage. Never embed the gateway admin key or retain the trading password.

Verify account:
`GET ?a=proxy&p=account`

Read each allowed symbol's live quote:
`GET ?a=proxy&p=<URL-encoded quote/EXACT_SYMBOL>`
Example: `?a=proxy&p=quote%2FXAUUSD.m`

Check open positions:
`GET ?a=proxy&p=positions`

Submit order:
`POST ?a=proxy&p=order`, `Content-Type: application/json`

```json
{"symbol":"XAUUSD.m","side":"buy","volume":0.01,"sl":4130.25,"tp":4217.98,"comment":"mobi ea-auto","deviation":20}
```

The example is a payload illustration, NOT a signal to execute. Use calculated current levels and the client's configured volume. Retain exact symbols; do not substitute XAUUSD for XAUUSD.m. Confirm response using the existing gateway contract: explicit failure/error is rejected; numeric retcode must be 10008, 10009 or 10010, otherwise a positive numeric order/ticket is required. An ambiguous timeout is not success and MUST NOT be retried. Show the broker error; do not remove or modify rejected SL/TP to force execution.

## Local strategy, not image AI

Port the existing `public/mt5-local-robot.js` behaviour to Kotlin and use a proven indicator library with matching EMA/RSI semantics. Use fresh, strictly chronological, real bid/ask samples; midpoint = (bid + ask)/2. Sample/evaluate every five seconds with sequential, cancellable coroutines and no overlapping requests. Coalesce reads for the same account/symbol and retain only recent in-memory history across Stop/Start.

- At least 40 samples spanning 180 seconds are required. Readiness = floor(clamp(min(sampleCount/40, elapsedMilliseconds/180000), 0, 1) * 10). Display 0/10 through 10/10. Do not invent historical candles or bypass warm-up. Immediate scanning is required; immediate trades are NOT guaranteed.
- Reject live quotes older than 30 seconds, samples older than 10 minutes, invalid prices, and non-increasing timestamps. Do not invent absent broker timestamps or symbol data; follow the existing browser adapter's validated response mapping and use local observation time only as observation time.
- EMA periods 9 and 26, RSI period 14, all calculated on midpoints.
- BUY: latest EMA9 > latest EMA26; EMA9 rising; RSI in [55,75]; latest midpoint above the previous five midpoints.
- SELL: latest EMA9 < latest EMA26; EMA9 falling; RSI in [25,45]; latest midpoint below the previous five midpoints.
- Otherwise NEUTRAL, with the actual waiting reason. This is local quote-trend analysis, not an AI confidence score, news forecast or MASTER H1 strategy.
- Entry = ask for BUY, bid for SELL. Stop distance = entry * 0.0015 for Scalp, entry * 0.0035 for Day. Reject spread >= distance/3. Scalp TP distance = stop distance * 1.5; Day TP distance = stop distance * (0.6/0.35). Round to broker digits using the existing adapter's fallback only if digits are absent. Validate SL/TP against current bid/ask before execution.
- Swing explicitly uses null SL/TP. Explain its unprotected risk. If reversal closing is implemented, close only verified positions for this exact symbol and this bot's `botname-auto` comment with known direction/ticket; never close other account trades. Use only the gateway's documented close contract and never retry ambiguous closes.
- Use a signal identifier matching the browser engine: `local-<exact symbol>-<floor(nowMilliseconds/900000)>`. Deduplicate execution per account/signal. Verify open positions and preserve the existing one-position-batch-per-symbol protection. Each configured order slot is submitted once; stop the batch on unconfirmed result. Count only confirmed orders. Never promise a configured count if the broker rejects an order.

## Top scanning box: match the supplied three screenshots

Place one dark rounded box at the TOP of Home, above the robot card, not a mandatory image scanner dialog. Rounded outline, compact status badges, selected exact symbol large on the left, small bot logo on the right, dismiss × at top right. Use the client's selected theme where appropriate and a clear green BUY/red SELL signal badge. Keep all text inside the phone width.

Show the progress track `Connect — Terminal — Execute`:

1. On Start before the account read finishes: `CONNECT`, spinner, `Connecting…`, Connect highlighted.
2. After verified account/quote response: `READY`, Terminal highlighted; first `Loading symbol`, then actual bid/ask and warm-up `n/10` with minimum seconds remaining, or the real NEUTRAL reason. READY means connection/prices are available, NOT that a trade is guaranteed.
3. On a genuine BUY/SELL: direction badge and analysis section containing exact symbol, direction, actual entry, SL and TP. Label it `LOCAL TRADE ANALYSIS`, not `AI TRADE ANALYSIS`, because the current engine is local indicators.
4. While submitting orders: `EXECUTING`, Execute highlighted, `Placed n/configuredCount trades` updated only after confirmations. Show `EXECUTED` only on confirmed completion; show partial count/error on failure.
5. On read failure: unavailable/error state with actual reason; retain a potentially recoverable token and retry only read-only requests. Rejected tokens or account mismatches require relogin. Never display a fake connected tick.

Dismiss hides the box, not the robot. The next Start shows it again. Do not require an image or show endless generic loading: always expose the current operation, measurable warm-up or real error. No fake prices, confidence, execution IDs or success states.

Use a lifecycle-aware coroutine owner. If implementing Android background trading, use a user-visible Foreground Service with explicit stop action and required platform permissions; do not claim it will run while force-stopped or guarantee operating-system uptime. Do not silently add news automation to this local strategy.

## Acceptance checks

Test Start with no image selected: box appears immediately, account verification succeeds, exact allowed-symbol quote requests begin, and no image-analysis endpoint is called. Test off opt-in, failed account, token changes, 0/10 and 10/10 readiness, NEUTRAL, BUY/SELL levels, configured count, broker rejection, ambiguous timeout, Stop and dismiss. Use controlled responses for order tests; never place real trades during automated testing. Verify no credentials enter logs or screenshots.