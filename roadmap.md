# MT5 gateway connection

- [x] Inspect existing PHP endpoint methods and failure contracts.
- [x] Implement connection screen and fail-closed gateway API service.
- [x] Remove unsafe direct MTAPI credential calls and symbol/stop rewriting from the web app.
- [x] Test connection failure and trading safety rules.
- [x] Document exact PHP session issuance blocker and unverified contracts.
- [ ] Enable live connection, real account/symbol reads and secure per-client token storage — blocked by session.php's email/admin_id requirement and missing PHP source/contracts.
- [ ] Enable gateway trading — blocked by absent documented PHP order endpoint.