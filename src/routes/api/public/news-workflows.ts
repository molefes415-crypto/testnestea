import { createFileRoute } from '@tanstack/react-router';
import { Inngest } from 'inngest';
import { serve } from 'inngest/edge';

async function handler(request:Request) {
 const signingKey=process.env['INNGEST_SIGNING_KEY'];
 if(!signingKey)return Response.json({error:'News scheduling is not configured.'},{status:503});
 const client=new Inngest({id:'tradenest-news',isDev:false});
 const fn=client.createFunction({id:'scheduled-news-trade',retries:0}, {event:'tradenest/news.scheduled'},async({event,step})=>{
  const {z}=await import('zod');
  const input=z.object({jobId:z.string().uuid(),executeAt:z.string().datetime()}).parse(event.data);
  const {prepareAutomation,executeAutomation,failAutomation}=await import('@/lib/news-automation.server');
  await step.sleepUntil('prepare-at',new Date(Date.parse(input.executeAt)-60000));
  const prepared=await step.run('verify-and-analyse',async()=>{try{return await prepareAutomation(input.jobId);}catch{await failAutomation(input.jobId);return {signals:[]};}});
  await step.sleepUntil('execute-at',new Date(input.executeAt));
  return step.run('send-once',()=>executeAutomation(input.jobId,prepared.signals));
 });
 const tick=client.createFunction({id:'robot-tick',retries:0},{cron:'*/5 * * * *'},async({step})=>{
  const ids=await step.run('list-robots',async()=>{const {runningRobotIds}=await import('@/lib/robot.server');return runningRobotIds();});
  if(ids.length)await step.sendEvent('fan-out',ids.map(robotId=>({name:'tradenest/robot.scan',data:{robotId}})));
  return {robots:ids.length};
 });
 const scan=client.createFunction({id:'robot-scan',retries:0,concurrency:{key:'event.data.robotId',limit:1}},{event:'tradenest/robot.scan'},async({event,step})=>{
  const robotId=String(event.data.robotId);
  await step.run('arm-news',async()=>{try{const {armRobotNews}=await import('@/lib/robot.server');return await armRobotNews(robotId);}catch{return {armed:0};}});
  const samples:Record<string,{bid:number;ask:number;observedAt:number}>[]=[];
  for(let i=0;i<22;i++){
   const s=await step.run(`sample-${i}`,async()=>{const {sampleRobot}=await import('@/lib/robot.server');return sampleRobot(robotId);});
   if(!s)return {stopped:true};samples.push(s);
   if(i<21)await step.sleep(`wait-${i}`,'4s');
  }
  return step.run('analyse-and-trade',async()=>{const {analyseAndTrade}=await import('@/lib/robot.server');return analyseAndTrade(robotId,samples);});
 });
 return serve({client,functions:[fn,tick,scan],signingKey,servePath:'/api/public/news-workflows'})(request);
}
export const Route=createFileRoute('/api/public/news-workflows')({server:{handlers:{GET:({request})=>handler(request),POST:({request})=>handler(request),PUT:({request})=>handler(request)}}});