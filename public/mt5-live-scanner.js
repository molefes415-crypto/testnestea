(function (root) {
  const BASE = 'https://tradenestea.com/admin/api/mt5_gateway.php';
  function createLiveScanner({ request = fetch, getToken, now = Date.now }) {
    let active = '';
    const samples = new Map();
    const pending = new Map();
    const assertActive = token => {
      if (!token || token !== getToken()) throw new Error('MT5 account changed. Scan discarded.');
    };
    async function read(token, path) {
      assertActive(token);
      // Retry read-only requests once; never retry an order or use cached prices.
      for (let attempt = 0; attempt < 2; attempt++) {
        let response;
        try {
          response = await request(`${BASE}?a=proxy&p=${encodeURIComponent(path)}`, {
            headers: { Accept: 'application/json', 'X-MT5-Token': token }, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(30000),
          });
        } catch (error) {
          assertActive(token);
          if (attempt === 1) throw new Error('MT5 connection temporarily unavailable. Your saved account is retained; try the scan again.');
          continue;
        }
        assertActive(token);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          if (attempt === 0 && (response.status === 404 || response.status >= 500)) continue;
          throw new Error(typeof data?.detail === 'string' ? data.detail.split(token).join('[redacted]') : `Broker price request failed (${response.status}).`);
        }
        if (!data) throw new Error('MT5 returned an invalid response.');
        return data;
      }
    }
    async function sample(symbol) {
      const token = getToken();
      if (!token) throw new Error('Connect an MT5 account before scanning live prices.');
      if (active !== token) { samples.clear(); active = token; }
      const account = await read(token, 'account');
      if (account.connected === false || typeof account.server !== 'string' || !account.server || !Number.isSafeInteger(account.login) || account.login <= 0 || !Number.isFinite(account.balance)) throw new Error('MT5 connection could not be verified.');
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
    function snapshot(symbol) {
      const key = `${getToken()}:${symbol}`;
      if (pending.has(key)) return pending.get(key);
      const task = sample(symbol).finally(() => { if (pending.get(key) === task) pending.delete(key); });
      pending.set(key, task);
      return task;
    }
    return { snapshot, reset() { samples.clear(); active = ''; } };
  }
  root.TNLiveScanner = { createLiveScanner };
})(typeof window === 'undefined' ? globalThis : window);