/**
 * The counting script for the published theme.
 *
 * /shop is Liquid rendered on the server, so it cannot mount the React beacon
 * the other surfaces use. This is the same idea in one small script: one POST
 * per page for the pageview, and — for the customer's timeline — the product
 * she opened and her basket when it has changed. It is identical for every
 * visitor, so it stays cache-safe.
 *
 * The visitor id is the bb_vid cookie the popup already uses, shared with the
 * website at /store, so moving between the two is still one shopper.
 *
 * Both endpoints live at the site root, not under the mount: /shop/api/...
 * is the theme's own catch-all and answers nothing there.
 */
export function analyticsScript(mount: string): string {
  void mount;
  const collect = "/api/analytics/collect";
  const track = "/api/track";
  return `<script>(function(){try{
var D=document,S="bb_session",A="bb_session_at",HALF=1800000;
function id(){return "v-"+Math.random().toString(36).slice(2)+Date.now().toString(36).slice(-4)}
function ck(n){var m=D.cookie.match("(?:^|; )"+n+"=([^;]*)");return m?decodeURIComponent(m[1]):""}
var v=ck("bb_vid");
if(!v){v=localStorage.getItem("bb_visitor")||id();D.cookie="bb_vid="+encodeURIComponent(v)+";path=/;max-age=31536000;samesite=lax"}
localStorage.setItem("bb_visitor",v);
var last=Number(sessionStorage.getItem(A))||0,s=sessionStorage.getItem(S);
if(!s||Date.now()-last>HALF){s=id();sessionStorage.setItem(S,s)}
sessionStorage.setItem(A,String(Date.now()));
function post(url,o){var b=JSON.stringify(o);if(navigator.sendBeacon){navigator.sendBeacon(url,new Blob([b],{type:"application/json"}))}else{fetch(url,{method:"POST",body:b,keepalive:true,headers:{"content-type":"application/json"}})}}
post(${JSON.stringify(collect)},{kind:"pageview",channel:"web",platform:"web",path:location.pathname,referrer:document.referrer,visitorId:v,sessionId:s});
var m=location.pathname.match(/\\/products\\/([^\\/?#]+)/);
if(m)post(${JSON.stringify(track)},{channel:"shop",platform:"web",visitorId:v,type:"product_view",path:location.pathname,handle:decodeURIComponent(m[1])});
var raw=ck("sf_cart"),lines=[];
try{lines=raw?JSON.parse(raw):[]}catch(e){lines=[]}
var sig=JSON.stringify(lines),sent=localStorage.getItem("bb_shop_cart_sent");
if(sig!==sent&&!(sent===null&&!lines.length)){localStorage.setItem("bb_shop_cart_sent",sig);post(${JSON.stringify(track)},{channel:"shop",platform:"web",visitorId:v,cartIds:lines})}
}catch(e){}})();</script>`;
}
