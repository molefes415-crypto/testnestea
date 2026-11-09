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

- MT5 uses a fail-closed PHP gateway adapter; do not add credential requests until the upstream contracts and independent client-bound session issuance are verified, because the existing app login is not proof of MT5 session ownership.
- The legacy MetaTrader tab embeds the dedicated /mt5 screen; keep gateway tokens and passwords out of legacy browser storage and direct provider calls.
