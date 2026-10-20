import { IMPORTANT_PATTERN } from "@/lib/click-tracking";

/**
 * The counting script for the published theme.
 *
 * /shop is Liquid rendered on the server, so it cannot mount the React beacon
 * the other surfaces use. This is the same idea in one small script:
 *
 *   - one POST per page for the pageview (with the page's own id and title),
 *     and when the page is hidden or left, how long it was actually on screen
 *     and how far it was scrolled;
 *   - for the customer's timeline, the product she opened, what she searched
 *     for (the theme's search page carries the words in its address, ?q=),
 *     and her basket when it has changed;
 *   - every press on a button or link, with its words and whether it is one
 *     that matters (lib/click-tracking's pattern). Nothing typed into a field
 *     is ever read.
 *
 * It is identical for every visitor, so it stays cache-safe.
 *
 * The visitor id is the bb_vid cookie the popup already uses, shared with the
 * website at /store, so moving between the two is still one shopper.
 *
 * Both endpoints live at the site root, not under the mount: /shop/api/...
 * is the theme's own catch-all and answers nothing there.
 */
export function analyticsScript(mount: string): string {
  void mount;
  const collect = JSON.stringify("/api/analytics/collect");
  const track = JSON.stringify("/api/track");
  const important = JSON.stringify(IMPORTANT_PATTERN);
  const js = [
    'var D=document,S="bb_session",A="bb_session_at",HALF=1800000;',
    'function id(p){return (p||"v-")+Math.random().toString(36).slice(2)+Date.now().toString(36).slice(-4)}',
    'function ck(n){var m=D.cookie.match("(?:^|; )"+n+"=([^;]*)");return m?decodeURIComponent(m[1]):""}',
    'var v=ck("bb_vid");',
    'if(!v){v=localStorage.getItem("bb_visitor")||id();D.cookie="bb_vid="+encodeURIComponent(v)+";path=/;max-age=31536000;samesite=lax"}',
    'localStorage.setItem("bb_visitor",v);',
    'var last=Number(sessionStorage.getItem(A))||0,s=sessionStorage.getItem(S);',
    'if(!s||Date.now()-last>HALF){s=id();sessionStorage.setItem(S,s)}',
    'sessionStorage.setItem(A,String(Date.now()));',
    'function post(url,o){var b=JSON.stringify(o);if(navigator.sendBeacon){navigator.sendBeacon(url,new Blob([b],{type:"application/json"}))}else{fetch(url,{method:"POST",body:b,keepalive:true,headers:{"content-type":"application/json"}})}}',
    'function ev(o){o.channel="shop";o.platform="web";o.visitorId=v;o.path=location.pathname;post(' + track + ',o)}',
    // The page, with its id; campaign tags and ad click ids are the only parts of the address kept.
    'var P={},Q=new URLSearchParams(location.search);["utm_source","utm_medium","utm_campaign","utm_content","utm_term","fbclid","gclid","gbraid","wbraid","ttclid","sccid","ScCid","msclkid","twclid","li_fat_id","epik"].forEach(function(k){var x=Q.get(k);if(x)P[k]=x.slice(0,200)});',
    'var pv=id("p-");',
    'post(' + collect + ',{kind:"pageview",channel:"web",platform:"web",path:location.pathname,referrer:D.referrer,params:P,visitorId:v,sessionId:s,pageviewId:pv,title:D.title});',
    // Time on screen (only while visible) and how far down it was scrolled, sent when hidden or left.
    'var vis=0,since=D.visibilityState==="visible"?Date.now():null,deep=0;',
    'function sc(){var d=D.documentElement,h=d.scrollHeight;return h>0?Math.min(100,Math.round((window.scrollY+window.innerHeight)/h*100)):0}',
    'window.addEventListener("scroll",function(){deep=Math.max(deep,sc())},{passive:true});',
    'function leave(){var ms=vis+(since!==null?Date.now()-since:0);post(' + collect + ',{kind:"leave",pageviewId:pv,seconds:Math.round(ms/1000),scroll:Math.max(deep,sc())})}',
    'D.addEventListener("visibilitychange",function(){if(D.visibilityState==="hidden"){if(since!==null)vis+=Date.now()-since;since=null;leave()}else{since=Date.now()}});',
    'window.addEventListener("pagehide",leave);',
    // The product opened, and the words searched for on the theme's search page.
    'var m=location.pathname.match(/\\/products\\/([^\\/?#]+)/);',
    'if(m)ev({type:"product_view",handle:decodeURIComponent(m[1])});',
    'if(/\\/search\\/?$/.test(location.pathname)&&Q.get("q")){var res=D.querySelectorAll("[data-product-id],.product-card,.product-item,.card-product,.grid__item").length;ev({type:"search",term:Q.get("q").slice(0,100),quantity:res})}',
    // Presses on buttons and links: at most one every 300ms, and 300 a page.
    'var IMP=new RegExp(' + important + ',"i"),lastC=0,nC=0;',
    'D.addEventListener("click",function(e){try{var t=e.target;if(!t||!t.closest)return;if(t.closest("input:not([type=submit]):not([type=button]),textarea,select,[contenteditable=true]"))return;',
    'var el=t.closest("[data-track],a[href],button,[role=button],input[type=submit],input[type=button],summary,label[for]");if(!el)return;',
    'var now=Date.now();if(now-lastC<300||nC>=300)return;lastC=now;nC++;',
    'var lb=(el.getAttribute("data-track")||el.getAttribute("aria-label")||el.getAttribute("title")||(el.tagName==="INPUT"?el.value:"")||el.innerText||el.textContent||"").replace(/\\s+/g," ").trim().slice(0,80);',
    'var tg=null;if(el.tagName==="A"&&el.href){try{var u=new URL(el.href);tg=u.protocol==="tel:"||u.protocol==="mailto:"?u.protocol.slice(0,-1):(u.host===location.host?u.pathname:u.host)}catch(x){}}',
    'if(!lb)lb=tg?"link "+tg:el.tagName.toLowerCase();',
    'ev({type:"click",label:lb,important:el.hasAttribute("data-track-important")||IMP.test(lb),target:tg})}catch(x){}},true);',
    // The basket, when it has changed.
    'var raw=ck("sf_cart"),lines=[];',
    'try{lines=raw?JSON.parse(raw):[]}catch(e){lines=[]}',
    'var sig=JSON.stringify(lines),sent=localStorage.getItem("bb_shop_cart_sent");',
    'if(sig!==sent&&!(sent===null&&!lines.length)){localStorage.setItem("bb_shop_cart_sent",sig);post(' + track + ',{channel:"shop",platform:"web",visitorId:v,cartIds:lines})}',
  ].join("\n");
  return "<script>(function(){try{\n" + js + "\n}catch(e){}})();</script>";
}
