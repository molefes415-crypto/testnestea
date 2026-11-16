<?php
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
?><!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Payment Confirmation — TradeNest EA</title>
<meta name="robots" content="noindex">
<style>
:root{--surface:#080b0c;--text:#f6f8f8;--muted:#aeb8ba;--accent:#ed3459;--edge:#354044}
*{box-sizing:border-box}body{margin:0;min-height:100svh;background:var(--surface);color:var(--text);font-family:system-ui;display:grid;place-items:center;padding:24px;text-align:center}
main{max-width:380px;width:100%}h1{font-size:23px}p{color:var(--muted);line-height:1.6}a{display:none;margin-top:18px;padding:16px;border-radius:8px;background:var(--accent);color:var(--text);text-decoration:none;font-weight:700}#web{background:transparent;border:1px solid var(--edge)}
</style></head><body data-status-url="payfast_status.php"><main>
<h1 id="title">VERIFYING PAYMENT</h1><p id="msg">Waiting for PayFast confirmation.</p>
<a id="open" href="https://tradnestea.app/tradenest.html">OPEN TRADENEST</a>
<a id="web" href="https://tradnestea.app/tradenest.html">CONTINUE IN BROWSER</a>
</main><script type="module" src="payfast-return-controller.js"></script></body></html>
