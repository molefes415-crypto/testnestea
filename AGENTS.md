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

- Pigi Finance vault reads use a server-only key-to-JWT exchange behind the existing TradeNest API-key boundary; never expose provider credentials or tokens to clients.
- The vault browser uses a public server function projecting only public Pigi analytics; the existing external Pigi endpoint stays API-key protected.
- Wallet execution uses injected EIP-1193 wallets and viem; only explicit standard-vault protocol candidates passing on-chain asset and deposit checks may execute ERC-4626 deposits, with exact-amount approvals and receipt checks.
