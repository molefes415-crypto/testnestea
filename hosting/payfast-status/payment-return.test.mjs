import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentReturnLinks, paymentReference, verifiedPayment } from '../../public/payfast-mobile.js';

test('only a confirmed matching checkout can unlock', () => {
  assert.equal(verifiedPayment({ paid: true, status: 'paid', payment_id: 'tnea123' }, 'tnea123'), true);
  assert.equal(verifiedPayment({ paid: true, status: 'pending', payment_id: 'tnea123' }, 'tnea123'), false);
  assert.equal(verifiedPayment({ paid: true, status: 'paid', payment_id: 'another' }, 'tnea123'), false);
  assert.equal(verifiedPayment({ payfast: 'success' }, 'tnea123'), false);
});
test('Android return includes exact package and payment reference in app and fallback', () => {
  const links = paymentReturnLinks('tnea123', 'success', 'android');
  assert.ok(links.app.includes('package=com.whiteyforex.tradenestea;'));
  assert.ok(links.app.includes('payment_id=tnea123'));
  assert.ok(decodeURIComponent(links.app).includes('https://tradnestea.app/tradenest.html?payment_id=tnea123'));
});
test('iPhone home-screen app uses web return, native iOS is explicit', () => {
  assert.equal(paymentReturnLinks('tnea123', 'success', 'ios').app, 'https://tradnestea.app/tradenest.html?payment_id=tnea123&payfast=success');
  assert.equal(paymentReturnLinks('tnea123', 'success', 'ios-native').app, 'tradenest://payfast/success?payment_id=tnea123&state=success');
});
test('invalid payment references are rejected without silently rewriting them', () => {
  assert.equal(paymentReference('abc<script>'), '');
  assert.equal(paymentReference('a'.repeat(121)), '');
  assert.equal(paymentReference('tnea123'), 'tnea123');
});