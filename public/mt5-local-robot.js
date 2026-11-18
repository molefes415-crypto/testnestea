(function (root) {
  function readiness(samples) {
    const elapsed = samples.length ? samples.at(-1).observedAt - samples[0].observedAt : 0;
    return Math.floor(Math.max(0, Math.min(1, samples.length / 40, elapsed / 180000)) * 10);
  }
  function analyse(market, style = 'day', indicators = root) {
    const hold = reason => ({ symbol: market.symbol, direction: 'NEUTRAL', reason });
    const now = Date.now();
    if (!Number.isFinite(market.bid) || !Number.isFinite(market.ask) || market.bid <= 0 || market.ask < market.bid || now - market.observedAt > 30000) return hold('Waiting for fresh broker prices');
    const samples = market.samples || [];
    const elapsed = samples.length ? samples.at(-1).observedAt - samples[0].observedAt : 0;
    if (samples.length < 40 || elapsed < 180000) return hold(`Preparing signal · ${readiness(samples)}/10 readiness · ${Math.max(0, Math.ceil((180000 - elapsed) / 1000))}s minimum remaining`);
    if (samples.some((p, i) => !Number.isFinite(p.bid) || !Number.isFinite(p.ask) || p.ask < p.bid || now - p.observedAt > 600000 || (i && p.observedAt <= samples[i-1].observedAt))) return hold('Invalid price history');
    const values = samples.map(p => (p.bid + p.ask) / 2);
    const fast = indicators.ema({ period: 9, values });
    const slow = indicators.ema({ period: 26, values });
    const momentum = indicators.rsi({ period: 14, values }).at(-1);
    const recent = values.slice(-6, -1);
    const price = values.at(-1);
    // Quote trend breakout, not fabricated H1 candles or an AI confidence estimate.
    const buy = fast.at(-1) > slow.at(-1) && fast.at(-1) > fast.at(-2) && momentum >= 55 && momentum <= 75 && price > Math.max(...recent);
    const sell = fast.at(-1) < slow.at(-1) && fast.at(-1) < fast.at(-2) && momentum >= 25 && momentum <= 45 && price < Math.min(...recent);
    if (!buy && !sell) return hold('Waiting for trend and momentum agreement');
    const entry = buy ? market.ask : market.bid;
    const distance = entry * (style === 'scalp' ? 0.0015 : 0.0035);
    if (market.ask - market.bid >= distance / 3) return hold('Spread too wide');
    const digits = Number.isInteger(market.digits) ? market.digits : 5;
    const round = n => Number(n.toFixed(digits));
    const sl = style === 'swing' ? null : round(entry + (buy ? -distance : distance));
    const tp = style === 'swing' ? null : round(entry + (buy ? 1 : -1) * distance * (style === 'scalp' ? 1.5 : 0.6 / 0.35));
    if (style !== 'swing' && (buy ? sl >= market.bid || tp <= market.ask : sl <= market.ask || tp >= market.bid)) return hold('Invalid stop levels');
    return { symbol: market.symbol, direction: buy ? 'BUY' : 'SELL', entry, sl, tp, strategy: 'Local quote trend', signalId: `local-${market.symbol}-${Math.floor(now / 900000)}` };
  }
  function confirmed(result) {
    if (!result || result.success === false || result.error) return false;
    if (typeof result.retcode === 'number') return [10008, 10009, 10010].includes(result.retcode);
    return typeof (result.order ?? result.ticket) === 'number' && (result.order ?? result.ticket) > 0;
  }
  function tradeComment(botName) {
    return `${String(botName || 'BOT').trim() || 'BOT'}-auto`;
  }
  // Stops flip-flopping: a direction must repeat before entering, and an open
  // position is only closed on a sustained reversal, after a minimum hold, and never while in profit.
  function createReversalGuard({ entryConfirmations = 2, closeConfirmations = 3, minHoldMs = 300000, now = Date.now } = {}) {
    const streaks = new Map();
    const firstSeen = new Map();
    function observe(symbol, direction) {
      const d = direction === 'BUY' || direction === 'SELL' ? direction : 'NEUTRAL';
      const prev = streaks.get(symbol);
      const count = d === 'NEUTRAL' ? 0 : (prev && prev.direction === d ? prev.count + 1 : 1);
      streaks.set(symbol, { direction: d, count });
      return count;
    }
    function canEnter(symbol, direction) {
      const s = streaks.get(symbol);
      return !!s && s.direction === direction && s.count >= entryConfirmations;
    }
    function canClose(position, positionSide, direction) {
      const key = `${position.symbol}:${position.ticket}`;
      if (!firstSeen.has(key)) firstSeen.set(key, now());
      const s = streaks.get(position.symbol);
      const opposite = (positionSide === 'BUY' && direction === 'SELL') || (positionSide === 'SELL' && direction === 'BUY');
      if (!opposite || !s || s.direction !== direction || s.count < closeConfirmations) return false;
      if (now() - firstSeen.get(key) < minHoldMs) return false;
      return !(Number(position.profit) > 0);
    }
    return { observe, canEnter, canClose };
  }
  function ownsPosition(comment, botName) {
    const c = String(comment || '');
    const name = String(botName || 'BOT').trim() || 'BOT';
    const full = tradeComment(name);
    return c === name || c === full || (c.length >= 4 && full.startsWith(c));
  }
  // Converts broker tick history into evenly spaced samples ending at the live quote.
  function seedFromTicks(payload, symbol, observedNow, stepMs = 5000) {
    if (!payload || payload.symbol !== symbol || !Array.isArray(payload.ticks)) return [];
    const last = Number(payload.last_msc);
    if (!Number.isFinite(last)) return [];
    const buckets = new Map();
    for (const t of payload.ticks) {
      if (!Array.isArray(t)) continue;
      const [msc, bid, ask] = t.map(Number);
      if (![msc, bid, ask].every(Number.isFinite) || bid <= 0 || ask < bid || msc > last) continue;
      buckets.set(Math.floor(msc / stepMs), { bid, ask, msc });
    }
    return [...buckets.values()].sort((a, b) => a.msc - b.msc)
      .map(p => ({ bid: p.bid, ask: p.ask, observedAt: observedNow - (last - p.msc) - 1 }))
      .filter(p => observedNow - p.observedAt <= 600000);
  }
  root.TNLocalRobot = { analyse, confirmed, readiness, tradeComment, createReversalGuard, ownsPosition, seedFromTicks };
})(typeof window === 'undefined' ? globalThis : window);