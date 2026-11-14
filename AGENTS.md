<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- MT5 uses the user-supplied single-file PHP gateway contract through a browser fetch adapter, with existing profile context and personal token headers; never persist passwords or fall back to the old provider.
- Retain selected MT5 tokens through temporary read failures, reverify on recovery, and retry only read-only scanner calls; rejected tokens or account mismatches require login so reconnecting cannot duplicate trades or fabricate live status.
- The legacy MetaTrader tab embeds the dedicated /mt5 screen; keep gateway tokens and passwords out of legacy browser storage and direct provider calls.
- The /mt5 workspace owns account-list and login navigation, returning only after the gateway account read verifies the submitted login; static broker assets are matched by server name with an MT5 fallback for unknown brokers.
- Share MetaTrader appearance through same-origin parent/iframe messages carrying only accent and media URLs; verify both origin and parent source and keep account credentials out of this bridge.
- Render active and saved MT5 account faces through the same presentation helper so field placement and connection indicators stay consistent without changing gateway contracts.
- Keep wallet scroll and selection animations in a presentation-only hook using native scrolling and browser animations; animate selection only after existing account verification succeeds.
- Keep live scanner quote sampling in a browser helper using only documented personal-token gateway calls; send price-only snapshots to AI, reject changed accounts, and validate quote freshness and exact symbols before analysis.
- Fundamentals uses its own content route with a public calendar server function and the existing manually invoked news prediction API; viewing outlooks never triggers trades.
- News automation is explicitly armed per event through server functions verifying the personal MT5 token; accept validated account reads with an omitted optional connected flag but reject explicit disconnection or account mismatch. Encrypt tokens at rest, keep schedule/order tables server-only, use signed Inngest sleep-until workflows, verify exact quotes/stops/account/timing before orders, and never retry ambiguous order attempts.
- News arming/preparation opts into one transport-only retry for gateway reads; execution remains single-attempt, and transport diagnostics omit credentials so temporary outages can be investigated safely.
- Scanner and Fundamentals share semantic scanner theme tokens through the global scanner stylesheet; session clocks use local IANA time zones for DST and weekends, and Chart/News messages verify same-origin iframe source without credentials.
- Performance is a read-only route using the shared MT5 card and personal-token account/positions/history reads; sum deduplicated whole-account trading deals including fees but excluding deposits, allow missing position references, and leave accuracy unavailable without exit classification.
- Floating positions use a sequential one-second browser polling loop separate from slower history reads; pause hidden tabs, discard account changes, expose failed readings, and never interpolate financial values because the gateway has no documented push stream.
- Keep externally hosted PHP gateway source in hosting/mt5 with regression tests; client-supplied identity labels must never authorize replacing a terminal, because they are not authenticated ownership proof; replacing an already-linked terminal requires a broker-verified trading password first.
- The economic calendar uses the portal news.php JSON contract and a pure validated timestamp/SAST adapter; retain a shared 30-minute last-good cache, reject provider notices as events, and never substitute the retired feeds.
- Run automatic robot analysis in the browser using locally sampled exact-symbol broker quotes; verify the MT5 account before Start, use the PHP gateway for orders, and never require cloud robot sync. Browser automation stops when the app closes.
- Coalesce simultaneous same-session/symbol quote reads and retain only recent in-memory samples across robot restarts; account changes clear history and strategy warm-up is never bypassed to force immediate trades.
- Present robot progress in a fixed top notification that never shifts interfaces; reuse its signal details/diagnostics for chart results, hide readiness counters and neutral analysis duplicates, and mark Execute active only for real execution so notification styling never fabricates trading success.
