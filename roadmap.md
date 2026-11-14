# MT5 gateway connection

- [x] Add one transport-only recovery attempt for news arming/preparation reads, credential-free connection diagnostics and automatic removal of recovered status errors; gateway health currently passes. Live personal-account scheduling remains unverified.

- [x] Switch Fundamentals to the new portal calendar with documented timestamps and SAST groups; ten calendar/automation tests pass and browser confirms the false API-key event is removed without errors.
- [x] Verify live new-calendar events — portal and app return 357 real events; browser confirms today's 13:00 GBP speech and tomorrow's 23:30 NZD release in SAST. Fixed unzoned SAST parsing, invalidated mis-timed cache rows, and passed twelve calendar/automation tests; no trades requested.

- [x] Float robot progress over the interface without layout movement; remove visible preparation counters and duplicate neutral analysis while keeping verified connection, genuine execution states and strategy-history checks.
- [ ] Analyze immediately on a first-ever Start — requires a documented broker historical-price endpoint; current quote-only gateway cannot supply the strategy's existing minimum history immediately.

- [x] Consolidate chart signal levels, confidence, diagnostics and news context into the shared top scanning box; remove bottom signal and diagnostics cards without changing analysis or trading rules.

- [x] Provide Android image-free automatic-trading prompt and reference-style top scanning box driven by actual Start, quote-analysis and execution states; 18 tests pass and controlled desktop/phone Start confirms visible readiness, no image requirement, dismissal and no runtime errors. Native implementation and real broker execution remain unverified.

- [x] Reduce automatic scan overhead: coalesce overlapping symbol reads, remove per-symbol sleep, evaluate every five seconds, keep recent in-memory quotes across Stop/Start, and show measurable warm-up progress. Initial three-minute strategy history remains necessary; immediate historical analysis needs a documented candle endpoint from the external gateway host.

- [x] Retain selected sessions during temporary gateway failures, automatically recheck unavailable accounts while visible and on return, and retry scanner reads once without retrying orders. Genuine token rejection still requires login; real client session remains unavailable for live verification.

- [x] Align local Start with the account-read contract (optional connected flag, explicit false rejected); surface failed account checks and distinguish account/session 404 from unavailable PHP hosting. Live gateway health passes; personal account verification still requires the client's session.

- [x] Move robot auto-analysis into the app with local EMA/RSI quote-trend analysis, direct MT5 verification on Start and PHP gateway orders; cloud scan jobs disabled. Controlled browser test starts with cloud endpoints unavailable and sends ten XAUUSD.m orders at 0.01 lots without errors; 17 tests pass. Real broker execution remains unverified; app must stay open, and this is not the H1 MASTER/AI/news strategy.

- [x] Prevent failed robot sync from enabling local trading/countdowns; require explicit server running confirmation and distinguish server connectivity errors from browser CORS errors. Live robot session verification remains unavailable without a personal MT5 session.

- [x] Resolve paused-database blocker for Automate News — Cloud resumed and healthy; private schedule/order schema applied and browser access revoked, verified through database reads; five safety tests pass. No order placed.
- [x] Add tappable news-event automation panel with exact symbols, lots, trade count, seconds/minutes lead time and cancel/status controls; browser validates 10 trades, exact XAUUSD.m selection, 5-minute timing, modal closing and disconnected-account block on mobile/desktop.
- [x] Register the published signed Inngest news workflow — registration returned HTTP 200, Successfully registered; signed preview and production discovery both report one function. Unsigned HTTP 401 is expected SDK protection, not an offline service.
- [x] Fix news automation rejecting account reads with omitted optional connected flags across arming, preparation and execution; explicit disconnection and account mismatches remain blocked. Added visible errors and five-second status refresh; fourteen tests and panel checks pass.
- [ ] Verify secure AI-directed closed-app news execution — live client scheduling and broker execution still require a personal MT5 test session and publishing the correction; no live job or order created during checks.

- [x] Match Fundamentals with market-session flags and calendar periods; redesign chart scanner with pill selectors and upload area, and add Fundamentals beside Performance. Two session tests pass; browser verifies real calendar, filters, image upload preview, ICT/M15 selectors, Chart/News switching, no unsolicited analysis and mobile navigation with no runtime errors. Existing live broker/AI execution is unchanged and not retested with a real account.

