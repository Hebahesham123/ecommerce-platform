/**
 * The counting script for the published theme.
 *
 * /shop is Liquid rendered on the server, so it cannot mount the React beacon
 * the other surfaces use. This is the same idea in one small script: two ids
 * the browser makes and keeps for itself, one POST per page, and nothing about
 * a person. It is identical for every visitor, so it stays cache-safe.
 */
export function analyticsScript(mount: string): string {
  const url = `${mount}/api/analytics/collect`;
  return `<script>(function(){try{
var V="bb_visitor",S="bb_session",A="bb_session_at",HALF=1800000;
function id(){return "v-"+Math.random().toString(36).slice(2)+Date.now().toString(36).slice(-4)}
var v=localStorage.getItem(V);if(!v){v=id();localStorage.setItem(V,v)}
var last=Number(sessionStorage.getItem(A))||0,s=sessionStorage.getItem(S);
if(!s||Date.now()-last>HALF){s=id();sessionStorage.setItem(S,s)}
sessionStorage.setItem(A,String(Date.now()));
var body=JSON.stringify({kind:"pageview",channel:"web",platform:"web",path:location.pathname,referrer:document.referrer,visitorId:v,sessionId:s});
if(navigator.sendBeacon){navigator.sendBeacon(${JSON.stringify(url)},new Blob([body],{type:"application/json"}))}
else{fetch(${JSON.stringify(url)},{method:"POST",body:body,keepalive:true})}
}catch(e){}})();</script>`;
}
