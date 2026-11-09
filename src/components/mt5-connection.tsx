import { useMemo, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, LockKeyhole, Plug, Server, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inspectMT5Gateway } from "@/lib/mt5-gateway.functions";
import { createMT5Service } from "@/lib/mt5-service";

export function MT5Connection() {
  const inspect = useServerFn(inspectMT5Gateway);
  const service = useMemo(() => createMT5Service(inspect), [inspect]);
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
      const result = await service.connect({ server, accountNumber, password });
      setMessage(result.message);
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
        <header className="flex items-center gap-3 border-b border-border pb-5">
          <img src="/tradenest-logo.png" alt="Trade Nest EA" className="size-11 rounded-md object-contain" />
          <div><p className="text-sm font-semibold">EXPERT MOBILE VPS</p><p className="text-xs text-muted-foreground">Trade Nest EA</p></div>
          <ShieldCheck className="ml-auto size-5 text-primary" />
        </header>
        <div className="py-7">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Server className="size-4" /> METATRADER 5</div>
          <h1 className="text-3xl font-semibold">Connect your MT5 account</h1>
          <div role="status" className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><span className="size-2 rounded-full bg-muted-foreground" />{loading ? "Checking connection availability…" : "Not connected"}</div>
        </div>
        <form onSubmit={connect} className="space-y-5">
          <div className="space-y-2"><label htmlFor="broker-server" className="text-sm font-medium">Broker server</label><Input id="broker-server" value={server} onChange={e => setServer(e.target.value)} required maxLength={150} autoComplete="off" className="h-12 bg-card" placeholder="Broker server name" /></div>
          <div className="space-y-2"><label htmlFor="mt5-account" className="text-sm font-medium">MT5 account number</label><Input id="mt5-account" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required inputMode="numeric" pattern="[0-9]{1,20}" maxLength={20} autoComplete="off" className="h-12 bg-card" placeholder="Account number" /></div>
          <div className="space-y-2"><label htmlFor="mt5-password" className="text-sm font-medium">MT5 trading password</label><div className="relative"><Input id="mt5-password" value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required maxLength={256} autoComplete="off" className="h-12 bg-card pr-12" /><Button type="button" variant="ghost" size="icon" title={showPassword ? "Hide password" : "Show password"} aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1.5">{showPassword ? <EyeOff /> : <Eye />}</Button></div></div>
          {message && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm leading-relaxed text-foreground">{message}</div>}
          <Button type="submit" size="lg" className="h-12 w-full" disabled={loading}><Plug />{loading ? "Checking…" : "Connect"}</Button>
        </form>
        <section className="mt-8 border-t border-border pt-6" aria-label="Connected account">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-sm font-semibold">Connected account</h2><LockKeyhole className="size-4 text-muted-foreground" /></div>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm">
            {["Broker", "Account number", "Balance", "Equity", "Margin", "Broker symbols"].map(label => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">—</dd></div>)}
          </dl>
        </section>
      </div>
    </main>
  );
}