# TradeNest Android Fundamentals kit

Source handoff, not an APK or replacement for the entire Android project. Kotlin package is isolated from the old `api.MtApiService`, `ScannerEngine` and `NewsTrader`; do not route this screen through those older direct-provider files.

## Add to Android Studio

Copy `src/main/java` into your Android app's `src/main/java`. Merge these dependencies into the existing app module; keep your project's Compose BOM/plugin versions:

```kotlin
implementation(platform("androidx.compose:compose-bom:2025.04.01"))
implementation("androidx.compose.material3:material3")
implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.0")
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
implementation("com.squareup.okhttp3:okhttp:4.12.0")
implementation("com.google.code.gson:gson:2.11.0")
implementation("org.ta4j:ta4j-core:0.17")
testImplementation("junit:junit:4.13.2")
// For minSdk < 26, also enable Java-time coreLibraryDesugaring:
coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
```

Enable `buildFeatures { compose = true }`, Java/Kotlin target 17, and `compileOptions { isCoreLibraryDesugaringEnabled = true }` if using desugaring. Manifest needs `<uses-permission android:name="android.permission.INTERNET" />`. No cleartext permissions are needed.

## Connect existing account and bot state

```kotlin
// Session, identity and enabled flags must come from the existing signed-in app.
// Use rememberUpdatedState for live suppliers; never capture an obsolete account.
val latestSession = rememberUpdatedState(selectedMt5Session)
val latestBotRunning = rememberUpdatedState(botRunning)
val gateway = remember { Mt5Gateway() }
val scanner = remember {
    LocalAutoScanner(gateway, { latestSession.value }, { latestBotRunning.value })
}
FundamentalsScreen(
    scanner = scanner,
    session = selectedMt5Session,
    allowedSymbols = actualAllowedBrokerSymbols,
    botName = actualBotName,
    botRunning = botRunning,
    autoScannerEnabled = autoScannerEnabled,
    accent = selectedThemeAccent,
    onConnectMt5 = { /* existing MetaTrader navigation */ }
)
```

Call `gateway.link(login, tradingPassword, exactServer, Mt5Identity(existingEmail, existingMentorId))` in an existing screen coroutine, then save the returned **verified** session using Android Keystore-backed encrypted storage. Clear the password field immediately after the attempt. Do not log requests, tokens or passwords. Linking is independent of subscription status. Do not mark a restored token connected until `gateway.verify(session)` succeeds. Keep the token on temporary outages, but require login on 401/403 or account mismatch. A timeout can occur after the server has acted: never automatically repeat a link/order/close.

## Correct APIs

Base: `https://tradenestea.com/admin/api/mt5_gateways.php`

| Request | Method | Body / header |
|---|---|---|
| `?a=link` | POST | JSON `login` number, `password`, `server`, `email`, `adminId` |
| `?a=proxy&p=account` | GET | `X-MT5-Token` personal token |
| `?a=proxy&p=positions` | GET | same header |
| `?a=proxy&p=history` | GET | same header; documented default range only |
| `?a=proxy&p=quote%2FXAUUSD.m` | GET | same header; exact selected symbol |
| `?a=proxy&p=ticks%2FXAUUSD.m&seconds=600` | GET | same header; VPS/PHP tick patch required |
| `?a=proxy&p=order` | POST | same header; JSON `symbol`, `side` buy/sell, `volume`, `sl`, `tp`, `comment`, `deviation` |
| `?a=proxy&p=modify` | POST | same header; `ticket`, `sl`, `tp` |
| `?a=proxy&p=close` | POST | same header; `ticket` |

Calendar: `GET https://tradenestea.com/admin/api/news.php` (public, no MT5 token). It accepts events or day groups, validates timestamps, deduplicates and displays SAST. Flags are bundled Unicode country flags; sessions use IANA zones, DST and weekday hours. Session hours do not include exchange holidays.

No scanner/admin API key is embedded. Calendar viewing does not order trades. This is a News-only screen: tapping an event opens the included automation dialog with exact symbols, lots, trades, seconds/minutes before release and status/cancel controls. There is no Chart tab or image upload.

### Event automation API — publish the updated TradeNest website first

`POST https://tradnestea.app/api/public/news-automation`, header `X-MT5-Token`, JSON body:

```json
{"action":"arm","input":{"eventId":"calendar-event-id","symbols":["XAUUSD.m"],"lot":0.01,"trades":10,"leadSeconds":300}}
```

Read: `{"action":"list"}`. Cancel: `{"action":"cancel","id":"schedule-uuid"}`. Responses: `{"success":true,"data":...}`. The new thin adapter delegates to the existing verified account-specific scheduler; it does not create another trading engine. Server validation verifies the personal MT5 token, exact symbols and actual calendar event; tokens stay encrypted in existing schedules. Direction comes from the existing AI workflow, SL/TP are required, and an ambiguous order is not retried. News automation uses its existing limit of 1–100 trades per symbol and 1–900 seconds lead, separate from the local robot's 1–50 limit. The server scheduler remains active after Android closes, unlike the foreground local scanner. Existing workflow registration and configured scheduling/encryption secrets are required. Scheduling requests have a 120-second timeout and no automatic retry; after an uncertain save, check status rather than blindly submitting again.

Do not use `mt5.mtapi.io/Connect` or `OrderSendSafe` for this integration. Optional manual outlooks/image AI are not included.

## Timeouts and retries

Connect 20s, account linking total/read 200s, regular reads total/read 30s, orders/close/modify total/read 30s, write 30s. Exactly one transport-only GET retry; no retry on HTTP errors, link, order or close. OkHttp's automatic connection retries and redirects are disabled. A single read may therefore take up to 60s across its two attempts. Orders with unknown outcomes stop the scanner, and must be checked in positions before restarting.

## Auto scanner behavior

Explicit Auto Scanner enabled AND bot running AND Start are required. Runs only while this screen/app remains foreground; leaving it or backgrounding stops it. Sequential broker quote polling and local EMA9/26 + RSI14 breakout analysis run every five seconds **after reads finish**, not a true price stream. Warm-up needs 40 real samples spanning three minutes; ten-minute broker ticks can seed it. An unchanging broker timestamp for 30 seconds blocks trading. Broker timestamps are not assumed UTC because the worker returns unzoned broker time.

Two consecutive entry confirmations, exact symbols only, any existing symbol position blocks entry, configured trade count 1–50 without silent clamping, no financial-value interpolation, broker-confirmed Execute state. Original stops are preserved through submission. Day/scalp compute local levels; swing explicitly has no SL/TP. Swing reversal requires three confirmations, five minutes held since first observation, bot-owned positions, known nonpositive profit; it never closes a profitable position or opens reverse in the same cycle. Per-signal attempts are retained across Start/Stop in this scanner instance; process restarts clear the in-memory set, so inspect positions after any uncertain outcome. No durable order idempotency is provided by the gateway.

The indicator engine uses ta4j rather than a handwritten RSI/EMA implementation. Its smoothing/rounding can differ slightly from the website's indicator library, so do not expect identical signal timing. This is the local quote-trend strategy, not AI news execution or broker candles.

## Validation limits

Core Kotlin compilation/tests cover timeouts, session/DST rules, calendar timestamps, symbol/count validation, entry/reversal protection and order confirmation. The Compose screen still needs compilation in your complete Android project and phone rendering checks. No real broker account or order was used during preparation.