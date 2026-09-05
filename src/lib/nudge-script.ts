import "server-only";
import type { NudgeCampaign } from "@/lib/nudge";

/**
 * The client half of the hesitation nudge: watch for the signals the merchant
 * switched on, and render the popup they designed.
 *
 * Two constraints shape all of this.
 *
 * 1. Catalogue pages are shared edge-cached HTML, byte-identical for every
 *    shopper. So the campaign is baked in (merchant configuration, same for
 *    everyone) while anything shopper-specific — how long they have been here,
 *    whether they have seen it, what is in their cart — is decided in the
 *    browser from cookies and storage. Nothing here makes a page private.
 *
 * 2. The theme is an arbitrary uploaded Shopify theme whose CSS we do not
 *    control. The popup therefore lives in a shadow root, so no theme rule can
 *    reach into it and nothing it does can leak back out.
 */

/** Embedding JSON in a <script> means neutralising anything that closes it. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function nudgeScript(mount: string, c: NudgeCampaign): string {
  // Only what the browser needs. Nothing here is secret, but there is no
  // reason to ship the whole row.
  const config = {
    id: c.id,
    pages: c.pages,
    dwell: c.dwellEnabled ? c.dwellSeconds : 0,
    exit: c.exitEnabled,
    idle: c.idleEnabled ? c.idleSeconds : 0,
    cart: c.cartEnabled ? c.cartSeconds : 0,
    maxPerSession: c.maxPerSession,
    cooldownHours: c.cooldownHours,
    skipIfCartEmpty: c.skipIfCartEmpty,
    style: c.style,
    position: c.position,
    headline: c.headline,
    body: c.body,
    button: c.buttonLabel,
    dismiss: c.dismissLabel,
    captureLabel: c.captureLabel,
    accent: c.accentColor,
    bg: c.backgroundColor,
    fg: c.textColor,
    image: c.imageUrl,
    code: c.discountCode,
    segments: c.wheelSegments,
  };

  return (
    "<script>(function(){" +
    "var C=" + jsonForScript(config) + ";" +
    "var M=" + jsonForScript(mount) + ";" +
    NUDGE_BODY +
    "})();</script>"
  );
}

/**
 * Kept as one plain string rather than a template literal so that nothing in
 * it can be mistaken for an interpolation, and so the whole program reads in
 * one place.
 */
