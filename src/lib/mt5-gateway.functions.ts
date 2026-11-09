import { createServerFn } from "@tanstack/react-start";
import { MT5_SESSION_BLOCKER } from "./mt5-contract";

// Public read-only capability probe. Receives no credentials or session handles.
// Do not add connect.php calls until its actual PHP contract and independent
// client-bound session issuance have been supplied and verified.
export const inspectMT5Gateway = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const response = await fetch("https://tradenestea.com/admin/api/mt5/session.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    // Only read the known missing-fields diagnostic; never return raw gateway
    // responses, headers, tokens, or other clients' data.
    const text = await response.text();
    const requiresEmailLogin = /email/i.test(text) && /admin_id/i.test(text);
    return {
      connected: false as const,
      code: requiresEmailLogin ? "MT5_SESSION_REQUIRES_APP_LOGIN" : "MT5_CONTRACT_UNVERIFIED",
      endpoint: "session.php" as const,
      message: requiresEmailLogin ? MT5_SESSION_BLOCKER : "MT5 session issuance is not verified. Connection remains disabled until the gateway contract is confirmed.",
    };
  } catch {
    return { connected: false as const, code: "MT5_GATEWAY_UNAVAILABLE", endpoint: "session.php" as const, message: "The MT5 session service could not be reached. No account was connected." };
  }
});