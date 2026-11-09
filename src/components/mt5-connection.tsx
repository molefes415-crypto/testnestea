import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Plus, RefreshCw, ShieldCheck, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createMT5Service } from "@/lib/mt5-service";
import { type MT5Account, readExistingMT5Identity } from "@/lib/mt5-contract";
import { ACTIVE_KEY, SAVED_KEY, parseSaved, removeSaved, upsertSaved, type SavedMT5Account } from "@/lib/mt5-saved-accounts";
import mt5Logo from "@/assets/mt5.png.asset.json";
import justMarketsLogo from "@/assets/brokers/justmarkets-transparent.png";
import exnessLogo from "@/assets/brokers/exness.svg.asset.json";
import icMarketsLogo from "@/assets/brokers/ic-markets.png.asset.json";
import pepperstoneLogo from "@/assets/brokers/pepperstone.svg.asset.json";
import razorMarketsLogo from "@/assets/brokers/razor-markets.png.asset.json";
import accuMarketsLogo from "@/assets/brokers/accumarkets.png.asset.json";
import derivLogo from "@/assets/brokers/deriv.png.asset.json";

const brokers = [
  { pattern: /justmarkets/i, name: "JustMarkets", logo: justMarketsLogo },
  { pattern: /exness|exnes/i, name: "Exness", logo: exnessLogo.url },
  { pattern: /razor[\s_-]*markets/i, name: "Razor Markets", logo: razorMarketsLogo.url },
  { pattern: /accu[\s_-]*markets/i, name: "AccuMarkets", logo: accuMarketsLogo.url },
  { pattern: /deriv/i, name: "Deriv", logo: derivLogo.url },
  { pattern: /icmarkets|ic markets/i, name: "IC Markets", logo: icMarketsLogo.url },
  { pattern: /pepperstone/i, name: "Pepperstone", logo: pepperstoneLogo.url },
  { pattern: /metaquotes/i, name: "MetaQuotes Software Corp.", logo: mt5Logo.url },
];
function brokerName(server: string) { return brokers.find(b => b.pattern.test(server))?.name ?? server; }
function BrokerLogo({ server, large = false }: { server: string; large?: boolean }) {
  const broker = brokers.find(b => b.pattern.test(server));
  return <img src={broker?.logo ?? mt5Logo.url} alt={broker ? `${broker.name} logo` : "MetaTrader 5"} className={large ? "mx-auto h-16 w-24 object-contain" : "mt-1 h-11 w-12 object-contain"} />;
}

type Status = "checking" | "verified" | "expired";

