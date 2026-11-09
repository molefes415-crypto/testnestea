# MT5 gateway connection

- [x] Restore the neon MT5 ACCOUNT / MT5 Login Details appearance.
- [x] Implement uploaded single-file link/account/proxy contract; never persist the password.
- [x] Remove obsolete multi-file gateway blocker and test contract/error handling.
- [x] Review Claude troubleshooting notes; verify gateway health and browser access without resetting accounts.
- [x] Preserve gateway rejection status and distinguish blocked browser requests from broker failures.
- [x] Prepare corrected PHP gateway without subscription checks, retaining personal-token access and rejecting unsafe account replacement.
- [ ] Deploy free MT5 linking — upload the corrected mt5_gateway.php to the PHP host; this workspace cannot deploy to that host.
- [ ] Verify live JustMarkets connection and account reads — both website origins now pass; subscription-gated linking and unavailable demo credentials prevent verification.
- [ ] Connect live trading to the main app — wait for a reachable gateway and verified demo connection; the existing app trade path remains disabled.