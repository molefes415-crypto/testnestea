<?php
// TradeNest EA — PayFast return page that reopens the app on Android AND iOS.
// Set this as the PayFast return_url / cancel_url:
//   https://tradenestea.com/admin/api/payfast_return.php?m=PAYMENT_ID   (cancel: add &cancel=1)
// It polls payfast_status.php (never trusts the browser) then opens the app:
//   Android: intent:// URL (Chrome blocks plain tradenest:// without a tap)
//   iOS:     tradenest:// scheme / web app
$pid = preg_replace('/[^A-Za-z0-9_\-]/', '', $_GET['m'] ?? ($_GET['m_payment_id'] ?? ''));
$cancel = ($_GET['cancel'] ?? '') === '1';
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
$platform = stripos($ua, 'Android') !== false ? 'android' : (preg_match('/iPhone|iPad|iPod/i', $ua) ? 'ios' : 'web');
const ANDROID_PACKAGE = 'com.whiteyforex.tradenestea';
const WEB_APP = 'https://tradnestea.app/tradenest.html';
?><!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TradeNest EA — Payment</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050505;color:#fff;font-family:system-ui;text-align:center;padding:20px}
a{display:none;margin-top:20px;padding:16px;border-radius:14px;background:#e01a3c;color:#fff;font-weight:800;text-decoration:none}p{color:#aaa}</style></head>
<body><div><h2 id="t">VERIFYING PAYMENT…</h2><p id="m">Please wait while PayFast confirms your payment.</p><a id="b" href="#">OPEN TRADE NEST EA</a></div>
<script>
var pid=<?= json_encode($pid) ?>, cancel=<?= $cancel ? 'true' : 'false' ?>, platform=<?= json_encode($platform) ?>;
var pkg=<?= json_encode(ANDROID_PACKAGE) ?>, web=<?= json_encode(WEB_APP) ?>;
function link(state){
  var q='payment_id='+encodeURIComponent(pid)+'&state='+state;
  if(platform==='android') return 'intent://payfast/'+state+'?'+q+'#Intent;scheme=tradenest;package='+pkg+';S.browser_fallback_url='+encodeURIComponent(web+'?payfast='+state)+';end';
  if(platform==='ios') return 'tradenest://payfast/'+state+'?'+q;
  return web+'?payfast='+state+(state==='success'?'&addbot=1':'');
}
function open(state,title,msg){
  document.getElementById('t').textContent=title;document.getElementById('m').textContent=msg;
  var b=document.getElementById('b');b.href=link(state);b.style.display='block';
  location.href=link(state);
  if(platform!=='web') setTimeout(function(){ if(!document.hidden) location.replace(web+'?payfast='+state+(state==='success'?'&addbot=1':'')); },2500);
}
if(cancel) open('cancel','PAYMENT CANCELLED','Nothing was charged.');
else if(!pid) open('failed','PAYMENT NOT FOUND','Return to the app and tap Check Payment Status.');
else { var n=0; (function poll(){ n++;
  fetch('payfast_status.php?platform='+platform+'&payment_id='+encodeURIComponent(pid)).then(function(r){return r.json()}).then(function(d){
    if(d.paid) return open('success','PAYMENT SUCCESSFUL ✓','Opening Trade Nest EA…');
    if(d.status==='cancelled') return open('cancel','PAYMENT CANCELLED','Nothing was charged.');
    if(d.status==='failed') return open('failed','PAYMENT FAILED','Please try again.');
    if(n<15) return setTimeout(poll,2500);
    open('pending','STILL VERIFYING','Open the app and tap Check Payment Status.');
  }).catch(function(){ n<15?setTimeout(poll,2500):open('pending','STILL VERIFYING','Open the app and tap Check Payment Status.'); });
})(); }
</script></body></html>
