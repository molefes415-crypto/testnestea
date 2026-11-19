import { describe, expect, it } from 'bun:test';
import { handleNewsAutomation } from './news-automation-http';

const request = (data, token = 'personal-test-token') => new Request('https://example.test/api/public/news-automation', {method:'POST', headers: token ? {'x-mt5-token':token} : {}, body:JSON.stringify(data)});
describe('Android news automation adapter', () => {
  it('rejects missing personal tokens without loading private services', async () => {
    let loaded = false;
    const result = await handleNewsAutomation(request({action:'list'}, ''), async () => { loaded=true; throw new Error('must not load'); });
    expect(result.status).toBe(401); expect(loaded).toBe(false);
  });
  it('passes exact symbols and selected count to the existing verified scheduler', async () => {
    let captured;
    const input = {eventId:'release-1', symbols:['XAUUSD.m'],lot:0.01,trades:10,leadSeconds:300};
    const result = await handleNewsAutomation(request({action:'arm',input}), async () => ({listAutomation:async()=>[],cancelAutomation:async()=>({}),scheduleAutomation:async(token,data)=>{captured={token,data};return {id:'schedule-1'};}}));
    expect(result.status).toBe(200); expect(captured).toEqual({token:'personal-test-token',data:input});
  });
  it('never discloses upstream tokens on verification failure', async () => {
    const result = await handleNewsAutomation(request({action:'list'}), async () => ({listAutomation:async()=>{throw new Error('secret-token');},cancelAutomation:async()=>({}),scheduleAutomation:async()=>({})}));
    expect(result.status).toBe(502); expect(await result.text()).not.toContain('secret-token');
  });
});