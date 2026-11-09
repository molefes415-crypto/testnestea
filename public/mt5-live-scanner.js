(function (root) {
  const BASE = 'https://tradenestea.com/admin/api/mt5_gateway.php';
  function createLiveScanner({ request = fetch, getToken, now = Date.now }) {
    let active = '';
    const samples = new Map();
    const assertActive = token => {
      if (!token || token !== getToken()) throw new Error('MT5 account changed. Scan discarded.');
    };
    async function read(token, path) {
      assertActive(token);
      const response = await request(`${BASE}?a=proxy&p=${encodeURIComponent(path)}`, {
        headers: { Accept: 'application/json', 'X-MT5-Token': token }, credentials: 'omit', cache: 'no-store',
      });
      assertActive(token);
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data?.detail === 'string' ? data.detail.split(token).join('[redacted]') : `Broker price request failed (${response.status}).`);
      return data;
    }
    async function snapshot(symbol) {
      const token = getToken();
      if (!token) throw new Error('Connect an MT5 account before scanning live prices.');
      if (active !== token) { samples.clear(); active = token; }
      const account = await read(token, 'account');
      if (account.connected === false || typeof account.server !== 'string' || !Number.isSafeInteger(account.login)) throw new Error('MT5 connection could not be verified.');
      const quote = await read(token, `quote/${symbol}`);
      if (quote.symbol !== symbol) throw new Error(`Symbol "${symbol}" does not exist exactly on your broker.`);
      if (!Number.isFinite(quote.bid) || !Number.isFinite(quote.ask) || quote.bid <= 0 || quote.ask < quote.bid) throw new Error('Broker returned invalid bid/ask prices.');
      const observedAt = now();
      const point = { bid: quote.bid, ask: quote.ask, observedAt };
      const history = [...(samples.get(symbol) || []), point].filter(p => observedAt - p.observedAt <= 600000).slice(-120);
      samples.set(symbol, history);
      // Send price data only: never account login, name, password, or token to AI.
      return { source: 'mt5_gateway', symbol, server: account.server, bid: quote.bid, ask: quote.ask,
        spread: quote.ask - quote.bid, digits: Number.isInteger(quote.digits) ? quote.digits : undefined,
        observedAt, samples: history };
    }
    return { snapshot, reset() { samples.clear(); active = ''; } };
  }
  root.TNLiveScanner = { createLiveScanner };
})(typeof window === 'undefined' ? globalThis : window);