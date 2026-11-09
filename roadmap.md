# MT5 gateway connection

- [ ] Restore the original neon login screen and implement the uploaded single-file gateway contract.
- [ ] Validate link/proxy requests, account reads and errors without fabricating live account success.

- [x] Inspect existing PHP endpoint methods and failure contracts.
- [x] Implement connection screen and fail-closed gateway API service.
- [x] Remove unsafe direct MTAPI credential calls and symbol/stop rewriting from the web app.
- [x] Test connection failure and trading safety rules.
- [x] Document exact PHP session issuance blocker and unverified contracts.
- [x] Read existing userProfile email and mentor ID in the MT5 screen without changing app login.
- [ ] Submit the existing user's email/admin_id to session.php — blocked by missing PHP source, token success contract and ownership verification.
- [ ] Enable live connection, real account/symbol reads and secure per-client token storage — blocked by missing PHP source/contracts.
- [ ] Verify the existing JustMarkets demo account — requires available demo credentials and a confirmed gateway contract.
- [ ] Enable gateway trading — blocked by absent documented PHP order endpoint.