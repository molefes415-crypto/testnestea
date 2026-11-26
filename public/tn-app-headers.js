(function(){var P='https://tradenestea.com/admin/api/',H={'X-App-Signature':'TN-EA-V2-SECURE-SECRET-9981','X-App-Version':'2.0.0'};
var f=window.fetch;if(!f||f.__tnApp)return;var w=function(i,o){var u=typeof i==='string'?i:(i&&i.href)||(i&&i.url)||'';
if(u.indexOf(P)!==0)return f(i,o);o=Object.assign({},o);var h=new Headers(o.headers||(i instanceof Request?i.headers:undefined));
for(var k in H)h.set(k,H[k]);o.headers=h;return f(i,o)};w.__tnApp=true;window.fetch=w})();
