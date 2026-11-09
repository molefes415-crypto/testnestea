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
 return serve({client,functions:[fn],signingKey,servePath:'/api/public/news-workflows'})(request);
}
export const Route=createFileRoute('/api/public/news-workflows')({server:{handlers:{GET:({request})=>handler(request),POST:({request})=>handler(request),PUT:({request})=>handler(request)}}});