import { useEffect, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, RefreshCw, Sparkles, Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { marketSessions } from "@/lib/market-sessions";
import { fundamentalsQuery } from "@/lib/fundamentals-query";
import { NewsEventAutomation } from "@/components/news-event-automation";

type Prediction = { event_id?: string; event: string; currency: string; expected: string; predicted_value?: string; currency_bias: string; confidence: number; reason: string };
type Outlook = { predictions: Prediction[]; summary: string };
export function Fundamentals() {
  const { data, refetch, isFetching } = useSuspenseQuery(fundamentalsQuery);
  const [period, setPeriod] = useState("week");
  const [impact, setImpact] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [search, setSearch] = useState("");
  const [symbol, setSymbol] = useState("");
  const [outlook, setOutlook] = useState<Outlook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<(typeof data.events)[number] | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60000);
    try {
      const allowed = JSON.parse(localStorage.getItem("allowedSymbols") || "{}");
      setSymbol(Object.keys(allowed)[0] || "");
      const theme = JSON.parse(localStorage.getItem("appThemeColor") || "{}");
      if (typeof theme.accent === "string" && CSS.supports("color", theme.accent)) document.documentElement.style.setProperty("--mt5-theme-accent", theme.accent);
    } catch { /* Keep empty selection. */ }
    return () => clearInterval(interval);
  }, []);
  const localDay = (date: string | number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
  const targetDay = now === null ? null : localDay(now + (period === "tomorrow" ? 86400000 : 0));
  const sessions = now === null ? [] : marketSessions(now);
  const openSessions = sessions.filter(s => s.open);
  const featured = openSessions.find(s => s.name === "London") ?? openSessions[0] ?? sessions[0];
  const next = sessions.filter(s => !s.open).sort((a,b) => a.hours-b.hours)[0];
  const visible = data.events.filter(e => (impact === "all" || e.impact === impact) && (currency === "all" || e.currency === currency) && e.name.toLowerCase().includes(search.toLowerCase()) && (period === "week" || targetDay === null || localDay(e.time_utc) === targetDay));
  const currencies = [...new Set(data.events.map(e => e.currency).filter((c): c is string => Boolean(c)))].sort();
  const high = visible.filter(e => e.impact === "high").length;
  async function analyse() {
    if (!symbol.trim()) return;
    setLoading(true); setError(""); setOutlook(null);
    try {
      const response = await fetch(`/api/public/news?action=predict&symbols=${encodeURIComponent(symbol.trim())}&min_confidence=50`, { headers: { "x-api-key": "tnea_33837a5f9367c6cfe2a4f4a9f42b2de30acde3c9" } });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "News outlook unavailable.");
      setOutlook({ predictions: Array.isArray(result.predictions) ? result.predictions : [], summary: result.summary || "" });
    } catch (e) { setError(e instanceof Error ? e.message : "News outlook unavailable."); }
    finally { setLoading(false); }
  }
  return <main className="mt5-workspace fundamentals-page min-h-screen bg-background text-foreground">
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
      <nav className="news-tabs" aria-label="Scanner views"><Button variant="ghost" onClick={() => { if (window.parent !== window) window.parent.postMessage({type:"tn-open-chart"},window.location.origin); else window.location.assign("/tradenest.html?view=chart"); }}>Chart</Button><Button variant="ghost" className="selected" aria-current="page">News</Button></nav>
      <header className="news-heading"><h1><CalendarDays/> Fundamentals</h1><p>This week's economic calendar</p></header>
      <section className="market-sessions" aria-label="Market sessions"><div className="session-heading"><span>Market sessions</span><div><strong>{openSessions.length} OPEN</strong><p>{next ? `NEXT · ${next.name.toUpperCase()} in ${next.hours}h` : "—"}</p></div></div>
        {featured && <div className="session-featured"><img className={featured.open ? "session-flag is-open" : "session-flag"} src={`/flags/${featured.country}.svg`} alt={`${featured.name} flag`}/><h2>{featured.name} {featured.open ? "Open" : "Closed"}</h2><p>{featured.open ? "Closes" : "Opens"} in {featured.hours}h</p></div>}
        <div className="session-grid">{sessions.map(s => <div key={s.name}><img className={s.open ? "session-flag is-open" : "session-flag"} src={`/flags/${s.country}.svg`} alt={`${s.name} flag`}/><h3>{s.name}</h3><p className={s.open ? "session-open" : ""}>{s.open ? "OPEN · " : "IN "}{s.hours}h</p></div>)}</div>
      </section>
      <div className="news-impact-row"><span className="news-impact-count"><span className="fundamentals-impact fundamentals-impact-high"/> High impact · {high}</span><Button variant="ghost" size="icon" className="news-refresh" aria-label="Refresh calendar" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={isFetching ? "animate-spin" : ""}/></Button></div>
      <div className="news-periods" role="group" aria-label="Calendar period">{[["today","Today"],["tomorrow","Tomorrow"],["week","All week"]].map(([id,label]) => <Button key={id} variant="ghost" aria-pressed={period===id} className={period===id ? "selected" : ""} onClick={()=>setPeriod(id)}>{label}</Button>)}</div>
      <details className="news-filters"><summary>Calendar filters · SAST (UTC+2)</summary><div className="flex flex-wrap gap-3 py-3"><select aria-label="Impact" className="rounded-md border border-border bg-card px-3 text-sm" value={impact} onChange={e=>setImpact(e.target.value)}><option value="all">All impact</option><option value="high">High impact</option><option value="medium">Medium impact</option><option value="low">Low impact</option></select><select aria-label="Currency" className="rounded-md border border-border bg-card px-3 text-sm" value={currency} onChange={e=>setCurrency(e.target.value)}><option value="all">All currencies</option>{currencies.map(c=><option key={c}>{c}</option>)}</select><Input aria-label="Search events" placeholder="Search events" value={search} onChange={e=>setSearch(e.target.value)}/></div></details>
      <section aria-label="Economic releases" className="border-y border-border">{visible.length === 0 ? <p className="py-10 text-center text-muted-foreground">{data.unavailable ? "News calendar is temporarily unavailable. Tap refresh to try again." : "No releases match your filters."}</p> : visible.map(e => <article key={e.id} role="button" tabIndex={0} aria-label={`Automate ${e.name}`} onClick={()=>setSelectedEvent(e)} onKeyDown={key=>{if(key.key==="Enter"||key.key===" "){key.preventDefault();setSelectedEvent(e);}}} className="fundamentals-event border-b border-border py-4 last:border-0"><div><time className="font-mono text-sm">{new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(e.time_utc))}</time><p className="mt-1 text-xs text-muted-foreground">{now !== null && new Date(e.time_utc).getTime() < now ? e.actual !== null ? "Released" : "Awaiting actual" : "Upcoming"}</p></div><div><div className="flex items-center gap-2"><span className={`fundamentals-impact fundamentals-impact-${e.impact}`} aria-label={`${e.impact} impact`} /><span className="text-xs font-semibold text-primary">{e.currency || "—"}</span><span className="text-xs capitalize text-muted-foreground">{e.impact}</span></div><h2 className="mt-1 text-sm font-medium">{e.name}</h2></div><dl className="grid grid-cols-3 gap-4 text-sm">{[["Forecast", e.forecast], ["Previous", e.previous], ["Actual", e.actual]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-mono">{value ?? "—"}</dd></div>)}</dl></article>)}</section>
      <section className="mt-8 border-t border-border pt-6" aria-label="AI news outlook"><div className="mb-4 flex items-center gap-2"><Sparkles className="size-5 text-primary" /><h2 className="text-xl font-semibold">AI news outlook</h2></div><form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); void analyse(); }}><Input aria-label="Exact broker symbol" placeholder="Exact broker symbol" value={symbol} onChange={e => setSymbol(e.target.value)} maxLength={24} className="min-w-40 flex-1 bg-card" /><Button type="submit" disabled={loading || !symbol.trim()}><Sparkles />{loading ? "Analysing…" : "Analyse news"}</Button></form><p className="mt-3 text-xs text-muted-foreground">AI estimates are uncertain, not verified probabilities or trade orders.</p>{error && <p role="alert" className="mt-4 text-destructive">{error}</p>}{outlook && <div aria-live="polite"><p className="my-5 text-sm leading-relaxed">{outlook.summary}</p>{outlook.predictions.length === 0 && <p className="text-sm text-muted-foreground">No relevant predictions for this symbol.</p>}{outlook.predictions.map((p, i) => <article key={`${p.event_id}-${i}`} className="border-t border-border py-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{p.event}</h3><span className="flex shrink-0 items-center gap-1 text-sm text-primary">{p.currency_bias === "bullish" ? <TrendingUp className="size-4" /> : p.currency_bias === "bearish" ? <TrendingDown className="size-4" /> : <Minus className="size-4" />}{p.currency_bias}</span></div><p className="my-2 text-xs text-muted-foreground">{p.currency} · Expected {p.expected} · Estimate {p.predicted_value || "—"} · AI confidence {p.confidence}%</p><p className="text-sm leading-relaxed">{p.reason}</p></article>)}</div>}</section>
      <NewsEventAutomation event={selectedEvent} onClose={()=>setSelectedEvent(null)}/>
    </div>
  </main>;
}