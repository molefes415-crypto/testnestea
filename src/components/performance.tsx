import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Activity, ArrowDownLeft, ArrowUpRight, Layers3, RefreshCw, History, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountCardFace, MT5Background } from "@/components/mt5-connection";
import { createMT5Service } from "@/lib/mt5-service";
import { ACTIVE_KEY, SAVED_KEY, parseSaved } from "@/lib/mt5-saved-accounts";
import type { MT5Account } from "@/lib/mt5-contract";
import { accountPerformance, floatingPerformance, readAccountHistory, readPositions, positionSide, type Position, type AccountDeal } from "@/lib/mt5-performance";
import { startPositionStream } from "@/lib/mt5-position-stream";

export function Performance() {
  const service = useMemo(() => createMT5Service(), []);
  const [account, setAccount] = useState<MT5Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [deals, setDeals] = useState<AccountDeal[]>([]);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [busy, setBusy] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [positionError, setPositionError] = useState("");
  const [positionTime, setPositionTime] = useState<Date | null>(null);
  const sequence = useRef(0);
  const loading = useRef(false);
  const displayedToken = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    const run = ++sequence.current;
    const token = localStorage.getItem(ACTIVE_KEY);
    const current = () => run === sequence.current && token === localStorage.getItem(ACTIVE_KEY);
    setBusy(true); setError(""); setHistoryError("");
    if (displayedToken.current !== token) {
      displayedToken.current = token;
      setAccount(null); setPositions([]); setDeals([]); setUpdated(null);
      setPositionTime(null); setPositionError("");
    }
    try {
      if (!token) throw new Error("No connected MT5 account.");
      const info = await service.account(token);
      const saved = parseSaved(localStorage.getItem(SAVED_KEY)).find(a => a.token === token);
      if (info.connected === false || (saved && (saved.login !== info.login || saved.server.toLowerCase() !== info.server.toLowerCase()))) throw new Error("MT5 account could not be verified. Reconnect in MetaTrader.");
      if (!current()) return;
      const results = await Promise.allSettled([service.positions(token), service.history(token)]);
      if (!current()) return;
      if (results[0].status === "rejected") throw results[0].reason;
      const nextPositions = readPositions(results[0].value);
      setAccount(info);
      setPositions(nextPositions);
      setPositionTime(new Date()); setPositionError("");
      try {
        if (results[1].status === "rejected") throw results[1].reason;
        setDeals(readAccountHistory(results[1].value));
      } catch (e) { setDeals([]); setHistoryError(e instanceof Error ? e.message : "Trade history unavailable."); }
      setUpdated(new Date());
    } catch (e) { if (current()) setError(e instanceof Error ? e.message : "Performance unavailable."); }
    finally { if (run === sequence.current) { loading.current = false; setBusy(false); } }
  }, [service]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60000);
    const changed = (event: StorageEvent) => {
      if (event.key !== ACTIVE_KEY && event.key !== SAVED_KEY) return;
      if (displayedToken.current === localStorage.getItem(ACTIVE_KEY)) return;
      sequence.current++; loading.current = false;
      setAccount(null); setPositions([]); setDeals([]); setUpdated(null); void refresh();
    };
    window.addEventListener("storage", changed);
    return () => { sequence.current++; loading.current = false; clearInterval(timer); window.removeEventListener("storage", changed); };
  }, [refresh]);
  useEffect(() => {
    const token = displayedToken.current;
    if (!account || !token) return;
    return startPositionStream({
      active: () => !document.hidden && !loading.current && token === localStorage.getItem(ACTIVE_KEY),
      read: () => service.positions(token),
      apply: data => { setPositions(readPositions(data)); setPositionTime(new Date()); setPositionError(""); },
      failed: e => setPositionError(e instanceof Error ? e.message : "Live broker readings unavailable."),
    });
  }, [account?.login, account?.server, service]);
  const stats = accountPerformance(deals);
  const floating = floatingPerformance(positions);
  const historyAvailable = account && updated && !error && !historyError;
  const available = historyAvailable && deals.length > 0;
  const money = (value: number) => new Intl.NumberFormat("en", {minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
  const signed = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
  const tone = (value: number) => value < 0 ? "performance-loss" : value > 0 ? "performance-profit" : "";
  return <main className="mt5-workspace mt5-accounts performance-page min-h-screen text-foreground">
    <MT5Background />
    <div className="mx-auto max-w-3xl px-4 pb-10">
      <header className="performance-header"><span className="performance-heading-icon"><Activity/></span><div className="flex-1"><p className="performance-eyebrow">ACCOUNT OVERVIEW</p><h1 className="text-xl font-semibold">Performance</h1></div><Button variant="ghost" size="icon" aria-label="Refresh performance" title="Refresh performance" disabled={busy} onClick={() => void refresh()}><RefreshCw className={busy ? "animate-spin" : ""}/></Button></header>
      {account && <section className="mt5-account-block mt5-bank-card" aria-label="Connected account"><AccountCardFace login={account.login} server={account.server} info={account} status="verified"/></section>}
      {busy && !account && <p role="status" className="my-4 text-sm text-muted-foreground">Updating account and trades…</p>}
      {error && <div role="alert" className="my-4 text-sm text-destructive">{error} {!account && <Button variant="link" asChild><Link to="/mt5">MetaTrader accounts</Link></Button>}</div>}
      {historyError && <p role="alert" className="my-4 text-sm text-destructive">{historyError}</p>}
      <section className="performance-section" aria-label="Open positions"><div className="performance-section-heading"><h2><Layers3/>Open positions</h2><span className="performance-count">{updated && !error ? positions.length : "—"} open</span></div>
        {positionTime && <p className="mb-3 text-xs text-muted-foreground">{positionError ? "Last broker reading" : "Broker reading"} {positionTime.toLocaleTimeString()}</p>}
        {positionError && <p role="alert" className="mb-3 text-xs text-destructive">{positionError}</p>}
        {updated && !error && <div className="performance-floating"><div><span className="text-xs text-muted-foreground">Floating profit / loss</span><p className="performance-eyebrow">{account?.currency}</p></div><strong className={tone(floating.profit)}>{signed(floating.profit)}</strong></div>}
        {updated && !error && floating.swap !== 0 && <div className="mb-3 flex justify-between text-xs text-muted-foreground"><span>Swap · {account?.currency}</span><span className={tone(floating.swap)}>{signed(floating.swap)}</span></div>}
        <div className="performance-position-list">{positions.map(p => <article key={p.ticket} className="performance-position" aria-label={`${p.symbol} position ${p.ticket}`}>
          <div className="performance-position-top"><span className={`performance-side-icon ${p.type === 0 ? 'is-buy' : p.type === 1 ? 'is-sell' : ''}`}>{p.type === 0 ? <ArrowUpRight/> : p.type === 1 ? <ArrowDownLeft/> : <Activity/>}</span><div className="min-w-0 flex-1"><h3 className="font-semibold break-all">{p.symbol}</h3><p className="performance-position-meta"><span className={p.type === 0 ? 'performance-profit' : p.type === 1 ? 'performance-loss' : ''}>{positionSide(p)}</span><span>{p.volume} lots</span></p></div><div className="performance-position-pnl"><strong className={tone(p.profit)}>{signed(p.profit)}</strong><span>{account?.currency}</span></div></div>
          <div className="performance-position-footer"><span>#{p.ticket}</span>{p.comment && <span className="performance-bot-name">{p.comment}</span>}{p.swap !== undefined && p.swap !== 0 && <span>Swap {signed(p.swap)}</span>}</div>
        </article>)}</div>
        {!positions.length && <p className="py-4 text-sm text-muted-foreground">{updated && !error ? "No open positions" : "Open positions unavailable"}</p>}
      </section>
      <section className="performance-section" aria-label="Account trade history"><div className="performance-section-heading"><h2><History/>Account trade history</h2></div><p className="mb-4 break-words text-xs text-muted-foreground">All account trades · Net after broker fees</p>
        <div className="performance-history-list">{historyAvailable && stats.history.map(t => <article key={t.ticket} className="performance-trade" aria-label={`${t.symbol} deal ${t.ticket}`}><div><h3 className="break-all font-semibold">{t.symbol}</h3><p className="text-xs text-muted-foreground">{positionSide(t)} · {t.volume} lots · #{t.ticket}</p>{t.comment && <p className="mt-1 text-xs text-muted-foreground">{t.comment}</p>}<p className="mt-1 text-xs text-muted-foreground">{t.time ? new Date(t.time * 1000).toLocaleString("en-ZA", {timeZone:"Africa/Johannesburg"}) + " SAST" : "—"}</p></div><div className="text-right"><strong className={tone(t.net)}>{t.entry === 0 && t.net === 0 ? "—" : signed(t.net)}</strong><p className="mt-1 text-xs text-muted-foreground">{t.entry === 0 ? "Opening deal" : t.entry === undefined ? "Deal net P/L" : t.net > 0 ? "Profit" : t.net < 0 ? "Loss" : "Break-even"}</p>{t.entry !== 0 && <span className="text-xs text-muted-foreground">{account?.currency}</span>}</div></article>)}</div>
        {(!available || !stats.history.length) && <p className="py-4 text-sm text-muted-foreground">{historyAvailable ? "No trading deals returned by the broker yet." : "Account trade history unavailable"}</p>}
      </section>
      <section className="performance-summary" aria-label="Account performance totals"><div className="performance-section-heading"><h2><TrendingUp/>Earnings overview</h2></div>
        <div className="performance-net"><span className="text-sm text-muted-foreground">Total account net earnings</span><strong className={available ? tone(stats.net) : ""}>{available ? signed(stats.net) : "—"}</strong><span className="text-xs text-muted-foreground">{account?.currency} · {available ? "Realised trading earnings" : "Waiting for broker trade history"}</span></div>
        <dl className="performance-breakdown"><div><dt>Trading profit</dt><dd className={tone(stats.tradingProfit)}>{available ? signed(stats.tradingProfit) : "—"}</dd></div><div><dt>Fees &amp; swap</dt><dd className={tone(stats.costs)}>{available ? signed(stats.costs) : "—"}</dd></div></dl>
        <dl className="performance-stat-grid">{[["Win rate", available && stats.accuracy !== null ? `${stats.accuracy.toFixed(1)}%` : "—"], ["Winning trades", available ? stats.wins ?? "—" : "—"], ["Losing trades", available ? stats.losses ?? "—" : "—"], ["Closing deals", available ? stats.closes ?? "—" : "—"]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold">{value}</dd></div>)}</dl>
        <dl className="performance-breakdown"><div><dt>Total profits</dt><dd className="performance-profit">{available ? signed(stats.grossProfit) : "—"}</dd></div><div><dt>Total losses</dt><dd className="performance-loss">{available ? signed(stats.grossLoss) : "—"}</dd></div><div><dt>Break-even deals</dt><dd>{available ? stats.breakeven ?? "—" : "—"}</dd></div></dl>
      </section>
      {updated && <p className="mt-5 text-xs text-muted-foreground">{error ? "Last successful update" : "Updated"} {updated.toLocaleTimeString()} · {account?.currency}</p>}
    </div>
  </main>;
}