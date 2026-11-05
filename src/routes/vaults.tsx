import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, queryOptions } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ArrowLeft, ArrowUpRight, Wallet, RefreshCw, Search, ShieldCheck, X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getVaults } from "@/lib/vaults.functions";
import { chainNames, supportsStandardDeposit, type Vault } from "@/lib/vaults";
import { connectWallet, inspectDeposit, depositVault, injectedProvider } from "@/lib/vault-wallet";
import { formatUnits, type Address } from "viem";

const options = queryOptions({ queryKey: ["pigi-vaults"], queryFn: () => getVaults(), staleTime: 60000, refetchInterval: 60000 });
export const Route = createFileRoute("/vaults")({
  head: () => ({ meta: [{ title: "Live Yield Vaults | TradeNest EA" }, { name: "description", content: "Browse live Pigi Finance vault yields, liquidity and risk, and connect a wallet to supported deposits." }, { property: "og:title", content: "TradeNest EA — Live Yield Vaults" }, { property: "og:description", content: "Explore live on-chain yield opportunities powered by Pigi Finance." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: VaultsPage,
});
function VaultsPage() {
  const query = useQuery(options);
  const [search, setSearch] = useState("");
  const [chain, setChain] = useState("");
  const [account, setAccount] = useState<Address>();
  const [selected, setSelected] = useState<Vault>();
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState<Awaited<ReturnType<typeof inspectDeposit>>>();
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    const provider = injectedProvider() as ReturnType<typeof injectedProvider> & { on?: (event: string, fn: () => void) => void; removeListener?: (event: string, fn: () => void) => void };
    const reset = () => { setAccount(undefined); setSelected(undefined); setDetails(undefined); setNotice("Wallet changed. Please reconnect."); };
    provider?.on?.("accountsChanged", reset);
    return () => provider?.removeListener?.("accountsChanged", reset);
  }, []);
  const vaults = query.data?.vaults ?? [];
  const visible = vaults.filter(v => (!chain || String(v.chainId) === chain) && `${v.name} ${v.protocol}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => (b.apr ?? -1) - (a.apr ?? -1));
  const errorText = (error: unknown) => error instanceof Error && error.message.includes("rejected") ? "Wallet request cancelled." : "The wallet could not complete this request. Check the network, balance and vault compatibility, then try again.";
  async function connect() { try { setAccount(await connectWallet()); setNotice(""); } catch (error) { setNotice(error instanceof Error ? error.message : "Wallet connection failed."); } }
  async function open(v: Vault) {
    if (!account) { await connect(); return; }
    setSelected(v); setDetails(undefined); setAmount(""); setConfirmed(false); setNotice(""); setBusy(true);
    try { setDetails(await inspectDeposit(v, account)); } catch { setNotice("Direct deposits are unavailable: this vault could not pass the standard deposit checks."); } finally { setBusy(false); }
  }
  async function submit() {
    if (!selected || !account || !confirmed) return;
    setBusy(true);
    try { const hash = await depositVault(selected, account, amount, setNotice); setNotice(`Deposit confirmed: ${hash}`); setDetails(undefined); } catch (error) { setNotice(errorText(error)); } finally { setBusy(false); }
  }
  return <main className="vault-theme min-h-screen bg-background text-foreground">
    <header className="border-b border-border"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
      <Link to="/" className="flex items-center gap-3"><img src="/tradenest-logo.png" alt="TradeNest" className="size-10 rounded-md object-contain"/><span className="font-bold">TRADENEST <span className="text-primary">/ YIELD</span></span></Link>
      <Button variant={account ? "outline" : "default"} onClick={account ? () => { setAccount(undefined); setDetails(undefined); setSelected(undefined); } : connect}><Wallet/>{account ? `${account.slice(0,6)}…${account.slice(-4)} · Disconnect` : "Connect wallet"}</Button>
    </div></header>
    <div className="mx-auto max-w-7xl px-5 py-8 sm:py-12">
      <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="size-4"/>Trading dashboard</Link>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6"><div><p className="mb-3 font-mono text-xs text-primary">[ ON-CHAIN / LIVE ANALYTICS ]</p><h1 className="text-4xl font-bold">Yield vaults</h1><p className="mt-3 text-muted-foreground">Pigi Finance · 30-day average yields · {vaults.length} live opportunities</p></div><div className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-primary"/>Non-custodial</div></div>
      <div className="mb-7 flex flex-wrap gap-3 border-y border-border py-4"><label className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-3"><Search className="size-4 text-muted-foreground"/><input aria-label="Search vaults" placeholder="Search asset or protocol" value={search} onChange={e=>setSearch(e.target.value)} className="h-10 min-w-0 w-full bg-transparent outline-none"/></label><select aria-label="Network" value={chain} onChange={e=>setChain(e.target.value)} className="max-w-full rounded-md border border-input bg-card px-3 py-2"><option value="">All networks</option>{[...new Set(vaults.map(v=>v.chainId))].map(id=><option key={id} value={id}>{chainNames[id] ?? `Chain ${id}`}</option>)}</select><Button variant="outline" size="icon" aria-label="Refresh vaults" title="Refresh vaults" onClick={()=>query.refetch()} disabled={query.isFetching}><RefreshCw className={query.isFetching ? "animate-spin" : ""}/></Button></div>
      {!selected && notice && <p role="status" className="mb-5 break-words rounded-md border border-border p-4 text-sm">{notice}</p>}
      {query.isPending && <p role="status" className="py-12 text-muted-foreground">Fetching live vaults…</p>}
      {(query.isError || query.data?.error) && <div role="alert" className="py-10"><p>{query.data?.error ?? "Could not load vaults."}</p><Button className="mt-4" onClick={()=>query.refetch()}>Try again</Button></div>}
      {!query.isPending && !query.data?.error && visible.length===0 && <p className="py-12 text-muted-foreground">No vaults match your filters.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(v=><article key={v.id} className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-5"><div className="mb-4 flex justify-between gap-2"><span className="font-mono text-xs text-muted-foreground">{v.protocol.toUpperCase()}</span><span className="text-xs text-muted-foreground">{chainNames[v.chainId] ?? `Chain ${v.chainId}`}</span></div><h2 className="min-h-14 break-words text-lg font-semibold">{v.name}</h2><div className="my-5"><p className="text-3xl font-bold text-primary">{v.apr===null ? "—" : `${v.apr.toFixed(2)}%`}</p><p className="mt-1 text-xs text-muted-foreground">30-day average APR</p></div><dl className="mb-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm"><div><dt className="text-xs text-muted-foreground">Total value locked</dt><dd className="mt-1 font-medium">{v.tvl===null ? "—" : new Intl.NumberFormat("en",{style:"currency",currency:"USD",notation:"compact",maximumFractionDigits:1}).format(v.tvl)}</dd></div><div><dt className="text-xs text-muted-foreground">Pigi risk band</dt><dd className="mt-1 capitalize">{v.risk}</dd></div></dl><p className="mb-4 text-xs text-muted-foreground">{v.strategy}</p><Button className="mt-auto w-full" variant={supportsStandardDeposit(v)?"default":"outline"} onClick={()=>supportsStandardDeposit(v)?open(v):(setSelected(v),setDetails(undefined),setNotice("This protocol requires a dedicated deposit integration. No transaction will be sent."))}>{supportsStandardDeposit(v)?"Invest":"View vault"}<ArrowUpRight/></Button></article>)}</div>
      <footer className="mt-10 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">Data: Pigi Finance. APR is historical and variable, not a guaranteed return. Smart-contract, liquidity and asset risks apply. Only supported standard vaults offer direct deposits; each transaction requires wallet approval.</footer>
    </div>
    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/90 p-4"><section role="dialog" aria-modal="true" aria-labelledby="deposit-title" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-primary">{selected.protocol} · {chainNames[selected.chainId] ?? selected.chainId}</p><h2 id="deposit-title" className="mt-2 break-words text-xl font-bold">{selected.name}</h2></div><Button variant="ghost" size="icon" aria-label="Close vault" disabled={busy} onClick={()=>{setSelected(undefined);setNotice("");}}><X/></Button></div><p className="mt-5 break-all font-mono text-xs text-muted-foreground">Vault: {selected.address}</p><p className="mt-2 text-sm">Average APR: {selected.apr?.toFixed(2) ?? "—"}%</p>
      {details && <div className="mt-5 space-y-4"><p className="text-sm">Balance: {formatUnits(details.balance,details.decimals)} {details.symbol}</p><label className="block text-sm">Deposit amount ({details.symbol})<input aria-label="Deposit amount" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3"/></label><label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1"/>I have reviewed this vault and its contract address. I accept variable returns and smart-contract risk. Approval and deposit may require two transactions and network fees.</label><Button className="w-full" disabled={busy || !confirmed || !/^\d+(\.\d+)?$/.test(amount)} onClick={submit}><Wallet/>Review in wallet</Button></div>}
      {busy && <p role="status" className="mt-4 text-sm">Waiting for wallet or network…</p>}{notice && <p role="status" className="mt-4 break-all text-sm text-muted-foreground">{notice}</p>}{!details && !busy && <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Layers className="size-4"/>Analytics only · no deposit available</div>}
    </section></div>}
  </main>;
}