import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, LockKeyhole, RefreshCw, Unlink, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMT5Service } from "@/lib/mt5-service";
import { type MT5Account, readExistingMT5Identity } from "@/lib/mt5-contract";
import { ACTIVE_KEY, SAVED_KEY, parseSaved, removeSaved, upsertSaved, type SavedMT5Account } from "@/lib/mt5-saved-accounts";

type Status = "checking" | "verified" | "expired";

export function MT5Connection() {
  const service = useMemo(() => createMT5Service(), []);
  const [account, setAccount] = useState<MT5Account | null>(null);
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState<SavedMT5Account[]>([]);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [server, setServer] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");

  function persist(list: SavedMT5Account[]) {
    setSaved(list);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  }
  function activate(t: string, info: MT5Account) {
    setToken(t);
    setAccount(info);
    localStorage.setItem(ACTIVE_KEY, t);
    localStorage.setItem("mt_connected_mt5", "true");
  }
  function clearActive() {
    setToken("");
    setAccount(null);
    localStorage.removeItem(ACTIVE_KEY);
    localStorage.removeItem("mt_connected_mt5");
  }

  // On open: verify every saved login with the gateway (session still valid?).
  useEffect(() => {
    let list = parseSaved(localStorage.getItem(SAVED_KEY));
    const active = localStorage.getItem(ACTIVE_KEY);
    setSaved(list);
    setStatus(Object.fromEntries(list.map(a => [a.token, "checking" as Status])));
    if (active && !list.some(a => a.token === active)) {
      service.account(active).then(info => {
        list = upsertSaved(list, { token: active, login: info.login, server: info.server, currency: info.currency });
        persist(list);
        setStatus(s => ({ ...s, [active]: "verified" }));
        activate(active, info);
      }).catch(() => clearActive());
    }
    list.forEach(a => {
      service.account(a.token)
        .then(info => {
          if (info.login !== a.login) throw new Error("mismatch");
          setStatus(s => ({ ...s, [a.token]: "verified" }));
          if (a.token === active) activate(a.token, info);
        })
        .catch(() => {
          setStatus(s => ({ ...s, [a.token]: "expired" }));
          if (a.token === active) clearActive();
        });
    });
  }, [service]);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setNotice("");
    try {
      const identity = readExistingMT5Identity(localStorage.getItem("userProfile"));
      if (!identity) {
        setMessage("Open MT5 from your signed-in Trade Nest EA app. Your existing email and mentor ID are required.");
        return;
      }
      // Gateway logs into the broker with these details — wrong password/server is rejected here.
      const result = await service.connect({ server, accountNumber, password }, identity);
      const info = await service.account(result.token);
      if (info.login !== Number(accountNumber)) throw new Error("Gateway returned a different account. Connection not confirmed.");
      const old = saved.find(a => a.login === info.login && a.server.toLowerCase() === info.server.toLowerCase());
      persist(upsertSaved(saved, { token: result.token, login: info.login, server: info.server, currency: info.currency }));
      setStatus(s => { const n = { ...s, [result.token]: "verified" as Status }; if (old) delete n[old.token]; return n; });
      activate(result.token, info);
      setNotice(`Login verified · ${info.server} · ${info.login}`);
      setServer("");
      setAccountNumber("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection could not be verified.");
    } finally {
      setPassword("");
      setLoading(false);
    }
  }

  async function switchTo(a: SavedMT5Account) {
    setBusy(a.token);
    setMessage("");
    setNotice("");
    try {
      const info = await service.account(a.token);
      if (info.login !== a.login) throw new Error("Gateway returned a different account.");
      setStatus(s => ({ ...s, [a.token]: "verified" }));
      activate(a.token, info);
      setNotice(`Switched to ${info.server} · ${info.login}`);
    } catch {
      setStatus(s => ({ ...s, [a.token]: "expired" }));
      setServer(a.server);
      setAccountNumber(String(a.login));
      setMessage(`Session for ${a.login} expired. Enter its trading password above to log in again.`);
      document.getElementById("mt5-password")?.focus();
    } finally {
      setBusy("");
    }
  }

  async function unlink(a: SavedMT5Account) {
    setBusy(a.token);
    setMessage("");
    setNotice("");
    try {
      if (status[a.token] !== "expired") await service.disconnect(a.token);
    } catch (error) {
      // If the session is already gone at the gateway, still remove it locally.
      if (!(error instanceof Error && /\((401|403|404)\)/.test(error.message))) {
        setMessage(error instanceof Error ? error.message : "Unlink failed.");
        setBusy("");
        return;
      }
    }
    persist(removeSaved(saved, a.token));
    if (a.token === token) clearActive();
    setNotice(`Unlinked ${a.login}. You can link it again any time.`);
    setBusy("");
  }

  return (
    <main className="mt5-workspace min-h-screen bg-background px-5 py-8 text-foreground">
      <div className="mx-auto max-w-lg">
        <div className="mt5-neon-header py-5 text-center font-bold text-primary">MT5 ACCOUNT</div>
        <div className="py-6 text-center">
          <div role="status" className="mb-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><span className="size-2 rounded-full bg-primary" />{loading ? "Verifying login…" : account ? `MT5 Connected · ${account.login}` : "MT5 Disconnected"}</div>
          <img src="/__l5e/assets-v1/1a3dc16d-74a5-4cbc-bd83-6c1a712d29e8/mt5.png" alt="MT5" className="mx-auto mb-5 size-22 rounded-lg object-contain" />
          <h1 className="mt5-neon-title text-base font-black uppercase">MT5 Login Details</h1>
        </div>
        <form onSubmit={connect} className="space-y-4">
          <div className="space-y-2"><label htmlFor="broker-server" className="text-sm font-medium">Broker server</label><Input id="broker-server" value={server} onChange={e => setServer(e.target.value)} required maxLength={150} autoComplete="off" className="mt5-neon-field h-14 bg-card" placeholder="Search MT5 Broker Server..." /></div>
          <div className="space-y-2"><label htmlFor="mt5-account" className="text-sm font-medium">MT5 account number</label><Input id="mt5-account" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required inputMode="numeric" pattern="[0-9]{1,20}" maxLength={20} autoComplete="off" className="mt5-neon-field h-14 bg-card" placeholder="Login" /></div>
          <div className="space-y-2"><label htmlFor="mt5-password" className="text-sm font-medium">MT5 trading password</label><div className="relative"><Input id="mt5-password" value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required maxLength={256} autoComplete="off" className="mt5-neon-field h-14 bg-card pr-12" /><Button type="button" variant="ghost" size="icon" title={showPassword ? "Hide password" : "Show password"} aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1.5">{showPassword ? <EyeOff /> : <Eye />}</Button></div></div>
          {message && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm leading-relaxed text-foreground">{message}</div>}
          {notice && <div role="status" className="rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">{notice}</div>}
          <Button type="submit" size="lg" className="mt5-neon-field h-14 w-full bg-card uppercase text-foreground" disabled={loading}><LockKeyhole />{loading ? "Verifying Login…" : "Link MT5 Account Details"}</Button>
        </form>

        {account && <section className="mt-8 border-t border-border pt-6" aria-label="Active account">
          <h2 className="mb-4 text-sm font-semibold">{account.server} · {account.login}</h2>
          <dl className="grid grid-cols-3 gap-3 text-sm">{[["Balance", account.balance], ["Equity", account.equity], ["Margin", account.margin]].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1">{value ?? "—"} {account.currency}</dd></div>)}</dl>
        </section>}

        <section className="mt-8 border-t border-border pt-6" aria-label="Saved accounts">
          <h2 className="mt5-neon-title mb-1 text-sm font-black uppercase">Logged-in Accounts</h2>
          <p className="mb-4 text-xs text-muted-foreground">Tap an account to switch. Passwords are never saved on this device.</p>
          {saved.length === 0 ? <p className="text-sm text-muted-foreground">No saved accounts yet. Link one above.</p> : (
            <ul className="space-y-3">
              {saved.map(a => {
                const s = status[a.token] ?? "checking";
                const active = a.token === token;
                return (
                  <li key={a.token} className={`mt5-neon-field flex items-center gap-3 rounded-lg bg-card p-3 ${active ? "ring-2 ring-primary" : ""}`}>
                    <button type="button" onClick={() => !active && switchTo(a)} disabled={busy === a.token} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <UserRound className="size-5 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{a.login}</span>
                        <span className="block truncate text-xs text-muted-foreground">{a.server}</span>
                        <span className={`mt-1 flex items-center gap-1 text-xs ${s === "expired" ? "text-destructive" : "text-muted-foreground"}`}>
                          {busy === a.token ? <><RefreshCw className="size-3 animate-spin" />Checking…</> : active ? <><CheckCircle2 className="size-3 text-primary" />Active</> : s === "verified" ? "Verified · tap to switch" : s === "expired" ? "Session expired · tap to log in again" : "Checking…"}
                        </span>
                      </span>
                    </button>
                    <Button type="button" variant="ghost" size="sm" disabled={busy === a.token} onClick={() => unlink(a)} aria-label={`Unlink ${a.login}`}><Unlink />Unlink</Button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
