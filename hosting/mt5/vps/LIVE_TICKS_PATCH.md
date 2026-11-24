# VPS patch: instant broker tick history (`/ticks/{symbol}`)

Lets the robot start with the last 10 minutes of real broker prices instead of waiting ~3 minutes.
Back up both files first, then restart the gateway.

## 1. Worker file (Multi-client MT5 REST API) — paste below the `/quote/{symbol}` endpoint

```python
@app.get("/ticks/{symbol}", dependencies=[Depends(auth)])
def ticks(symbol: str, seconds: int = 600):
    seconds = max(30, min(int(seconds), 1800))
    with lock:
        require_connected()
        info, tick = require_exact_symbol(symbol)
        last_msc = int(tick.time_msc)
        # Tick times and the request date share the broker's own clock frame.
        start = datetime.utcfromtimestamp(last_msc / 1000 - seconds)
        data = mt5.copy_ticks_from(symbol, start, 50000, mt5.COPY_TICKS_INFO)
        if data is None:
            raise HTTPException(status_code=502, detail={
                "message": "Could not read broker tick history.",
                "mt5_error": last_error()})
        buckets = {}
        for t in data:
            bid, ask, msc = float(t["bid"]), float(t["ask"]), int(t["time_msc"])
            if bid > 0 and ask >= bid and msc <= last_msc:
                buckets[msc // 5000] = [msc, bid, ask]
        return {
            "symbol": symbol,
            "digits": info.digits,
            "last_msc": last_msc,
            "ticks": [buckets[k] for k in sorted(buckets)][-360:],
        }
```

## 2. Gateway file (Multi-user MT5 Gateway) — allow the read

```python
ALLOWED_GET = {
    "account", "positions", "history", "health", "symbols", "quote",
    "ticks",
}
```

## 3. Website file `admin/api/mt5_gateways.php`

Upload the updated `hosting/mt5/mt5_gateways.php` (it now allows `ticks/<SYMBOL>`).
It is read-only; orders are unchanged.
