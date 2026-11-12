(function (root) {
  function analyse(market, style = 'day', indicators = root) {
    const hold = reason => ({ symbol: market.symbol, direction: 'NEUTRAL', reason });
    const now = Date.now();
    if (!Number.isFinite(market.bid) || !Number.isFinite(market.ask) || market.bid <= 0 || market.ask < market.bid || now - market.observedAt > 30000) return hold('Waiting for fresh broker prices');
    const samples = market.samples || [];
    if (samples.length < 40 || samples.at(-1).observedAt - samples[0].observedAt < 180000) return hold('Collecting live prices · at least 3 minutes');
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
  root.TNLocalRobot = { analyse, confirmed };
})(typeof window === 'undefined' ? globalThis : window);