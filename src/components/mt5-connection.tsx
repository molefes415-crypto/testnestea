import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, Plug, Server, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMT5Service } from "@/lib/mt5-service";
import { type MT5Account, readExistingMT5Identity } from "@/lib/mt5-contract";

export function MT5Connection() {
  const service = useMemo(() => createMT5Service(), []);
  const [account, setAccount] = useState<MT5Account | null>(null);
  const [token, setToken] = useState("");
  useEffect(() => {
    const stored = localStorage.getItem("mt_accountId_mt5");
    if (!stored) return;
    service.account(stored).then(info => { setToken(stored); setAccount(info); }).catch(error => { setMessage(error.message); localStorage.removeItem("mt_connected_mt5"); });
  }, [service]);
  const [server, setServer] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  async function connect(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const identity = readExistingMT5Identity(localStorage.getItem("userProfile"));
      if (!identity) {
        setMessage("Open MT5 from your signed-in Trade Nest EA app. Your existing email and mentor ID are required.");
        return;
      }
      const result = await service.connect({ server, accountNumber, password }, identity);
      localStorage.setItem("mt_accountId_mt5", result.token);
      setToken(result.token);
      const info = await service.account(result.token);
      if (info.login !== Number(accountNumber)) throw new Error("Gateway returned a different account. Connection not confirmed.");
      setAccount(info);
      localStorage.setItem("mt_connected_mt5", "true");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection could not be verified.");
    } finally {
      setPassword("");
      setLoading(false);
    }
  }
  return (
    <main className="mt5-workspace min-h-screen bg-background px-5 py-8 text-foreground">
      <div className="mx-auto max-w-lg">
        <div className="mt5-neon-header py-5 text-center font-bold text-primary">MT5 ACCOUNT</div>
        <div className="py-6 text-center">
          <div role="status" className="mb-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><span className="size-2 rounded-full bg-primary" />{loading ? "Connecting to account…" : account ? "MT5 Connected" : "MT5 Disconnected"}</div>
          <img src="/__l5e/assets-v1/1a3dc16d-74a5-4cbc-bd83-6c1a712d29e8/mt5.png" alt="MT5" className="mx-auto mb-5 size-22 rounded-lg object-contain" />
          <h1 className="mt5-neon-title text-base font-black uppercase">MT5 Login Details</h1>
        </div>
        <form onSubmit={connect} className="space-y-4">
          <div className="space-y-2"><label htmlFor="broker-server" className="text-sm font-medium">Broker server</label><Input id="broker-server" value={server} onChange={e => setServer(e.target.value)} required maxLength={150} autoComplete="off" className="mt5-neon-field h-14 bg-card" placeholder="Search MT5 Broker Server..." /></div>
          <div className="space-y-2"><label htmlFor="mt5-account" className="text-sm font-medium">MT5 account number</label><Input id="mt5-account" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required inputMode="numeric" pattern="[0-9]{1,20}" maxLength={20} autoComplete="off" className="mt5-neon-field h-14 bg-card" placeholder="Login" /></div>
          <div className="space-y-2"><label htmlFor="mt5-password" className="text-sm font-medium">MT5 trading password</label><div className="relative"><Input id="mt5-password" value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required maxLength={256} autoComplete="off" className="mt5-neon-field h-14 bg-card pr-12" /><Button type="button" variant="ghost" size="icon" title={showPassword ? "Hide password" : "Show password"} aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1.5">{showPassword ? <EyeOff /> : <Eye />}</Button></div></div>
          {message && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm leading-relaxed text-foreground">{message}</div>}
          <Button type="submit" size="lg" className="mt5-neon-field h-14 w-full bg-card uppercase text-foreground" disabled={loading}><LockKeyhole />{loading ? "Connecting to Account…" : "Link MT5 Account Details"}</Button>
        </form>
        {account && <section className="mt-8 border-t border-border pt-6" aria-label="Connected account">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">{account.server} · {account.login}</h2><Button variant="ghost" onClick={async () => { try { await service.disconnect(token); setAccount(null); setToken(""); localStorage.removeItem("mt_accountId_mt5"); localStorage.removeItem("mt_connected_mt5"); } catch (error) { setMessage(error instanceof Error ? error.message : "Disconnect failed."); } }}>Unlink</Button></div>
          <dl className="grid grid-cols-3 gap-3 text-sm">{[["Balance", account.balance], ["Equity", account.equity], ["Margin", account.margin]].map(([label,value]) => <div key={String(label)}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1">{value ?? "—"} {account.currency}</dd></div>)}</dl>
        </section>}
      </div>
    </main>
  );
}