# MT5 gateway connection

- [x] Restore the neon MT5 ACCOUNT / MT5 Login Details appearance.
- [x] Implement uploaded single-file link/account/proxy contract; never persist the password.
- [x] Remove obsolete multi-file gateway blocker and test contract/error handling.
- [x] Review Claude troubleshooting notes; verify gateway health and browser access without resetting accounts.
- [x] Preserve gateway rejection status and distinguish blocked browser requests from broker failures.
- [ ] Verify live JustMarkets connection and account reads — gateway health is 200, but PHP allowed_origins omits https://tradnestea.app and https://www.tradnestea.app; demo credentials are unavailable.
- [ ] Connect live trading to the main app — wait for a reachable gateway and verified demo connection; the existing app trade path remains disabled.