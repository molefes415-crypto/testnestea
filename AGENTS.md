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
- Wallet UI uses client-only RainbowKit with compatible wagmi v2 and injected/EIP-6963 wallet discovery; transaction helpers receive the selected connector's provider, never window.ethereum. WalletConnect requires a real project ID before enabling QR connections.
- Only explicit standard-vault protocol candidates passing on-chain asset and deposit checks may execute ERC-4626 deposits with viem, exact-amount approvals, simulation and receipt checks; unsupported protocols remain blocked.
