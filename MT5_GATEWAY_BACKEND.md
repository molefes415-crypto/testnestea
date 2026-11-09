# Expert Mobile VPS — PHP MT5 gateway integration

## Verified on 9 November 2026

Base: `https://tradenestea.com/admin/api/mt5/`.

| Endpoint | Verified method | Unauthenticated result |
| --- | --- | --- |
| `session.php` | POST | HTTP 400: `Valid email and admin_id are required.` |
| `connect.php` | POST | HTTP 401: `A valid MT5 session token is required.` |
| `account.php` | GET | HTTP 401: `A valid MT5 session token is required.` |
| `symbols.php` | GET | HTTP 401: `A valid MT5 session token is required.` |

These responses verify methods and rejection behavior only. Empty POST probes do **not** establish accepted body encoding. The PHP source is not in this project. Token transport, connection field names, and successful account/symbol payloads are unknown. No undocumented provider endpoints or invented request fields are used.

## Exact responsible endpoint and required backend change

Use the existing logged-in app user's email and admin_id for `session.php`; no separate login or independent issuance branch is requested. The existing app stores these as `userProfile.email` and `userProfile.name` (with `adminId` as an existing fallback). The MT5 screen now reads these fields without modifying login or profile storage.

The remaining blocker is **missing source/contracts**, not the requirement to use email/admin_id. Browser profile values can be edited and are not proof of identity. Inspect the actual PHP authorization and client ownership checks before enabling issuance. Tokens must stay server-side or in a secure server-managed session; an admin credential must never appear in frontend code.

Supply the actual PHP source or contract for:

- existing session issuance, accepted encoding, exact token success field and ownership/authentication checks;
- session token expiration/revocation; the user specifies Authorization: Bearer for connect.php;
- exact `connect.php` request fields and success payload;
- `account.php` account identity, balance, equity, margin and currency payload;
- `symbols.php` actual broker symbol payload;
- an existing documented order endpoint, if trading is required (none of the four supplied endpoints is an order endpoint).

The precise PHP patch cannot be authored without its source. Success fields and connection field names are **not invented**.

## Implemented app behavior

- Existing MetaTrader tab opens the dedicated `/mt5` connection screen.
- Broker server is unrestricted text; no JustMarkets-only list.
- MT5 account number, masked trading password, connection status and account metric slots are present.
- Connect performs only a credential-free server-side session capability probe. Password is cleared after the attempt. No broker credentials are submitted until the PHP contract is established.
- No fake connection, account metrics, symbols, token or trade ticket is generated. Account/symbol/trade service methods fail closed.
- Legacy browser-stored passwords/tokens/connection flags are removed when the app loads; old direct MTAPI connection and order requests are disabled.
- Web signal symbol matching is case-sensitive and exact. No suffix rewriting or stop-loss/take-profit retry modifications remain in the web gateway path.

## Remaining work after PHP correction

Implement the documented calls server-side, verify the independent client identity on every request, persist the opaque token encrypted against that owner (or use a secure server-managed session), never return it to legacy localStorage, and load real account details and symbols only after verified connection success. Any order must check session ownership and exact broker symbol membership, send the original stops unchanged, and surface sanitized broker rejection messages without credential leakage.

Live connection, account retrieval and broker-symbol retrieval are **not verified or enabled** while PHP contracts and token ownership are unresolved. No usable existing JustMarkets demo credential set was found in available text uploads or credential environment variables. Existing app email login, mentors, licence keys and signal APIs were not changed in this follow-up. Native Android's prior MTAPI files were not rewritten as undocumented PHP clients.