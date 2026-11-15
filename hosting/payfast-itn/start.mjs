import { createItnServer } from './server.mjs'

const receiverUrl = process.env.TRADENEST_ITN_RECEIVER_URL
if (!receiverUrl) throw new Error('TRADENEST_ITN_RECEIVER_URL is required')
const server = createItnServer({ receiverUrl })
server.listen(Number(process.env.PORT || 10000), '0.0.0.0', () => {
  console.log('TradeNest PayFast ITN server listening')
})
process.on('SIGTERM', () => server.close())