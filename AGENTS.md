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
- The legacy MetaTrader tab embeds the dedicated /mt5 screen; keep gateway tokens and passwords out of legacy browser storage and direct provider calls.
- The /mt5 workspace owns account-list and login navigation, returning only after the gateway account read verifies the submitted login; static broker assets are matched by server name with an MT5 fallback for unknown brokers.
- Share MetaTrader appearance through same-origin parent/iframe messages carrying only accent and media URLs; verify both origin and parent source and keep account credentials out of this bridge.
- Render active and saved MT5 account faces through the same presentation helper so field placement and connection indicators stay consistent without changing gateway contracts.
- Keep wallet scroll and selection animations in a presentation-only hook using native scrolling and browser animations; animate selection only after existing account verification succeeds.
- Keep externally hosted PHP gateway source in hosting/mt5 with regression tests; client-supplied identity labels must never authorize replacing a terminal, because they are not authenticated ownership proof; replacing an already-linked terminal requires a broker-verified trading password first.
