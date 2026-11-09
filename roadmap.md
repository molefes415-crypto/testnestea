# MT5 gateway connection

- [x] Map the seven debit-card reference positions to broker name/logo, balance/equity/margin, holder, first four login digits, account type and colored connection status.

- [x] Make Demo ribbons red, Live ribbons black with red border lines, and connected check circles green.

- [x] Apply theme-aware blurred glass, shared backgrounds, box-free logos, and pill navigation (verified together on mobile and desktop with fixture accounts).

- [x] Match the supplied MT5 account-list layout with dark blocks and broker logos; + opens login and verified login returns to accounts (browser-tested with fixtures; live broker login remains unverified).

- [x] Restore the neon MT5 ACCOUNT / MT5 Login Details appearance.
- [x] Implement uploaded single-file link/account/proxy contract; never persist the password.
- [x] Remove obsolete multi-file gateway blocker and test contract/error handling.
- [x] Review Claude troubleshooting notes; verify gateway health and browser access without resetting accounts.
- [x] Preserve gateway rejection status and distinguish blocked browser requests from broker failures.
- [x] Prepare corrected PHP gateway without subscription checks, retaining personal-token access and rejecting unsafe account replacement.
- [ ] Deploy free MT5 linking — upload the corrected mt5_gateway.php to the PHP host; this workspace cannot deploy to that host.
- [ ] Verify live JustMarkets connection and account reads — both website origins now pass; subscription-gated linking and unavailable demo credentials prevent verification.
- [ ] Connect live trading to the main app — wait for a reachable gateway and verified demo connection; the existing app trade path remains disabled.