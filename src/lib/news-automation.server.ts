import { createMT5Service } from './mt5-service';
import { automationSchema, executionTime, validNewsSignal, confirmedOrder, type AutomationInput } from './news-automation';
import { getNewsEvents, type NewsEvent } from './news.server';
import { createHmac, createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

function secret() { const value=process.env['NEWS_AUTOMATION_ENCRYPTION_KEY']; if(!value) throw new Error('News automation security is not configured.'); return value; }
function owner(token:string) { return createHmac('sha256',secret()).update(token).digest('hex'); }
function encrypt(token:string) { const iv=randomBytes(12); const cipher=createCipheriv('aes-256-gcm',createHash('sha256').update(secret()).digest(),iv); const data=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64'); }
function decrypt(raw:string) {const b=Buffer.from(raw,'base64');const c=createDecipheriv('aes-256-gcm',createHash('sha256').update(secret()).digest(),b.subarray(0,12));c.setAuthTag(b.subarray(12,28));return Buffer.concat([c.update(b.subarray(28)),c.final()]).toString('utf8');}
export async function automationDB() { const {supabaseAdmin}=await import('@/integrations/supabase/client.server');return supabaseAdmin; }
// Newly staged schema is not generated until the paused database is resumed and migration applied.
export async function jobsDB() { const db=await automationDB();return db as unknown as import('@supabase/supabase-js').SupabaseClient; }
export async function verifyAutomationOwner(token:string) {
 if(!token||token.length>4096) throw new Error('Connect a verified MT5 account first.');
 const account=await createMT5Service().account(token);
 if(account.connected!==true) throw new Error('Reconnect your MT5 account.');
 return {account,key:owner(token)};
}
export async function listAutomation(token:string) {
 const {key}=await verifyAutomationOwner(token);const db=await jobsDB();
 const {data,error}=await db.from('news_automations').select('id,event_id,execute_at,symbols,lot,trades,status,detail').eq('owner_key',key).order('execute_at');
 if(error) throw new Error('Saved schedules unavailable. The hosted database must be active.');return data;
}
export async function scheduleAutomation(token:string,input:AutomationInput) {
 const params=automationSchema.parse(input);const {account,key}=await verifyAutomationOwner(token);
 const event=(await getNewsEvents()).find(e=>e.id===params.eventId);if(!event) throw new Error('Event is no longer in the verified calendar. Refresh it.');
 const executeAt=executionTime(event.time_utc,params.leadSeconds,Date.now());
 const service=createMT5Service();for(const symbol of params.symbols){const q=await service.quote(token,symbol);if(q.symbol!==symbol)throw new Error(`Exact broker symbol unavailable: ${symbol}`);}
 const db=await jobsDB();const {data,error}=await db.from('news_automations').insert({owner_key:key,event_id:event.id,event_data:event,account_login:account.login,account_server:account.server,token_cipher:encrypt(token),symbols:[...new Set(params.symbols)],lot:params.lot,trades:params.trades,lead_seconds:params.leadSeconds,execute_at:executeAt}).select('id').single();
 if(error||!data)throw new Error(error?.code==='23505'?'This event already has a schedule for this account.':'Schedule could not be saved. The hosted database must be active.');
 try {
  const auth=process.env['LOVABLE_API_KEY'],connection=process.env['INNGEST_API_KEY'];if(!auth||!connection)throw new Error('Scheduling service not connected.');
  const r=await fetch('https://connector-gateway.lovable.dev/inngest/e/',{method:'POST',headers:{Authorization:`Bearer ${auth}`,'X-Connection-Api-Key':connection,'Content-Type':'application/json'},body:JSON.stringify({id:data.id,name:'tradenest/news.scheduled',data:{jobId:data.id,executeAt}})});
  if(!r.ok)throw new Error(`Scheduling service rejected the request (${r.status}).`);
  const {error:saveError}=await db.from('news_automations').update({status:'scheduled'}).eq('id',data.id).eq('status','queued');if(saveError)throw new Error('Schedule confirmation unavailable.');
 }catch(e){await db.from('news_automations').update({status:'failed',token_cipher:null,detail:'Scheduling service did not confirm this job.'}).eq('id',data.id);throw e;}
 return {id:data.id,execute_at:executeAt};
}
export async function cancelAutomation(token:string,id:string) {
 const {key}=await verifyAutomationOwner(token);const db=await jobsDB();
 const {data,error}=await db.from('news_automations').update({status:'cancelled',token_cipher:null,detail:'Cancelled by account owner.'}).eq('id',id).eq('owner_key',key).in('status',['queued','scheduled','preparing']).select('id');
 if(error||!data?.length)throw new Error('This schedule cannot be cancelled; it may already be executing.');return {cancelled:true};
}
export async function prepareAutomation(id:string) {
 const db=await jobsDB();const {data:job}=await db.from('news_automations').select('*').eq('id',id).in('status',['queued','scheduled']).single();if(!job)return {signals:[]};
 const token=decrypt(job.token_cipher);const service=createMT5Service();const info=await service.account(token);
 if(info.connected!==true||info.login!==Number(job.account_login)||info.server!==job.account_server)throw new Error('Scheduled account verification failed.');
 const event=(await getNewsEvents()).find(e=>e.id===job.event_id);
 if(!event||event.time_utc!==(job.event_data as NewsEvent).time_utc)throw new Error('Event time changed. Schedule skipped.');
 const key=process.env['LOVABLE_API_KEY'];if(!key)throw new Error('AI not configured.');
 const signals=[];
 for(const symbol of job.symbols){
  const quote=await service.quote(token,symbol);if(quote.symbol!==symbol||!Number.isFinite(quote.bid)||!Number.isFinite(quote.ask))throw new Error('Exact broker quote unavailable.');
  const r=await fetch('https://ai.gateway.lovable.dev/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'openai/gpt-6-astra',reasoning_effort:'low',response_format:{type:'json_object'},messages:[{role:'system',content:'Return JSON only. Provide an event-specific news trade or NEUTRAL. Never invent actual release data. Confidence is an uncertain AI estimate, not a verified probability. Return {symbol,direction:BUY|SELL|NEUTRAL,sl:number,tp:number,confidence:number,reason:string}. SL/TP are absolute broker prices. BUY SL below bid TP above ask; SELL SL above ask TP below bid. Skip if no defensible setup.'},{role:'user',content:JSON.stringify({event,symbol,bid:quote.bid,ask:quote.ask,observedAt:new Date().toISOString()})}]})});
  if(!r.ok)throw new Error(`AI analysis unavailable (${r.status}).`);const result=await r.json();let raw;try{raw=JSON.parse(result.choices?.[0]?.message?.content??'{}');}catch{raw={};}
  const signal=validNewsSignal(raw,symbol,quote.bid,quote.ask);if(signal)signals.push(signal);
 }
 await db.from('news_automations').update({status:'preparing'}).eq('id',id).in('status',['queued','scheduled']);return {signals};
}
export async function executeAutomation(id:string,signals:unknown[]) {
 const db=await jobsDB();const {data:job}=await db.from('news_automations').update({status:'executing'}).eq('id',id).eq('status','preparing').select('*').single();if(!job)return {skipped:true};
 let sent=0,attempts=0;
 try{
  const late=Date.now()-Date.parse(job.execute_at);if(late<0||late>5000)throw new Error('Execution window missed. No late orders sent.');
  const token=decrypt(job.token_cipher),service=createMT5Service();const info=await service.account(token);
  if(info.connected!==true||info.login!==Number(job.account_login)||info.server!==job.account_server)throw new Error('Scheduled account verification failed.');
  for(const symbol of job.symbols){
   for(let ordinal=1;ordinal<=job.trades;ordinal++){
    if(Date.now()>Date.parse((job.event_data as NewsEvent).time_utc))throw new Error('Release already started. Remaining orders skipped.');
    const quote=await service.quote(token,symbol);if(quote.symbol!==symbol)throw new Error('Broker symbol changed.');
    const raw=signals.find(s=>s&&typeof s==='object'&&'symbol' in s&&s.symbol===symbol);const signal=validNewsSignal(raw,symbol,quote.bid,quote.ask);if(!signal)break;
    const {error}=await db.from('news_automation_orders').insert({job_id:id,symbol,ordinal,status:'sending',signal});if(error)continue;
    attempts++;
    try{const result=await service.trade(token,{symbol,side:signal.direction==='BUY'?'buy':'sell',volume:Number(job.lot),sl:signal.sl,tp:signal.tp,comment:'News AI'});
     const rejected=!confirmedOrder(result);
     await db.from('news_automation_orders').update({status:rejected?'rejected':'sent',result:{retcode:result.retcode??null,ticket:result.order??result.ticket??null}}).eq('job_id',id).eq('symbol',symbol).eq('ordinal',ordinal);
     if(rejected)throw new Error('Broker rejected a scheduled order.');sent++;
    }catch(e){await db.from('news_automation_orders').update({status:'unknown'}).eq('job_id',id).eq('symbol',symbol).eq('ordinal',ordinal).eq('status','sending');throw e;}
   }
  }
  await db.from('news_automations').update({status:sent===job.symbols.length*job.trades?'completed':sent?'partial':'skipped',token_cipher:null,detail:`${sent} confirmed order(s); ${attempts} attempt(s). No automatic retries.`}).eq('id',id);
 }catch{await db.from('news_automations').update({status:sent?'partial':'failed',token_cipher:null,detail:`${sent} confirmed order(s). Account, quote, timing or broker check failed; no automatic retry.`}).eq('id',id);}
 return {sent,attempts};
}
export async function failAutomation(id:string) {const db=await jobsDB();await db.from('news_automations').update({status:'failed',token_cipher:null,detail:'Automation stopped safely before execution.'}).eq('id',id).in('status',['queued','scheduled','preparing']);}
