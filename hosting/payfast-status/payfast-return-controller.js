import { paymentReference, verifiedPayment, paymentReturnLinks } from './payfast-mobile.js';

const query = new URLSearchParams(location.search);
const paymentId = paymentReference(query.get('m') || query.get('m_payment_id') || query.get('payment_id'));
const platform = /Android/i.test(navigator.userAgent) ? 'android'
  : /iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'ios' : 'web';
const title = document.getElementById('title');
const message = document.getElementById('msg');
const button = document.getElementById('open');
const fallback = document.getElementById('web');
const statusEndpoint = document.body.dataset.statusUrl || '/api/public/payfast?action=status';
let attempts = 0;
let finished = false;

function show(state, heading, text) {
  finished = true;
  title.textContent = heading;
  message.textContent = text;
  const tick = document.getElementById('tick');
  if (tick) { tick.className = state === 'success' ? 'tick ok' : 'tick'; tick.textContent = state === 'success' ? '✓' : '…'; }
  const links = paymentReturnLinks(paymentId, state, platform);
  button.href = links.app;
  button.textContent = 'OPEN TRADENEST';
  button.style.display = 'block';
  if (fallback) { fallback.href = links.web; fallback.style.display = 'block'; }
  // Chrome can refuse automatic app launches: keep the user-tappable link on screen.
  // Never replace this page on a timer, which would remove the Android recovery button.
  if (state === 'success' && platform === 'android') {
    try { location.href = links.app; } catch { /* The visible link remains available. */ }
  }
}

async function poll() {
  if (finished) return;
  attempts++;
  try {
    const url = new URL(statusEndpoint, location.href);
    url.searchParams.set('payment_id', paymentId);
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error('Status unavailable');
    const data = await response.json();
    if (verifiedPayment(data, paymentId)) return show('success', 'PAYMENT CONFIRMED', 'Your payment is confirmed. Return to TradeNest to continue.');
    if (data.payment_id === paymentId && data.status === 'failed') return show('failed', 'PAYMENT NOT COMPLETED', 'PayFast reported an unsuccessful payment. Return to TradeNest to try again.');
    if (data.payment_id === paymentId && data.status === 'cancelled') return show('cancel', 'CHECKOUT CLOSED', 'Return to TradeNest to check your payment or try again.');
  } catch { /* A temporary outage is not a failed or successful payment. */ }
  if (attempts >= 48) return show('pending', 'CONFIRMATION PENDING', 'Confirmation is taking longer than expected. TradeNest will check again when you return.');
  setTimeout(poll, 2500);
}

if (!paymentId) show('pending', 'PAYMENT REFERENCE MISSING', 'Return to TradeNest to check the payment you started there.');
else if (query.get('cancel') === '1') show('cancel', 'CHECKOUT CLOSED', 'Return to TradeNest to check your payment. This page cannot confirm whether money was charged.');
else poll();