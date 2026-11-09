import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Clock, Layers, Search, Coins, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { armNewsSchedule, readNewsSchedules, cancelNewsSchedule } from '@/lib/news-automation.functions';
import { automationSchema, executionTime, type AutomationJob } from '@/lib/news-automation';
import { ACTIVE_KEY } from '@/lib/mt5-saved-accounts';

type EventInfo={id:string;name:string;time_utc:string;currency:string|null;impact:string;forecast:string|null;previous:string|null};
export function NewsEventAutomation({event,onClose}:{event:EventInfo|null;onClose:()=>void}) {
 const arm=useServerFn(armNewsSchedule),read=useServerFn(readNewsSchedules),cancel=useServerFn(cancelNewsSchedule);
 const [allowed,setAllowed]=useState<string[]>([]),[symbols,setSymbols]=useState<string[]>([]),[search,setSearch]=useState('');
 const [lot,setLot]=useState('0.01'),[trades,setTrades]=useState('1'),[lead,setLead]=useState('60'),[unit,setUnit]=useState('seconds');
 const [jobs,setJobs]=useState<AutomationJob[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[clock,setClock]=useState(Date.now());
 useEffect(()=>{if(!event)return;setSymbols([]);setMessage('');setJobs([]);try{setAllowed(Object.keys(JSON.parse(localStorage.getItem('allowedSymbols')??'{}')));}catch{setAllowed([]);}const token=localStorage.getItem(ACTIVE_KEY);if(token)void read({data:{token}}).then(result=>setJobs(result as AutomationJob[])).catch(()=>{});const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[event?.id,read]);
 if(!event)return null;
 const seconds=Number(lead)*(unit==='minutes'?60:1);
 let target='';try{target=executionTime(event.time_utc,seconds,clock);}catch{}
 const existing=jobs.find(j=>j.event_id===event.id);
 async function submit(){
  if(!event)return;const token=localStorage.getItem(ACTIVE_KEY);if(!token){setMessage('Connect your MT5 account first.');return;}
  const input=automationSchema.safeParse({eventId:event.id,symbols,lot:Number(lot),trades:Number(trades),leadSeconds:seconds});
  if(!input.success){setMessage('Choose symbols, a positive lot, 1–100 trades and 1–900 seconds before release.');return;}
  setBusy(true);setMessage('');try{await arm({data:{token,input:input.data}});const result=await read({data:{token}});setJobs(result as AutomationJob[]);setMessage('Scheduled for this account. Runs after the app closes.');}catch{setMessage('Schedule could not be activated. Check the MT5 account and resume the hosted database.');}finally{setBusy(false);}
 }
 async function remove(){if(!existing)return;const token=localStorage.getItem(ACTIVE_KEY);if(!token)return;setBusy(true);try{await cancel({data:{token,id:existing.id}});setJobs(await read({data:{token}}) as AutomationJob[]);setMessage('Schedule cancelled.');}catch{setMessage('Cancellation not confirmed. Refresh its status before proceeding.');}finally{setBusy(false);}}
 return <Dialog open={Boolean(event)} onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="news-automation-panel"><header><p className="automation-eyebrow">Automate news event</p><DialogTitle>{event.name}</DialogTitle><DialogDescription>{event.currency} · {new Date(event.time_utc).toLocaleTimeString('en-ZA',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit'})} SAST · {event.impact} impact · FC {event.forecast??'—'} · PREV {event.previous??'—'}</DialogDescription></header>
 <div><label className="automation-label" htmlFor="news-symbol-search">Symbols</label><div className="automation-input"><Search/><Input id="news-symbol-search" placeholder="Search exact broker symbols" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="automation-symbols">{allowed.filter(s=>s.toLowerCase().includes(search.toLowerCase())).map(s=><Button key={s} size="sm" variant={symbols.includes(s)?'default':'outline'} aria-pressed={symbols.includes(s)} onClick={()=>setSymbols(list=>list.includes(s)?list.filter(x=>x!==s):[...list,s])}>{s}</Button>)}</div>{!allowed.length&&<p className="text-xs text-muted-foreground mt-2">No allowed broker symbols selected.</p>}</div>
 <div><label className="automation-label" htmlFor="news-lot">Lot size</label><div className="automation-input"><Coins/><Input id="news-lot" type="number" min="0.01" step="0.01" value={lot} onChange={e=>setLot(e.target.value)}/></div></div>
 <div><label className="automation-label" htmlFor="news-lead">Before release · max 15 minutes</label><div className="automation-input"><Clock/><Input id="news-lead" type="number" min="1" max={unit==='minutes'?15:900} value={lead} onChange={e=>setLead(e.target.value)}/><select aria-label="Timing unit" value={unit} onChange={e=>{setLead(String(unit==='minutes'?Number(lead)*60:Number(lead)/60));setUnit(e.target.value);}}><option value="seconds">Seconds</option><option value="minutes">Minutes</option></select></div><div className="automation-presets">{[[30,'30s'],[60,'1m'],[300,'5m'],[900,'15m']].map(([value,label])=><Button key={value} size="sm" variant={seconds===value?'default':'outline'} onClick={()=>{setUnit('seconds');setLead(String(value));}}>{label}</Button>)}</div></div>
 <div><label className="automation-label" htmlFor="news-trades">Trades per symbol</label><div className="automation-input"><Layers/><Input id="news-trades" type="number" min="1" max="100" value={trades} onChange={e=>setTrades(e.target.value)}/></div></div>
 <p className="text-xs text-muted-foreground">AI direction · Confidence ≥50% · Stop loss + take profit required</p>
 {!target&&<p className="text-sm text-destructive text-center">That execution moment has already passed or the timing is invalid.</p>}
 {target&&<p className="text-xs text-muted-foreground text-center">Execution {new Date(target).toLocaleTimeString('en-ZA',{timeZone:'Africa/Johannesburg'})} SAST</p>}
 {existing&&<div role="status" className="text-sm"><strong className="capitalize">{existing.status}</strong><p className="text-xs text-muted-foreground">{existing.detail}</p>{['queued','scheduled','preparing'].includes(existing.status)&&<Button variant="outline" size="sm" disabled={busy} onClick={()=>void remove()}><X/>Cancel automation</Button>}</div>}
 {message&&<p role="status" className="text-sm text-center">{message}</p>}
 <Button className="automation-submit" disabled={busy||!target||!symbols.length||Boolean(existing)} onClick={()=>void submit()}><Zap/>{busy?'Saving…':'Automate news'}</Button>
 </DialogContent></Dialog>;
}