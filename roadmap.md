# Pigi vault browsing and deposits

- [ ] Upgrade wallet navigation to RainbowKit and wagmi, using the selected wallet for deposits.
- [ ] Add Invest / Deposit controls to all vault cards, with unsupported vaults clearly blocked.

- [x] Show live Pigi vaults with yield, chain, risk, search, and filters.
- [x] Add injected-wallet connection and a guarded standard ERC-4626 deposit flow; current feed rows remain view-only when valid contract metadata is missing.
- [x] Test vault parsing and deposit restrictions, and check desktop/mobile browsing with 20 live rows.
- [ ] Validate live on-chain deposits: blocked by unverified protocol-specific deposit contracts/metadata and absence of an authorized funded wallet. No transaction was sent.