function MT5Background() {
  const ref = useRef<HTMLDivElement>(null);
  const [video, setVideo] = useState<string | null>(null);
  useEffect(() => {
    const apply = (data: { accent?: unknown; image?: unknown; video?: unknown }) => {
      if (typeof data.accent === "string" && CSS.supports("color", data.accent)) document.documentElement.style.setProperty("--mt5-theme-accent", data.accent);
      const media = (value: unknown) => typeof value === "string" && /^(https?:\/\/|\/|data:image\/|data:video\/|blob:)/.test(value) ? value : null;
      const image = media(data.image);
      if (ref.current) ref.current.style.backgroundImage = image ? `url(${JSON.stringify(image)})` : "none";
      setVideo(media(data.video));
    };
    try { apply(JSON.parse(localStorage.getItem("appThemeColor") || "{}")); } catch { /* Use default theme. */ }
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || event.data?.type !== "tn-mt5-appearance") return;
      apply(event.data);
    };
    window.addEventListener("message", receive);
    if (window.parent !== window) window.parent.postMessage({ type: "tn-mt5-ready" }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);
  return <div ref={ref} className="mt5-background" aria-hidden="true">{video && <video src={video} autoPlay loop muted playsInline />}</div>;
}

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
  const [view, setView] = useState<"accounts" | "login">("accounts");
  const [details, setDetails] = useState<Record<string, MT5Account>>({});

  function persist(list: SavedMT5Account[]) {
    setSaved(list);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  }
  function activate(t: string, info: MT5Account) {
    setToken(t);
    setAccount(info);
    setDetails(d => ({ ...d, [t]: info }));
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
          setDetails(d => ({ ...d, [a.token]: info }));
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
      setView("accounts");
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
      setView("login");
      setMessage(`Session for ${a.login} expired. Enter its trading password above to log in again.`);
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

  const formatMoney = (info: MT5Account) => `${new Intl.NumberFormat("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(info.balance)} ${info.currency}`;
  const otherAccounts = saved.filter(a => a.token !== token);
  const accountAlerts = <>{message && <div role="alert" className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">{message}</div>}{notice && <div role="status" className="mb-4 text-sm text-primary">{notice}</div>}</>;

  if (view === "accounts") return (
    <main className="mt5-workspace mt5-accounts min-h-screen bg-background text-foreground">
      <MT5Background />
      <div className="mx-auto max-w-lg px-3 pb-8">
        <header className="flex h-18 items-center gap-3 px-2">
          <h1 className="flex-1 text-xl font-semibold">Accounts</h1>
          <ShieldCheck className="size-6 text-muted-foreground" aria-label="Personal account access" />
          <Button variant="ghost" size="icon" aria-label="Refresh accounts" title="Refresh accounts" disabled={Boolean(busy) || saved.length === 0} onClick={async () => {
            setBusy("refresh");
            await Promise.all(saved.map(async a => {
              try {
                const info = await service.account(a.token);
                if (info.login !== a.login) throw new Error("Account mismatch");
                setDetails(d => ({ ...d, [a.token]: info }));
                setStatus(s => ({ ...s, [a.token]: "verified" }));
                if (a.token === token) activate(a.token, info);
              } catch {
                setStatus(s => ({ ...s, [a.token]: "expired" }));
                if (a.token === token) clearActive();
              }
            }));
            setBusy("");
          }}><RefreshCw className={busy === "refresh" ? "animate-spin" : ""} /></Button>
          <Button variant="ghost" size="icon" aria-label="Add MT5 account" title="Add MT5 account" onClick={() => { setMessage(""); setNotice(""); setView("login"); }}><Plus className="size-7" /></Button>
        </header>
        {accountAlerts}
        {account ? <section className="mt5-account-block mb-5 px-5 pb-3 pt-8 text-center" aria-label="Active account">
          {/demo/i.test(account.server) && <span className="mt5-account-ribbon">Demo</span>}
          <BrokerLogo server={account.server} large />
          <h2 className="mt-4 text-xl font-semibold break-words">{account.name || "MetaTrader 5"}</h2>
          <p className="mt-1 text-base text-primary">{brokerName(account.server)}</p>
          <p className="mt-4 break-words text-sm text-muted-foreground">{account.login} — {account.server}</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-xs text-muted-foreground"><CheckCircle2 className="size-3" />Connected</p>
          <p className="mt-4 text-3xl font-medium">{formatMoney(account)}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
            <div><dt className="text-xs text-muted-foreground">Equity</dt><dd className="mt-1">{account.equity === undefined ? "—" : account.equity.toFixed(2)} {account.currency}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Margin</dt><dd className="mt-1">{account.margin === undefined ? "—" : account.margin.toFixed(2)} {account.currency}</dd></div>
          </dl>
          <div className="mt-2 flex justify-end"><Button variant="ghost" size="sm" disabled={Boolean(busy)} aria-label={`Unlink ${account.login}`} onClick={() => { const entry = saved.find(a => a.token === token); if (entry) void unlink(entry); }}><Unlink className="size-4" />Unlink</Button></div>
        </section> : <section className="mt5-account-block mb-5 py-9 text-center" aria-label="Connection status"><img src={mt5Logo.url} alt="MetaTrader 5" className="mx-auto size-14 object-contain" /><h2 className="mt-4 text-lg font-semibold">MT5 Disconnected</h2><p className="mt-2 text-sm text-muted-foreground">No active account</p></section>}
        <section aria-label="Saved accounts">
          <h2 className="mb-3 px-2 text-base text-muted-foreground">Connect to:</h2>
          {otherAccounts.length === 0 ? <p className="px-2 py-4 text-sm text-muted-foreground">{saved.length ? "No other saved accounts" : "No saved accounts"}</p> : <ul className="space-y-4">{otherAccounts.map(a => {
            const info = details[a.token];
            const s = status[a.token] ?? "checking";
            return <li key={a.token} className="mt5-account-block">
              {/demo/i.test(a.server) && <span className="mt5-account-ribbon pointer-events-none">Demo</span>}
              <Button variant="ghost" className="mt5-account-select gap-4" disabled={Boolean(busy) || s === "checking"} onClick={() => void switchTo(a)} aria-label={`Switch to ${a.login}`}>
                <BrokerLogo server={a.server} />
                <span className="min-w-0 flex-1"><span className="block break-words text-lg font-semibold">{info?.name || `MT5 Account ${a.login}`}</span><span className="mt-1 block text-base text-primary">{brokerName(a.server)}</span><span className="mt-1 block break-words text-sm text-muted-foreground">{a.login} — {a.server}</span><span className="mt-3 block text-xl font-normal text-muted-foreground">{s === "verified" && info ? formatMoney(info) : s === "expired" ? "Session expired" : "Checking…"}</span></span>
              </Button>
              <div className="flex items-center justify-between px-4 pb-2"><span className="text-xs text-muted-foreground">{s === "verified" ? "Verified" : s === "expired" ? "Log in again" : "Verifying session"}</span><Button type="button" variant="ghost" size="sm" disabled={Boolean(busy)} onClick={() => void unlink(a)} aria-label={`Unlink ${a.login}`}><Unlink className="size-4" />Unlink</Button></div>
            </li>;
          })}</ul>}
        </section>
      </div>
    </main>
  );

  return (
    <main className="mt5-workspace min-h-screen bg-background px-5 py-8 text-foreground">
      <MT5Background />
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex items-center gap-3"><Button type="button" variant="ghost" size="icon" aria-label="Back to accounts" onClick={() => setView("accounts")}><ArrowLeft /></Button><h1 className="text-base font-semibold">Add account</h1></div>
        <div className="mt5-neon-header py-5 text-center font-bold text-primary">MT5 ACCOUNT</div>
        <div className="py-6 text-center">
          <div role="status" className="mb-6 flex items-center justify-center gap-2 text-xs font-semibold uppercase text-muted-foreground"><span className="size-2 rounded-full bg-primary" />{loading ? "Verifying login…" : account ? `MT5 Connected · ${account.login}` : "MT5 Disconnected"}</div>
          <img src={mt5Logo.url} alt="MT5" className="mx-auto mb-5 size-22 rounded-lg object-contain" />
          <h2 className="mt5-neon-title text-base font-black uppercase">MT5 Login Details</h2>
        </div>
        <form onSubmit={connect} className="space-y-4">
          <div className="space-y-2"><label htmlFor="broker-server" className="text-sm font-medium">Broker server</label><Input id="broker-server" value={server} onChange={e => setServer(e.target.value)} required maxLength={150} autoComplete="off" className="mt5-neon-field h-14 bg-card" placeholder="Search MT5 Broker Server..." /></div>
          <div className="space-y-2"><label htmlFor="mt5-account" className="text-sm font-medium">MT5 account number</label><Input id="mt5-account" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required inputMode="numeric" pattern="[0-9]{1,20}" maxLength={20} autoComplete="off" className="mt5-neon-field h-14 bg-card" placeholder="Login" /></div>
          <div className="space-y-2"><label htmlFor="mt5-password" className="text-sm font-medium">MT5 trading password</label><div className="relative"><Input id="mt5-password" value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} required maxLength={256} autoComplete="off" className="mt5-neon-field h-14 bg-card pr-12" /><Button type="button" variant="ghost" size="icon" title={showPassword ? "Hide password" : "Show password"} aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1.5">{showPassword ? <EyeOff /> : <Eye />}</Button></div></div>
          {message && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm leading-relaxed text-foreground">{message}</div>}
          {notice && <div role="status" className="rounded-md border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">{notice}</div>}
          <Button type="submit" size="lg" className="mt5-neon-field h-14 w-full bg-card uppercase text-foreground" disabled={loading}><LockKeyhole />{loading ? "Verifying Login…" : "Link MT5 Account Details"}</Button>
        </form>

      </div>
    </main>
  );
}
