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

`session.php` is the session-issuance blocker. Preserve its current email/admin_id login behavior for existing callers. Add a **separate MT5-session issuance branch in this same endpoint** that is authenticated by a verified client identity independently of app email login. Do not merely delete the email/admin_id validation or mint anonymous unrestricted tokens.

The PHP owner must define and document how this identity is verified, issue an expiring opaque MT5 token bound to that verified client, and enforce that ownership in `connect.php`, `account.php`, and `symbols.php`. A submitted email, account number, admin_id or device ID alone is not proof of identity. Any gateway admin credential must remain in the PHP server or a server-side application proxy, never in frontend code.

Supply the actual PHP source or contract for:

- the independent session-issuance branch, accepted encoding and authentication;
- session token transport and expiration/revocation;
- exact `connect.php` request fields and success payload;
- `account.php` account identity, balance, equity, margin and currency payload;
- `symbols.php` actual broker symbol payload;
- an existing documented order endpoint, if trading is required (none of the four supplied endpoints is an order endpoint).

The precise PHP patch cannot be authored without its source. The description above is the required behavior, **not an invented request contract**.

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

Live connection, account retrieval, broker-symbol retrieval and trading are **not verified or enabled** while session issuance and the protected endpoint contracts are unresolved. Existing app email login was not changed. Native Android's prior MTAPI files were not rewritten as undocumented PHP clients.