- [x] Keep floating profits moving through independent one-second broker position reads without clearing the card or repeatedly loading history; ten tests pass and mobile browser fixtures show +8.21 with four position reads and only one history read. Session removal clears old values. Real broker timing remains unverified without a personal MT5 session; gateway has no documented tick stream.

- [x] Remove the oversized decades-long history request and use the documented default range; request regression test and fixture navigation pass. Live gateway 500 resolution remains unverified without its personal session.
- [ ] Retrieve verified lifetime account earnings — host must provide a supported full-history range or pagination contract; default history coverage is not lifetime earnings.

- [x] Show entire account trade history and realised earnings, including manual trades and fees but excluding deposits; missing position references no longer block account earnings. Seventeen tests pass; fixture browser verifies all six deals, net earnings 955 and win rate 66.7%. Real broker history coverage remains unverified.

- [x] Correct refresh flicker and separate floating profit from swap in Performance; delayed-refresh browser checks retain the card and positive profit, session removal clears old data, and six calculation tests pass. Live profit comparison still requires the broker session.

- [x] Add Performance beside Home with the shared account card, open positions, bot-only closed history, net earnings, win rate and losses; seven calculation/account tests and desktop/mobile navigation checks passed using fixtures without placing trades.
- [ ] Verify Performance against a real connected broker account — no personal MT5 session is available in this sandbox; actual broker positions/history remain unverified and totals are limited to returned history.

- [x] Finish the fundamentals page with live calendar filters, SAST times, forecast/previous/actual values and manually requested AI outlook; real calendar returned 101 events, AI returned three outlooks, desktop/mobile checks passed, and Settings navigation passed with a fixture profile. Viewing news never triggers trades.
- [x] Feed selected-account live bid/ask and sampled quotes into manual and automatic AI scans; exact-symbol/account-switch tests pass, browser quote-to-scanner fixtures pass, and a real AI request returned NEUTRAL. Real broker scanning remains unverified without an available MT5 session.
- [ ] Load the full broker symbol catalogue and historical candles — the supplied single-file gateway documents neither endpoint; needs the host's supported contract.

- [x] Add only Apple Wallet scroll-linked depth, overlap and selection motion; fixture-tested scrolling, switching, unlinking, mobile fit and reduced-motion support with unchanged account appearance and gateway logic.

- [x] Keep the selected main account above a swipe-up saved-account chooser (fixture-tested mobile scrolling, stationary main account, switching and unlinking).

- [x] Restyle logged-in accounts as an overlapping Apple Wallet stack; verified with fixture accounts on desktop/mobile, including switching, unlinking and add/back navigation (live broker access remains unverified).

- [x] Add neon to the MT5 account cards: glowing accent edges and sheen, lit account number, pulsing green connected glow, red-lit Demo/Live (browser-tested with fixtures at 1280x1800).

- [x] Map the seven debit-card reference positions to broker name/logo, balance/equity/margin, holder, first four login digits, account type and colored connection status.

- [x] Make Demo ribbons red, Live ribbons black with red border lines, and connected check circles green.

- [x] Apply theme-aware blurred glass, shared backgrounds, box-free logos, and pill navigation (verified together on mobile and desktop with fixture accounts).

- [x] Match the supplied MT5 account-list layout with dark blocks and broker logos; + opens login and verified login returns to accounts (browser-tested with fixtures; live broker login remains unverified).

- [x] Restore the neon MT5 ACCOUNT / MT5 Login Details appearance.
- [x] Implement uploaded single-file link/account/proxy contract; never persist the password.
- [x] Remove obsolete multi-file gateway blocker and test contract/error handling.
- [x] Review Claude troubleshooting notes; verify gateway health and browser access without resetting accounts.
- [x] Preserve gateway rejection status and distinguish blocked browser requests from broker failures.
- [x] Prepare corrected PHP gateway without subscription checks, retaining personal-token access and rejecting unsafe account replacement.
- [ ] Deploy free MT5 linking — upload the corrected mt5_gateway.php to the PHP host; this workspace cannot deploy to that host.
- [ ] Verify live JustMarkets connection and account reads — both website origins now pass; subscription-gated linking and unavailable demo credentials prevent verification.
- [ ] Connect live trading to the main app — wait for a reachable gateway and verified demo connection; the existing app trade path remains disabled.
- [x] Always-on server robot (start/stop from app, 5-min scans, auto-arms high-impact news)
- [ ] Verify robot live trade — needs publish and a running client account