const NUDGE_BODY = `
if(window.__BB_NUDGE__)return;window.__BB_NUDGE__=1;
var D=document,W=window;
function noop(){}

/* ---- which page is this? ------------------------------------------------ */
function pageType(){
  var p=location.pathname;
  if(M&&p.indexOf(M)===0)p=p.slice(M.length)||"/";
  if(/^\\/products\\//.test(p))return "product";
  if(/^\\/collections\\/[^\\/]+/.test(p))return "collection";
  if(/^\\/collections\\/?$/.test(p))return "collection";
  if(/^\\/cart/.test(p))return "cart";
  if(/^\\/search/.test(p))return "search";
  if(p==="/"||p==="")return "index";
  return "other";
}
var PT=pageType();
if(C.pages.indexOf(PT)<0)return;
/* Never interrupt someone who is already at the till. */
if(/\\/(checkout|account)(\\/|$)/.test(location.pathname))return;

/* ---- who is this, anonymously ------------------------------------------- */
function ck(n){try{var m=D.cookie.match("(?:^|; )"+n+"=([^;]*)");return m?decodeURIComponent(m[1]):"";}catch(e){return "";}}
function setCk(n,v,days){try{D.cookie=n+"="+encodeURIComponent(v)+";path=/;max-age="+(days*86400)+";samesite=lax";}catch(e){}}
function rid(){return Math.random().toString(36).slice(2)+Date.now().toString(36);}
var vid=ck("bb_vid");
if(!vid){vid=rid();setCk("bb_vid",vid,365);}
var sid="";
try{sid=sessionStorage.getItem("bb_nsid")||"";if(!sid){sid=rid();sessionStorage.setItem("bb_nsid",sid);}}catch(e){sid=vid;}

/* ---- have they had enough of this already? ------------------------------ */
function num(v){var n=parseInt(v||"0",10);return isNaN(n)?0:n;}
var seenThisSession=0,lastSeenAt=0;
try{seenThisSession=num(sessionStorage.getItem("bb_nudge_seen"));}catch(e){}
try{lastSeenAt=num(localStorage.getItem("bb_nudge_at"));}catch(e){}
if(seenThisSession>=C.maxPerSession)return;
if(C.cooldownHours>0&&lastSeenAt&&Date.now()-lastSeenAt<C.cooldownHours*3600000)return;

/* ---- what is in the cart ------------------------------------------------ */
/* Read straight from the theme's own cart cookie: no request, and it keeps
   this page identical for every shopper, which is what lets the CDN cache it. */
function cartCount(){
  try{
    var raw=ck("sf_cart");if(!raw)return 0;
    var lines=JSON.parse(raw);if(!lines||!lines.length)return 0;
    var n=0;for(var i=0;i<lines.length;i++)n+=(+lines[i].quantity||0);
    return n;
  }catch(e){return 0;}
}
if(C.skipIfCartEmpty&&cartCount()===0)return;

/* ---- reporting ----------------------------------------------------------- */
function report(type,extra){
  try{
    var b={type:type,cid:C.id,vid:vid,sid:sid,path:location.pathname};
    if(extra)for(var k in extra)b[k]=extra[k];
    var body=JSON.stringify(b);
    /* sendBeacon survives the page being closed, which is exactly when an
       exit-intent dismissal is reported. */
    if(navigator.sendBeacon){
      navigator.sendBeacon(M+"/nudge/event",new Blob([body],{type:"application/json"}));
    }else{
      fetch(M+"/nudge/event",{method:"POST",headers:{"content-type":"application/json"},body:body,keepalive:true}).catch(noop);
    }
  }catch(e){}
}

/* ---- the signals --------------------------------------------------------- */
var fired=false,timers=[],arrived=Date.now(),visibleMs=0,idleMs=0,cartMs=0,lastTick=Date.now();

function cleanup(){
  for(var i=0;i<timers.length;i++)clearInterval(timers[i]);
  D.removeEventListener("mouseout",onMouseOut,true);
  D.removeEventListener("scroll",onActivity,true);
  D.removeEventListener("mousemove",onActivity,true);
  D.removeEventListener("keydown",onActivity,true);
  D.removeEventListener("touchstart",onActivity,true);
}

function fire(trigger){
  if(fired)return;fired=true;cleanup();
  report("hesitation",{trigger:trigger,dwellMs:visibleMs});
  show(trigger);
}

/* Time on the page only counts while the tab is actually in front — a page
   left open in a background tab is not a hesitating shopper. */
timers.push(setInterval(function(){
  var now=Date.now(),delta=now-lastTick;lastTick=now;
  if(D.hidden||delta>5000)return;
  visibleMs+=delta;idleMs+=delta;
  if(cartCount()>0)cartMs+=delta;else cartMs=0;
  if(C.dwell&&visibleMs>=C.dwell*1000)return fire("dwell");
  if(C.idle&&idleMs>=C.idle*1000)return fire("idle");
  if(C.cart&&cartMs>=C.cart*1000)return fire("cart");
},1000));

function onActivity(){idleMs=0;}
D.addEventListener("scroll",onActivity,true);
D.addEventListener("mousemove",onActivity,true);
D.addEventListener("keydown",onActivity,true);
D.addEventListener("touchstart",onActivity,true);

/* Exit intent. On a desktop the cursor leaving through the top of the viewport
   is the tab bar or the close button. A phone has no cursor, so the tell is a
   hard flick upward — a reach for the back gesture or the address bar. */
function onMouseOut(e){
  if(!C.exit||fired)return;
  if(e.clientY>0||e.relatedTarget)return;
  /* Give them a moment to actually be on the page first. */
  if(Date.now()-arrived<4000)return;
  fire("exit");
}
D.addEventListener("mouseout",onMouseOut,true);

if(C.exit&&("ontouchstart" in W)){
  var lastY=W.scrollY||0,lastAt=Date.now();
  D.addEventListener("scroll",function(){
    if(fired)return;
    var y=W.scrollY||0,now=Date.now(),dt=now-lastAt;
    if(dt>0&&dt<400&&lastY-y>320&&y<220&&now-arrived>6000)fire("exit");
    lastY=y;lastAt=now;
  },{passive:true});
}

/* ---- the popup ----------------------------------------------------------- */
function esc(s){return String(s==null?"":s);}

function pickSegment(){
  var segs=C.segments||[],total=0,i;
  for(i=0;i<segs.length;i++)total+=Math.max(0,segs[i].weight||0);
  if(total<=0)return Math.floor(Math.random()*segs.length);
  var r=Math.random()*total,acc=0;
  for(i=0;i<segs.length;i++){acc+=Math.max(0,segs[i].weight||0);if(r<acc)return i;}
  return segs.length-1;
}

function show(trigger){
  try{
    try{sessionStorage.setItem("bb_nudge_seen",String(seenThisSession+1));}catch(e){}
    try{localStorage.setItem("bb_nudge_at",String(Date.now()));}catch(e){}

    var host=D.createElement("div");
    host.setAttribute("data-bb-nudge","");
    host.style.cssText="position:fixed;inset:0;z-index:2147483600;pointer-events:none";
    var root=host.attachShadow?host.attachShadow({mode:"open"}):host;
    D.body.appendChild(host);

    var centred=C.position==="center";
    var anchor=centred?"align-items:center;justify-content:center"
      :C.position==="bottom-bar"?"align-items:flex-end;justify-content:center"
      :C.position==="bottom-left"?"align-items:flex-end;justify-content:flex-start"
      :"align-items:flex-end;justify-content:flex-end";
    var panelWidth=C.position==="bottom-bar"?"min(920px,96vw)":"min(400px,92vw)";

    var css="*{box-sizing:border-box;margin:0;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}"
      +".wrap{position:fixed;inset:0;display:flex;"+anchor+";padding:20px;pointer-events:none}"
      +".veil{position:absolute;inset:0;background:rgba(15,23,42,.45);opacity:0;transition:opacity .25s ease;pointer-events:auto}"
      +".veil.on{opacity:1}"
      +".panel{position:relative;pointer-events:auto;width:"+panelWidth+";background:"+C.bg+";color:"+C.fg+";border-radius:18px;box-shadow:0 24px 60px rgba(15,23,42,.28);padding:26px 24px;text-align:center;opacity:0;transform:translateY(14px) scale(.98);transition:opacity .28s ease,transform .28s cubic-bezier(.2,.9,.3,1)}"
      +".panel.on{opacity:1;transform:none}"
      +".x{position:absolute;top:10px;inset-inline-end:10px;width:30px;height:30px;border:0;background:transparent;color:currentColor;opacity:.45;font-size:19px;line-height:1;cursor:pointer;border-radius:8px}"
      +".x:hover{opacity:.9;background:rgba(127,127,127,.12)}"
      +"img.hero{width:100%;height:132px;object-fit:cover;border-radius:12px;margin-bottom:14px}"
      +"h2{font-size:20px;font-weight:800;letter-spacing:-.01em;line-height:1.25}"
      +"p.body{margin-top:8px;font-size:14.5px;line-height:1.6;opacity:.78}"
      +".code{margin-top:16px;display:flex;align-items:center;justify-content:center;gap:10px;border:1.5px dashed "+C.accent+";border-radius:12px;padding:12px 14px;font-size:19px;font-weight:800;letter-spacing:.08em}"
      +".btn{margin-top:14px;width:100%;border:0;border-radius:12px;padding:13px 18px;background:"+C.accent+";color:#fff;font-size:15px;font-weight:700;cursor:pointer}"
      +".btn:disabled{opacity:.55;cursor:default}"
      +".ghost{margin-top:9px;width:100%;border:0;background:transparent;color:currentColor;opacity:.6;font-size:13.5px;cursor:pointer;padding:7px}"
      +".ghost:hover{opacity:.95}"
      +"input{margin-top:14px;width:100%;border:1px solid rgba(127,127,127,.35);border-radius:12px;padding:13px 14px;font-size:15px;background:transparent;color:currentColor}"
      +"input:focus{outline:none;border-color:"+C.accent+"}"
      +".err{margin-top:8px;font-size:13px;color:#dc2626}"
      +".wheelbox{position:relative;width:230px;height:230px;margin:16px auto 4px}"
      +".wheel{width:100%;height:100%;border-radius:50%;border:6px solid "+C.accent+";transition:transform 4.2s cubic-bezier(.17,.67,.21,1)}"
      +".pin{position:absolute;top:-4px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:11px solid transparent;border-right:11px solid transparent;border-top:19px solid "+C.accent+"}"
      +".seglabel{position:absolute;left:50%;top:50%;font-size:11.5px;font-weight:800;color:#0f172a;transform-origin:0 0;white-space:nowrap}"
      +"@media(max-width:520px){.panel{width:min(420px,94vw);padding:22px 18px}}";

    var wrap=D.createElement("div");
    wrap.className="wrap";
    var style=D.createElement("style");style.textContent=css;

    var veil=D.createElement("div");veil.className="veil";
    if(!centred)veil.style.display="none";

    var panel=D.createElement("div");panel.className="panel";
    if(C.position==="bottom-bar")panel.style.textAlign="start";

    root.appendChild(style);wrap.appendChild(veil);wrap.appendChild(panel);root.appendChild(wrap);

    function close(kind){
      panel.classList.remove("on");veil.classList.remove("on");
      setTimeout(function(){try{host.remove();}catch(e){}},260);
      if(kind)report(kind,{trigger:trigger});
    }

    var x=D.createElement("button");x.className="x";x.setAttribute("aria-label","Close");x.textContent="\\u00d7";
    x.onclick=function(){close("dismissed");};
    panel.appendChild(x);

    if(C.image){var im=D.createElement("img");im.className="hero";im.src=C.image;im.alt="";panel.appendChild(im);}

    var h=D.createElement("h2");h.textContent=esc(C.headline);panel.appendChild(h);
    if(C.body){var bp=D.createElement("p");bp.className="body";bp.textContent=esc(C.body);panel.appendChild(bp);}

    /* Handing over the code: copy it, remember it was claimed, and put the
       shopper back on the path to paying. */
    function claim(code,contact){
      try{if(navigator.clipboard)navigator.clipboard.writeText(code).catch(noop);}catch(e){}
      report("claimed",{trigger:trigger,code:code,contact:contact||null});
      close(null);
      /* On a product page the cart is where they were heading anyway. */
      if(PT!=="cart")setTimeout(function(){location.href=M+"/cart";},220);
    }

    function codePanel(code){
      var box=D.createElement("div");box.className="code";box.textContent=code;
      panel.appendChild(box);
      var go=D.createElement("button");go.className="btn";go.textContent=esc(C.button);
      go.onclick=function(){claim(code,null);};
      panel.appendChild(go);
    }

    if(C.style==="wheel"&&C.segments&&C.segments.length>1){
      var segs=C.segments,n=segs.length,slice=360/n,i;
      var box=D.createElement("div");box.className="wheelbox";
      var wheel=D.createElement("div");wheel.className="wheel";
      var stops=[];
      for(i=0;i<n;i++){
        var a=i%2?"rgba(255,255,255,.92)":C.accent;
        stops.push(a+" "+(i*slice)+"deg "+((i+1)*slice)+"deg");
      }
      wheel.style.background="conic-gradient("+stops.join(",")+")";
      for(i=0;i<n;i++){
        var lab=D.createElement("span");lab.className="seglabel";
        lab.textContent=segs[i].label;
        lab.style.transform="rotate("+(i*slice+slice/2)+"deg) translate(14px,-6px)";
        wheel.appendChild(lab);
      }
      var pin=D.createElement("div");pin.className="pin";
      box.appendChild(wheel);box.appendChild(pin);panel.appendChild(box);

      var spin=D.createElement("button");spin.className="btn";spin.textContent=esc(C.button)||"Spin";
      spin.onclick=function(){
        spin.disabled=true;
        var idx=pickSegment();
        /* Land the middle of the winning slice under the pin at the top. */
        var target=360*5+(360-(idx*slice+slice/2));
        wheel.style.transform="rotate("+target+"deg)";
        setTimeout(function(){
          var won=segs[idx];
          spin.remove();box.style.opacity=".75";
          var msg=D.createElement("p");msg.className="body";
          msg.textContent=won.label;panel.appendChild(msg);
          if(won.code)codePanel(won.code);else{
            var ok=D.createElement("button");ok.className="btn";ok.textContent=esc(C.button);
            ok.onclick=function(){close(null);};panel.appendChild(ok);
          }
        },4400);
      };
      panel.appendChild(spin);
    }else if(C.style==="capture"){
      var lbl=D.createElement("p");lbl.className="body";lbl.textContent=esc(C.captureLabel);
      if(C.captureLabel)panel.appendChild(lbl);
      var input=D.createElement("input");
      input.type="text";input.placeholder="you@email.com";input.setAttribute("dir","ltr");
      panel.appendChild(input);
      var err=D.createElement("p");err.className="err";err.style.display="none";panel.appendChild(err);
      var send=D.createElement("button");send.className="btn";send.textContent=esc(C.button);
      send.onclick=function(){
        var v=(input.value||"").trim();
        var okEmail=/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v);
        var okPhone=v.replace(/\\D/g,"").length>=10;
        if(!okEmail&&!okPhone){err.style.display="";err.textContent="Enter a valid email or phone number";return;}
        err.style.display="none";
        if(C.code)claim(C.code,v);
        else{report("claimed",{trigger:trigger,contact:v});close(null);}
      };
      input.addEventListener("keydown",function(e){if(e.key==="Enter")send.click();});
      panel.appendChild(send);
    }else if(C.code){
      codePanel(C.code);
    }else{
      var ok2=D.createElement("button");ok2.className="btn";ok2.textContent=esc(C.button);
      ok2.onclick=function(){close(null);};panel.appendChild(ok2);
    }

    if(C.dismiss){
      var no=D.createElement("button");no.className="ghost";no.textContent=esc(C.dismiss);
      no.onclick=function(){close("dismissed");};panel.appendChild(no);
    }

    if(centred)veil.onclick=function(){close("dismissed");};
    D.addEventListener("keydown",function onKey(e){
      if(e.key==="Escape"){D.removeEventListener("keydown",onKey);close("dismissed");}
    });

    requestAnimationFrame(function(){veil.classList.add("on");panel.classList.add("on");});
    report("shown",{trigger:trigger});
  }catch(e){/* a broken popup must never take the storefront with it */}
}
`;
