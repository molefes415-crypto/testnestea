import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createItnServer } from './server.mjs'

async function run(fetcher, check) {
  const server = createItnServer({ receiverUrl: 'https://tradnestea.app/api/public/payfast-itn', fetcher })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try { await check(`http://127.0.0.1:${server.address().port}`) }
  finally { await new Promise(resolve => server.close(resolve)) }
}
const send = (url, body = 'amount_gross=580.00&signature=abc') => fetch(url + '/itn', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
})
test('relay preserves the signed form and acknowledges only accepted notifications', async () => {
  await run(async (_url, options) => {
    assert.equal(options.body.toString(), 'amount_gross=580.00&signature=abc')
    assert.equal(options.redirect, 'error')
    return new Response('ok')
  }, async url => assert.equal((await send(url)).status, 200))
})
test('failed receiver processing stays retryable', async () => {
  await run(async () => new Response('failed', { status: 503 }), async url => {
    assert.equal((await send(url)).status, 503)
  })
})
test('invalid payment is never acknowledged as paid', async () => {
  await run(async () => new Response('invalid', { status: 400 }), async url => {
    assert.equal((await send(url)).status, 400)
  })
})
test('reject oversized payloads before forwarding', async () => {
  await run(async () => { throw new Error('Must not forward') }, async url => {
    assert.equal((await send(url, 'x'.repeat(32769))).status, 413)
  })
})