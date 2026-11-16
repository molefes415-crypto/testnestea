// Shared return-page rules; URL state is never proof of payment.
export function paymentReference(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(value) ? value : '';
}

export function verifiedPayment(data, paymentId) {
  return Boolean(paymentId && data?.paid === true && data?.status === 'paid' && data?.payment_id === paymentId);
}

export function paymentReturnLinks(paymentId, state, platform) {
  const id = paymentReference(paymentId);
  const result = ['success', 'pending', 'cancel', 'failed'].includes(state) ? state : 'pending';
  const query = new URLSearchParams({ payment_id: id, payfast: result });
  const web = `https://tradnestea.app/tradenest.html?${query}`;
  const nativeQuery = new URLSearchParams({ payment_id: id, state: result });
  const native = `tradenest://payfast/${result}?${nativeQuery}`;
  return {
    web,
    // iOS Add-to-Home-Screen is a web app, not a registered native URL scheme.
    app: platform === 'android'
      ? `intent://payfast/${result}?${nativeQuery}#Intent;scheme=tradenest;package=com.whiteyforex.tradenestea;S.browser_fallback_url=${encodeURIComponent(web)};end`
      : platform === 'ios-native' ? native : web,
  };
}